import { type Bar, ema, sma, atr, rsi, adx, boll, stoch, mfi, macd, supertrend, slope, rsq } from "../scalp/ind";
import { aggregate, local } from "../scalp/engine";
import type { GoldData } from "./features";

/* ─── Tesla Trader · 5 SCAN (2026-11-05) ─────────────────────────────────────
   Нэг мөчид таван өөр аргаар алтыг сканнердаж, дундаж ба санал нийлэлтийг гаргана.
   Индикаторууд нь харьцуулсан бүтээгдэхүүнүүдийн НИЙТЭД нэрлэсэн аргуудаас (sources.ts):
     1 committee — 17 индикаторын санал (EMA, SMA, RSI, MACD, Stoch, KST, DPO, BB, %B, ADX, Ichimoku, VWAP, SAR, Supertrend, MFI, RelVol, A/D)
     2 pattern   — MACD (хистограм, огтлолцол, зөрөлт), Фибоначчи, S/R, момент, олон хугацаа, стадий, POC, графикийн загвар
     3 levels    — гол түвшин (ойртох/эвдрэх), өдрийн пивот, PDH/PDL, ABCD, Gartley/Butterfly, тэгш өнцөгт
     4 smc       — BOS, CHoCH, sweep, FVG, order block, premium/discount, displacement
     5 macro     — H1–D1 тренд, синтетик DXY, сешний эвдрэл
   Дүрэм бүр урьдчилан тогтмол, энэ датан дээр ТОХИРУУЛААГҮЙ. Зөвхөн хаагдсан лааг ашиглана:
   swing нь k лааны дараа баталгаажна (ирээдүй харахгүй). features.ts-тэй ижил M5 хаалтын мөчүүд. */

export const SCANS = [
  { id: "committee", mn: "Индикаторын зөвлөл", sub: "17 индикатор санал өгнө" },
  { id: "pattern", mn: "Загвар ба момент", sub: "MACD · Фибоначчи · стадий · загвар" },
  { id: "levels", mn: "Түвшин ба гармоник", sub: "Гол түвшин · пивот · ABCD · Gartley" },
  { id: "smc", mn: "SMC · хөрвөх чадвар", sub: "BOS · sweep · FVG · order block" },
  { id: "macro", mn: "Тренд ба DXY", sub: "H1–D1 тренд · DXY · сешн" },
] as const;
export type ScanId = (typeof SCANS)[number]["id"];
export type Vote = { k: string; mn: string; v: number; txt: string };
export type ScanResult = { id: ScanId; score: number; active: number; votes: Vote[] };

const cl = (x: number, a = 1) => (Number.isFinite(x) ? Math.max(-a, Math.min(a, x)) : 0);
const sg = (x: number) => (Number.isFinite(x) ? Math.sign(x) : 0);

function mapTo(times: number[], big: Bar[], w: number): Int32Array {
  const out = new Int32Array(times.length).fill(-1);
  let k = -1;
  times.forEach((T, j) => { while (k + 1 < big.length && big[k + 1].t + w <= T) k++; out[j] = k; });
  return out;
}

/* ── нэмэлт индикатор ── */
function psar(b: Bar[], step = 0.02, max = 0.2): number[] {
  const out: number[] = new Array(b.length).fill(0);
  if (b.length < 3) return out;
  let up = b[1].c >= b[0].c, sar = up ? b[0].l : b[0].h, ep = up ? b[1].h : b[1].l, af = step;
  for (let i = 2; i < b.length; i++) {
    sar += af * (ep - sar);
    sar = up ? Math.min(sar, b[i - 1].l, b[i - 2].l) : Math.max(sar, b[i - 1].h, b[i - 2].h);
    if (up ? b[i].l < sar : b[i].h > sar) { up = !up; sar = ep; ep = up ? b[i].h : b[i].l; af = step; }
    else if (up ? b[i].h > ep : b[i].l < ep) { ep = up ? b[i].h : b[i].l; af = Math.min(max, af + step); }
    out[i] = up ? 1 : -1;
  }
  return out;
}
const rocPct = (c: number[], n: number) => c.map((x, i) => (i < n ? 0 : (100 * (x - c[i - n])) / c[i - n]));
function kst(c: number[]) {
  const a = sma(rocPct(c, 10), 10), b = sma(rocPct(c, 15), 10), d = sma(rocPct(c, 20), 10), e = sma(rocPct(c, 30), 15);
  const line = a.map((x, i) => (Number.isFinite(e[i]) ? x + 2 * b[i] + 3 * d[i] + 4 * e[i] : 0));
  return { line, sig: sma(line, 9) };
}
function adLine(b: Bar[]): number[] {
  let s = 0;
  return b.map((x) => (s += x.h > x.l ? ((x.c - x.l - (x.h - x.c)) / (x.h - x.l)) * x.v : 0));
}
const midRange = (b: Bar[], i: number, n: number) => {
  let hi = -Infinity, lo = Infinity;
  for (let k = Math.max(0, i - n + 1); k <= i; k++) { hi = Math.max(hi, b[k].h); lo = Math.min(lo, b[k].l); }
  return (hi + lo) / 2;
};

/* ── swing: i-р лаа нь i+k дээр баталгаажна ── */
type Piv = { i: number; p: number; hi: boolean };
function pivots(b: Bar[], k: number): Piv[] {
  const out: Piv[] = [];
  for (let i = k; i < b.length - k; i++) {
    let hi = true, lo = true;
    for (let q = i - k; q <= i + k; q++) { if (b[q].h > b[i].h) hi = false; if (b[q].l < b[i].l) lo = false; }
    if (hi) out.push({ i, p: b[i].h, hi: true });
    if (lo) out.push({ i, p: b[i].l, hi: false });
  }
  return out;
}
/** upto хүртэл баталгаажсан swing-ээс ээлжилсэн (zigzag) сүүлийн n цэг */
function zigzag(piv: Piv[], upto: number, k: number, n = 8): Piv[] {
  let lo = 0, hi = piv.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (piv[m].i + k <= upto) lo = m + 1; else hi = m; }
  const out: Piv[] = [];
  for (let q = Math.max(0, lo - 24); q < lo; q++) {
    const c = piv[q], last = out[out.length - 1];
    if (last && last.hi === c.hi) { if (c.hi ? c.p >= last.p : c.p <= last.p) out[out.length - 1] = c; }
    else out.push(c);
  }
  return out.slice(-n);
}
/** BOS төлөв: сүүлийн swing-ийг хаалтаар давбал чиглэл, flip = хэдэн лааны өмнө чиглэл эргэсэн */
function bosState(b: Bar[]) {
  const dir: number[] = new Array(b.length).fill(0), age: number[] = new Array(b.length).fill(999);
  let sh = NaN, sl = NaN, d = 0, a = 999;
  for (let j = 0; j < b.length; j++) {
    const p = j - 2;
    if (p >= 2) {
      if (b[p].h >= Math.max(b[p - 1].h, b[p - 2].h, b[p + 1].h, b[p + 2].h)) sh = b[p].h;
      if (b[p].l <= Math.min(b[p - 1].l, b[p - 2].l, b[p + 1].l, b[p + 2].l)) sl = b[p].l;
    }
    a++;
    if (b[j].c > sh) { if (d !== 1) a = 0; d = 1; sh = Infinity; } else if (b[j].c < sl) { if (d !== -1) a = 0; d = -1; sl = -Infinity; }
    dir[j] = d; age[j] = a;
  }
  return { dir, age };
}

export type ScanCtx = ReturnType<typeof buildScanCtx>;
export function buildScanCtx(D: GoldData) {
  const m1 = D.m1;
  let m5 = aggregate(m1, 5);
  const l1 = m1[m1.length - 1];
  if (m5.length && l1 && m5[m5.length - 1].t + 4 * 60000 > l1.t) m5 = m5.slice(0, -1);
  const m15 = aggregate(m1, 15), h1 = D.h1, h4 = aggregate(h1, 240), d1 = D.d1;
  const T = m5.map((b) => b.t + 300000);
  const q = mapTo(T, m15, 900000), h = mapTo(T, h1, 3600000), f = mapTo(T, h4, 14400000), d = mapTo(T, d1, 86400000);
  const c = m5.map((b) => b.c), cq = m15.map((b) => b.c), ch = h1.map((b) => b.c), cf = h4.map((b) => b.c), cd = d1.map((b) => b.c);
  const md = macd(c), mdq = macd(cq), adx5 = adx(m5, 14), bb = boll(c, 20, 2), s20 = sma(c, 20), k14 = stoch(m5, 14, 3), ks = kst(c);
  /* өдрийн VWAP, Азийн хүрээ */
  const vwap: number[] = [], asia = new Map<number, { hi: number; lo: number; end: number }>();
  { let day = -1, sw = 0, spv = 0;
    m5.forEach((b) => {
      const dn = Math.floor(b.t / 864e5);
      if (dn !== day) { day = dn; sw = 0; spv = 0; }
      const w = Math.max(b.v, 1e-6); sw += w; spv += ((b.h + b.l + b.c) / 3) * w; vwap.push(spv / sw);
      if (local("Europe/London", b.t).min < 480) {
        let r = asia.get(dn);
        if (!r) { r = { hi: -Infinity, lo: Infinity, end: 0 }; asia.set(dn, r); }
        r.hi = Math.max(r.hi, b.h); r.lo = Math.min(r.lo, b.l); r.end = b.t + 300000;
      }
    }); }
  const dx: number[] = []; { let last = NaN; m5.forEach((b) => { const v = D.dxy.get(b.t); if (v !== undefined) last = v; dx.push(last); }); }
  const lr = (a: number[], j: number, n: number) => (j >= n ? Math.log(a[j] / a[j - n]) : NaN);
  const rollZ = (n: number) => {
    const raw = m5.map((_, j) => lr(dx, j, n)), out: number[] = new Array(m5.length).fill(NaN);
    for (let j = 300; j < raw.length; j++) {
      let s = 0, s2 = 0, cnt = 0;
      for (let k = j - 288; k < j; k++) { const x = raw[k]; if (Number.isFinite(x)) { s += x; s2 += x * x; cnt++; } }
      if (cnt > 50 && Number.isFinite(raw[j])) { const mu = s / cnt, sd = Math.sqrt(Math.max(1e-18, s2 / cnt - mu * mu)); out[j] = (raw[j] - mu) / sd; }
    }
    return out;
  };
  const vol20 = sma(m5.map((b) => b.v), 20);
  return {
    live: false, m5, m15, h1, h4, d1, T, q, h, f, d, c, cq, ch, cd, cf,
    a5: atr(m5, 14), aq: atr(m15, 14), ah: atr(h1, 14), af: atr(h4, 14), ad: atr(d1, 14),
    e9: ema(c, 9), e21: ema(c, 21), s20, s50: sma(c, 50), r14: rsi(c, 14), md, mdq, k14, kD: sma(k14.map((x) => (Number.isFinite(x) ? x : 50)), 3),
    ks, bb, adx5, vwap, sar: psar(m5), st5: supertrend(m5, 10, 3).dir, mf: mfi(m5, 14), vol20, ad5: adLine(m5),
    e20q: ema(cq, 20), e20h: ema(ch, 20), e50h: ema(ch, 50), e20f: ema(cf, 20), e50f: ema(cf, 50), ma30f: sma(cf, 30), e20d: ema(cd, 20), slq: slope(cq, 40), r2q: rsq(cq, 40),
    pq: pivots(m15, 3), ph: pivots(h1, 3), bos5: bosState(m5), bos15: bosState(m15), asia, dx, dz6: rollZ(6), dz24: rollZ(24),
    levels: new Map<number, { p: number; n: number }[]>(),
  };
}
export const scanReady = (c: ScanCtx, j: number) => j >= 300 && c.q[j] >= 60 && c.h[j] >= 210 && c.f[j] >= 55 && c.d[j] >= 25 && c.a5[j] > 0;

type Add = (k: string, mn: string, v: number, txt: () => string) => void;
function collect(c: ScanCtx) {
  const votes: Vote[] = [];
  const add: Add = (k, mn, v, txt) => votes.push({ k, mn, v: +cl(v).toFixed(2), txt: c.live ? txt() : "" });
  return { votes, add };
}
const finish = (id: ScanId, votes: Vote[], min: number): ScanResult => {
  let s = 0, n = 0;
  for (const v of votes) if (v.v) { s += v.v; n++; }
  return { id, score: +cl(s / Math.max(n, min)).toFixed(3), active: n, votes };
};
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "—");

/* ── 1. индикаторын зөвлөл: M5 дээр 16, M15 Ichimoku — бүгд нэг санал ── */
function committee(c: ScanCtx, j: number): ScanResult {
  const { votes, add } = collect(c), b = c.m5[j], p = c.c[j], a = c.a5[j], k = c.q[j];
  const r = c.r14[j], line = c.md.line[j], sig = c.md.signal[j], K = c.k14[j], D = c.kD[j], pb = (p - c.bb.lo[j]) / (c.bb.up[j] - c.bb.lo[j] || 1);
  add("ema", "EMA 9/21", sg(c.e9[j] - c.e21[j]), () => (c.e9[j] > c.e21[j] ? "9 > 21" : "9 < 21"));
  add("sma", "SMA 20/50", sg(c.s20[j] - c.s50[j]), () => (c.s20[j] > c.s50[j] ? "20 > 50" : "20 < 50"));
  add("rsi", "RSI 14", r < 30 && r > c.r14[j - 1] ? 1 : r > 70 && r < c.r14[j - 1] ? -1 : cl((r - 50) / 20) * 0.5, () => r.toFixed(0));
  add("macd", "MACD", sg(line - sig), () => (line > sig ? "дохионоос дээш" : "дохионоос доош"));
  add("stoch", "Stochastic", K < 20 && K > D ? 1 : K > 80 && K < D ? -1 : 0, () => K.toFixed(0));
  add("kst", "KST", sg(c.ks.line[j] - c.ks.sig[j]), () => (c.ks.line[j] > c.ks.sig[j] ? "дохионоос дээш" : "дохионоос доош"));
  const dpo = j > 11 ? c.c[j - 11] - c.s20[j] : 0;
  add("dpo", "DPO", cl(dpo / a), () => f2(dpo));
  add("bb", "Bollinger дунд", sg(p - c.bb.mid[j]), () => (p > c.bb.mid[j] ? "дундаас дээш" : "дундаас доош"));
  add("pctb", "%B", pb < 0 ? 1 : pb > 1 ? -1 : 0, () => pb.toFixed(2));
  const ax = c.adx5.adx[j];
  add("adx", "ADX", ax >= 20 ? sg(c.adx5.pdi[j] - c.adx5.mdi[j]) : 0, () => `${ax.toFixed(0)} ${c.adx5.pdi[j] > c.adx5.mdi[j] ? "+DI" : "−DI"}`);
  const ic = k - 26, ten = (i: number) => midRange(c.m15, i, 9), kij = (i: number) => midRange(c.m15, i, 26);
  const spanA = (ten(ic) + kij(ic)) / 2, spanB = midRange(c.m15, ic, 52), top = Math.max(spanA, spanB), bot = Math.min(spanA, spanB);
  add("ichi", "Ichimoku (M15)", p > top ? 1 : p < bot ? -1 : 0, () => (p > top ? "үүлнээс дээш" : p < bot ? "үүлнээс доош" : "үүл дотор"));
  add("vwap", "VWAP", sg(p - c.vwap[j]), () => f2(c.vwap[j]));
  add("sar", "Parabolic SAR", c.sar[j], () => (c.sar[j] > 0 ? "өсөх" : "унах"));
  add("st", "Supertrend", c.st5[j] || 0, () => (c.st5[j] > 0 ? "өсөх" : "унах"));
  const mf = c.mf[j];
  add("mfi", "MFI", mf < 20 ? 1 : mf > 80 ? -1 : 0, () => (Number.isFinite(mf) ? mf.toFixed(0) : "—"));
  const rv = c.vol20[j] ? b.v / c.vol20[j] : 1;
  add("rvol", "Харьцангуй эзлэхүүн", rv > 1.5 ? sg(b.c - b.o) : 0, () => `${rv.toFixed(1)}×`);
  add("ad", "Accumulation/Distribution", sg(c.ad5[j] - c.ad5[j - 12]), () => (c.ad5[j] > c.ad5[j - 12] ? "хуримтлал" : "тархалт"));
  return finish("committee", votes, votes.length);
}

/** Сүүлийн zigzag цэгүүдээс графикийн загвар: [чиглэл, нэр] */
function chartPattern(c: ScanCtx, k: number): [number, string] {
  const z = zigzag(c.pq, k, 3, 7), a = c.aq[k], p = c.cq[k];
  if (z.length < 5) return [0, ""];
  const L = z.length, e = z[L - 1], d1 = z[L - 2], c1 = z[L - 3], b1 = z[L - 4], a1 = z[L - 5];
  const hi = (e.hi ? [a1, c1, e] : [b1, d1]).map((x) => x.p), lo = (e.hi ? [b1, d1] : [a1, c1, e]).map((x) => x.p);
  const hH = hi[hi.length - 1], hP = hi[hi.length - 2], lH = lo[lo.length - 1], lP = lo[lo.length - 2];
  /* сүүлийн swing 3 цагаас хуучин бол загвар «идэвхгүй» — зөвхөн суваг шалгана */
  if (k - e.i <= 12) {
    if (hi.length === 3 && hi[1] > Math.max(hi[0], hi[2]) + 0.5 * a && Math.abs(hi[0] - hi[2]) <= a && p < Math.min(lo[0], lo[1])) return [-1, "Толгой-мөр"];
    if (lo.length === 3 && lo[1] < Math.min(lo[0], lo[2]) - 0.5 * a && Math.abs(lo[0] - lo[2]) <= a && p > Math.max(hi[0], hi[1])) return [1, "Урвуу толгой-мөр"];
    /* давхар: хоёр ёроол/оргилын хоорондох хүзүүг эвдэх */
    if (Math.abs(lH - lP) <= 0.4 * a && p > (e.hi ? hP : hH)) return [1, "Давхар ёроол"];
    if (Math.abs(hH - hP) <= 0.4 * a && p < (e.hi ? lH : lP)) return [-1, "Давхар оргил"];
    const flatH = Math.abs(hH - hP) <= 0.4 * a, flatL = Math.abs(lH - lP) <= 0.4 * a, upH = hH > hP + 0.2 * a, dnH = hH < hP - 0.2 * a, upL = lH > lP + 0.2 * a, dnL = lH < lP - 0.2 * a;
    /* гурвалжин: эвдрэх чиглэлд */
    if ((flatH && upL) || (dnH && upL) || (dnH && flatL)) { if (p > hH) return [1, flatH ? "Өгсөх гурвалжин" : "Гурвалжин эвдрэл"]; if (p < lH) return [-1, flatL ? "Уруудах гурвалжин" : "Гурвалжин эвдрэл"]; }
    /* шаантаг: эсрэг чиглэлд */
    if (upH && upL && lH - lP > hH - hP && p < lH) return [-1, "Өгсөх шаантаг"];
    if (dnH && dnL && hP - hH > lP - lH && p > hH) return [1, "Уруудах шаантаг"];
    /* туг: ≥4 ATR шон + ≤50% буцалт, шонгийн оргилыг эвдэх */
    const leg = e.p - d1.p, pole = d1.p - c1.p;
    if (Math.abs(pole) >= 4 * a && Math.sign(leg) === -Math.sign(pole) && Math.abs(leg) <= 0.5 * Math.abs(pole)) {
      if (pole > 0 && p > d1.p) return [1, "Өгсөх туг"];
      if (pole < 0 && p < d1.p) return [-1, "Уруудах туг"];
    }
  }
  /* суваг */
  if (c.r2q[k] >= 0.7) return [Math.sign(c.slq[k]) * 0.5, c.slq[k] > 0 ? "Өгсөх суваг" : "Уруудах суваг"];
  return [0, ""];
}

/* ── 2. загвар ба момент ── */
function pattern(c: ScanCtx, j: number): ScanResult {
  const { votes, add } = collect(c), k = c.q[j], h = c.h[j], f = c.f[j], d = c.d[j], p = c.c[j], a = c.aq[k], m = c.mdq;
  const hist = m.hist[k], prev = m.hist[k - 1];
  add("hist", "MACD хистограм (M15)", hist > 0 && hist > prev ? 1 : hist < 0 && hist < prev ? -1 : 0, () => (hist > prev ? "өсөж" : "буурч"));
  const cross = (i: number) => sg(m.line[i] - m.signal[i]) - sg(m.line[i - 1] - m.signal[i - 1]);
  const cr = cross(k) || cross(k - 1);
  add("cross", "MACD огтлолцол", sg(cr), () => (cr > 0 ? "дээш огтолсон" : cr < 0 ? "доош огтолсон" : "огтлолцоогүй"));
  const z = zigzag(c.pq, k, 3, 7);
  /* зөрөлт: үнэ шинэ нам/өндөр, MACD үгүй */
  let div = 0;
  const lows = z.filter((x) => !x.hi).slice(-2), highs = z.filter((x) => x.hi).slice(-2);
  if (lows.length === 2 && k - lows[1].i <= 20 && lows[1].p < lows[0].p && m.line[lows[1].i] > m.line[lows[0].i]) div = 1;
  else if (highs.length === 2 && k - highs[1].i <= 20 && highs[1].p > highs[0].p && m.line[highs[1].i] < m.line[highs[0].i]) div = -1;
  add("div", "MACD зөрөлт", div, () => (div > 0 ? "өсөх зөрөлт" : div < 0 ? "унах зөрөлт" : "алга"));
  /* Фибоначчи 23.6–61.8% буцалт */
  let fib = 0, fr = NaN;
  if (z.length >= 2) {
    const B = z[z.length - 1], A = z[z.length - 2], size = Math.abs(B.p - A.p);
    if (size >= 3 * a) { fr = Math.abs(B.p - p) / size; if (fr >= 0.236 && fr <= 0.618) fib = B.hi ? 1 : -1; }
  }
  add("fib", "Фибоначчи буцалт", fib, () => (Number.isFinite(fr) ? `${(fr * 100).toFixed(0)}%` : "хөл алга"));
  /* S/R: swing дээр тулж эргэх */
  const bq = c.m15[k], nearLo = z.some((x) => !x.hi && Math.abs(p - x.p) <= 0.5 * a), nearHi = z.some((x) => x.hi && Math.abs(p - x.p) <= 0.5 * a);
  add("sr", "Дэмжлэг/эсэргүүцэл", nearLo && bq.c > bq.o ? 1 : nearHi && bq.c < bq.o ? -1 : 0, () => (nearLo ? "дэмжлэг дээр" : nearHi ? "эсэргүүцэл дээр" : "дунд"));
  const rq = c.cq[k] - c.cq[k - 12], rh = c.ch[h] - c.ch[h - 6];
  add("mom", "Момент (M15+H1)", sg(rq) === sg(rh) ? sg(rq) : 0, () => `${f2(rq)} · ${f2(rh)}`);
  const mt = (sg(p - c.e20q[k]) + sg(p - c.e20h[h]) + sg(p - c.e20f[f]) + sg(p - c.e20d[d])) / 4;
  add("mtf", "Олон хугацаа (M15–D1)", mt, () => `${Math.round(((mt + 1) / 2) * 4)}/4 дээш`);
  const ma = c.ma30f[f], rising = ma > c.ma30f[f - 3], cf = c.cf[f];
  add("stage", "Weinstein стадий (H4)", cf > ma && rising ? 1 : cf < ma && !rising ? -1 : 0, () => (cf > ma && rising ? "2-р стадий" : cf < ma && !rising ? "4-р стадий" : "шилжилт"));
  /* POC: сүүлийн 24 цагийн эзлэхүүний оргил */
  const prof = new Map<number, number>();
  for (let q = Math.max(0, j - 287); q <= j; q++) { const b = c.m5[q], key = Math.round((b.h + b.l + b.c) / 3); prof.set(key, (prof.get(key) || 0) + b.v); }
  let poc = p, mx = -1; prof.forEach((v, key) => { if (v > mx) { mx = v; poc = key; } });
  add("poc", "Volume profile POC", p > poc + 0.5 * c.a5[j] ? 0.5 : p < poc - 0.5 * c.a5[j] ? -0.5 : 0, () => `POC ${poc}`);
  const [pv, pn] = chartPattern(c, k);
  add("pat", "Графикийн загвар", pv, () => pn || "тодорхой загвар алга");
  return finish("pattern", votes, 4);
}

function keyLevels(c: ScanCtx, h: number) {
  let v = c.levels.get(h);
  if (v) return v;
  const a = c.ah[h], ps: number[] = [];
  for (let q = c.ph.length - 1; q >= 0; q--) { const x = c.ph[q]; if (x.i + 3 > h) continue; if (x.i < h - 200) break; ps.push(x.p); }
  ps.sort((x, y) => x - y);
  v = [];
  for (const p of ps) { const g = v[v.length - 1]; if (g && p - g.p <= 0.4 * a) { g.p = (g.p * g.n + p) / (g.n + 1); g.n++; } else v.push({ p, n: 1 }); }
  v = v.filter((x) => x.n >= 2);
  c.levels.set(h, v);
  return v;
}

/* ── 3. түвшин ба гармоник ── */
function levels(c: ScanCtx, j: number): ScanResult {
  const { votes, add } = collect(c), k = c.q[j], h = c.h[j], d = c.d[j], b = c.m5[j], p = c.c[j], a = c.a5[j], aq = c.aq[k];
  const lv = keyLevels(c, h);
  const sup = lv.filter((x) => x.p < p).pop(), res = lv.find((x) => x.p > p);
  const bull = b.c > b.o, bear = b.c < b.o, tol = 0.6 * a;
  let brk = 0;
  for (const x of lv) { if (c.c[j - 3] < x.p && p > x.p + 0.2 * a) brk = 1; if (c.c[j - 3] > x.p && p < x.p - 0.2 * a) brk = -1; }
  add("key", "Гол түвшин (ойртох)", sup && p - sup.p <= tol && bull ? 1 : res && res.p - p <= tol && bear ? -1 : 0, () => `${sup ? f2(sup.p) : "—"} / ${res ? f2(res.p) : "—"}`);
  add("break", "Гол түвшин (эвдрэх)", brk, () => (brk > 0 ? "дээш эвдэрсэн" : brk < 0 ? "доош эвдэрсэн" : "эвдрэлгүй"));
  const dB = c.d1[d], P = (dB.h + dB.l + dB.c) / 3, R1 = 2 * P - dB.l, S1 = 2 * P - dB.h;
  add("pivot", "Өдрийн пивот", Math.abs(p - S1) <= tol && bull ? 1 : Math.abs(p - R1) <= tol && bear ? -1 : p > P ? 0.3 : -0.3, () => `P ${f2(P)} · R1 ${f2(R1)} · S1 ${f2(S1)}`);
  add("pd", "Өчигдрийн H/L эвдрэл", p > dB.h + 0.1 * a ? 1 : p < dB.l - 0.1 * a ? -1 : 0, () => `${f2(dB.l)} – ${f2(dB.h)}`);
  /* H1 Фибоначчи */
  const zh = zigzag(c.ph, h, 3, 3);
  let fv = 0, fr = NaN;
  if (zh.length >= 2) { const B = zh[zh.length - 1], A = zh[zh.length - 2], sz = Math.abs(B.p - A.p); if (sz >= 2 * c.ah[h]) { fr = Math.abs(B.p - p) / sz; if (fr >= 0.382 && fr <= 0.618) fv = B.hi ? 1 : -1; } }
  add("fibh", "Фибоначчи (H1)", fv, () => (Number.isFinite(fr) ? `${(fr * 100).toFixed(0)}%` : "хөл алга"));
  /* ABCD ба Gartley/Butterfly: сүүлийн цэг саяхан бол эргэлт */
  const z = zigzag(c.pq, k, 3, 6);
  let har = 0, hn = "";
  if (z.length >= 4 && k - z[z.length - 1].i <= 6) {
    const D = z[z.length - 1], C = z[z.length - 2], B = z[z.length - 3], A = z[z.length - 4];
    const AB = Math.abs(B.p - A.p), BC = Math.abs(C.p - B.p), CD = Math.abs(D.p - C.p), ratio = CD / (AB || 1), rb = BC / (AB || 1);
    if (AB >= 2 * aq && ratio >= 0.8 && ratio <= 1.25 && rb >= 0.382 && rb <= 0.886) { har = D.hi ? -1 : 1; hn = "ABCD"; }
    if (z.length >= 5) {
      const X = z[z.length - 5], XA = Math.abs(A.p - X.p), ab = AB / (XA || 1), ad = Math.abs(D.p - A.p) / (XA || 1);
      if (XA >= 3 * aq && rb >= 0.382 && rb <= 0.886) {
        if (ab >= 0.55 && ab <= 0.68 && ad >= 0.72 && ad <= 0.85) { har = D.hi ? -1 : 1; hn = "Gartley"; }
        else if (ab >= 0.74 && ab <= 0.84 && ad >= 1.2 && ad <= 1.35) { har = D.hi ? -1 : 1; hn = "Butterfly"; }
      }
    }
  }
  add("har", "Гармоник", har, () => hn || "алга");
  /* тэгш өнцөгт: M15 24 лаа, зах бүрт ≥2 хүрэлт */
  let hi = -Infinity, lo = Infinity;
  for (let q = k - 23; q <= k; q++) { hi = Math.max(hi, c.m15[q].h); lo = Math.min(lo, c.m15[q].l); }
  let th = 0, tl = 0;
  for (let q = k - 23; q <= k; q++) { if (hi - c.m15[q].h <= 0.3 * aq) th++; if (c.m15[q].l - lo <= 0.3 * aq) tl++; }
  const rect = th >= 2 && tl >= 2 && hi - lo <= 8 * aq;
  add("rect", "Тэгш өнцөгт", rect && p - lo <= tol && bull ? 1 : rect && hi - p <= tol && bear ? -1 : 0, () => (rect ? `${f2(lo)} – ${f2(hi)}` : "алга"));
  return finish("levels", votes, 3);
}

/* ── 4. SMC ── */
function smc(c: ScanCtx, j: number): ScanResult {
  const { votes, add } = collect(c), k = c.q[j], d = c.d[j], m = c.m5, b = m[j], p = c.c[j], a = c.a5[j];
  add("bos5", "BOS (M5)", c.bos5.age[j] <= 24 ? c.bos5.dir[j] : 0, () => (c.bos5.dir[j] > 0 ? "дээш" : "доош"));
  add("bos15", "BOS (M15)", c.bos15.age[k] <= 24 ? c.bos15.dir[k] : 0, () => (c.bos15.dir[k] > 0 ? "дээш" : "доош"));
  add("choch", "CHoCH (бүтэц эргэлт)", c.bos5.age[j] <= 6 ? c.bos5.dir[j] : 0, () => (c.bos5.age[j] <= 6 ? `${c.bos5.age[j] * 5} мин өмнө` : "алга"));
  let sw = 0;
  for (let q = j; q >= j - 2 && !sw; q--) {
    let hi = -Infinity, lo = Infinity;
    for (let r = q - 20; r < q; r++) { hi = Math.max(hi, m[r].h); lo = Math.min(lo, m[r].l); }
    if (m[q].h > hi && m[q].c < hi) sw = -1; else if (m[q].l < lo && m[q].c > lo) sw = 1;
  }
  add("sweep", "Liquidity sweep", sw, () => (sw > 0 ? "ёроол шүүрдэгдсэн" : sw < 0 ? "оргил шүүрдэгдсэн" : "алга"));
  const dB = c.d1[d], r = c.asia.get(Math.floor(b.t / 864e5));
  const hiL = [dB.h, ...(r && Number.isFinite(r.hi) ? [r.hi] : [])], loL = [dB.l, ...(r && Number.isFinite(r.lo) ? [r.lo] : [])];
  const skey = hiL.some((x) => b.h > x && b.c < x) ? -1 : loL.some((x) => b.l < x && b.c > x) ? 1 : 0;
  add("skey", "PDH/PDL·Ази шүүрдэлт", skey, () => (skey ? "хөрвөх чадвар авсан" : "алга"));
  /* FVG руу буцаж хүрэх */
  let fvg = 0;
  for (let q = j - 1; q >= Math.max(2, j - 20) && !fvg; q--) {
    if (m[q].l > m[q - 2].h) { const t = m[q].l, bt = m[q - 2].h; let lo = Infinity; for (let x = q + 1; x < j; x++) lo = Math.min(lo, m[x].l); if (lo > bt && b.l <= t && b.c >= bt) fvg = 1; }
    else if (m[q].h < m[q - 2].l) { const bt = m[q].h, t = m[q - 2].l; let hi = -Infinity; for (let x = q + 1; x < j; x++) hi = Math.max(hi, m[x].h); if (hi < t && b.h >= bt && b.c <= t) fvg = -1; }
  }
  add("fvg", "FVG дахин тест", fvg, () => (fvg > 0 ? "өсөх FVG дээр" : fvg < 0 ? "унах FVG дээр" : "алга"));
  /* order block: хүчтэй хөдөлгөөний өмнөх эсрэг лаа, хүрч ирээд хадгалж байна */
  let ob = 0;
  for (let q = j - 4; q >= Math.max(1, j - 30) && !ob; q--) {
    const body = m[q + 1].c + m[q + 2].c + m[q + 3].c - m[q + 1].o - m[q + 2].o - m[q + 3].o;
    if (m[q].c < m[q].o && body >= 1.5 * a) { let lo = Infinity; for (let x = q + 1; x < j; x++) lo = Math.min(lo, m[x].l); if (lo >= m[q].l && b.l <= m[q].h && b.c > m[q].l) ob = 1; }
    else if (m[q].c > m[q].o && body <= -1.5 * a) { let hi = -Infinity; for (let x = q + 1; x < j; x++) hi = Math.max(hi, m[x].h); if (hi <= m[q].h && b.h >= m[q].l && b.c < m[q].h) ob = -1; }
  }
  add("ob", "Order block", ob, () => (ob > 0 ? "эрэлтийн блок" : ob < 0 ? "нийлүүлэлтийн блок" : "алга"));
  const z = zigzag(c.pq, k, 3, 2);
  let pos = NaN;
  if (z.length === 2) { const hi = Math.max(z[0].p, z[1].p), lo = Math.min(z[0].p, z[1].p); if (hi > lo) pos = (p - lo) / (hi - lo); }
  add("pd", "Premium/Discount", pos < 0.45 && c.bos15.dir[k] > 0 ? 1 : pos > 0.55 && c.bos15.dir[k] < 0 ? -1 : 0, () => (Number.isFinite(pos) ? `${(pos * 100).toFixed(0)}%` : "—"));
  const dis = (c.c[j] - m[j - 2].o) / a, same = sg(m[j].c - m[j].o) === sg(m[j - 1].c - m[j - 1].o) && sg(m[j - 1].c - m[j - 1].o) === sg(m[j - 2].c - m[j - 2].o);
  add("disp", "Displacement", same && Math.abs(dis) >= 1.5 ? sg(dis) : 0, () => `${dis.toFixed(1)} ATR`);
  return finish("smc", votes, 3);
}

/* ── 5. тренд ба DXY ── */
function macro(c: ScanCtx, j: number): ScanResult {
  const { votes, add } = collect(c), h = c.h[j], f = c.f[j], d = c.d[j], p = c.c[j], b = c.m5[j];
  const t1 = (c.e20h[h] - c.e50h[h]) / c.ah[h], t4 = (c.e20f[f] - c.e50f[f]) / c.af[f], td = (p - c.e20d[d]) / c.ad[d];
  add("h1", "Тренд H1", cl(t1), () => t1.toFixed(2));
  add("h4", "Тренд H4", cl(t4), () => t4.toFixed(2));
  add("d1", "Тренд D1", cl(td), () => td.toFixed(2));
  const z6 = c.dz6[j], z24 = c.dz24[j];
  add("dxy6", "DXY 30 мин", -cl(z6 / 2), () => (Number.isFinite(z6) ? `${z6 > 0 ? "+" : ""}${z6.toFixed(1)}σ` : "—"));
  add("dxy24", "DXY 2 цаг", -cl(z24 / 2), () => (Number.isFinite(z24) ? `${z24 > 0 ? "+" : ""}${z24.toFixed(1)}σ` : "—"));
  const r = c.asia.get(Math.floor(b.t / 864e5)), after = r && c.T[j] > r.end && Number.isFinite(r.hi);
  add("asia", "Сешний эвдрэл", after && p > r!.hi ? 1 : after && p < r!.lo ? -1 : 0, () => (after ? `Ази ${f2(r!.lo)}–${f2(r!.hi)}` : "Азийн сешн"));
  return finish("macro", votes, 4);
}

export const scanAll = (c: ScanCtx, j: number): ScanResult[] => [committee(c, j), pattern(c, j), levels(c, j), smc(c, j), macro(c, j)];

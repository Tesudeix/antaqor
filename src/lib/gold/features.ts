import {
  type Bar, ema, atr, rsi, adx, er, boll, keltner, stoch, willr, cci, macd, supertrend, slope, rsq, obv, mfi, cmf,
  hull, kama, aroon, donchPos, vortex, trix, fisher, ultimate, chop, hurstAt, pctRank,
} from "../scalp/ind";
import { aggregate, local } from "../scalp/engine";

/* ─── Tesla Trader · XAU/USD онцлогийн хөдөлгүүр (2026-11-05) ─────────────────
   M5 лаа бүрийн ХААЛТ дээр ~95 онцлог (feature) — 7 гэр бүл, 6 хугацаа (M1·M5·M15·H1·H4·D1) + DXY.
   Зарчим: зөвхөн тухайн мөчид бүрэн хаагдсан лааг ашиглана (ирээдүй харахгүй) — сургалт ба бодит цаг
   НЭГ функцээр тооцогдоно. Онцлог бүр «өсөхөд эерэг» чиглэлтэй; аль нь момент, аль нь буцалт болохыг
   модель (model.ts) өгөгдлөөс IC-ээр сурна. Чиглэлгүй (хэлбэлзэл, горим) онцлог нь горимыг тодорхойлно. */

export type Fam = "trend" | "mom" | "loc" | "struct" | "flow" | "macro" | "inter";
export const FAM_MN: Record<Fam, string> = { trend: "Тренд", mom: "Момент", loc: "Байршил", struct: "Бүтэц", flow: "Урсгал", macro: "Макро (DXY)", inter: "Горимын хослол" };
export type FeatDef = { key: string; fam: Fam; mn: string };
export type GoldData = { m1: Bar[]; h1: Bar[]; d1: Bar[]; dxy: Map<number, number> };
export type Sample = {
  t: number; c: number; a5: number; regime: 0 | 1; session: string; m1i: number; y: number; swingLo: number; swingHi: number;
  /** хэлбэлзлийн таамагт: дараагийн 30 минутын хүрээ, дээш/доош хамгийн их зай ($), сүүлийн 30 мин ба 2 цагийн хүрээ */
  rng: number; up: number; dn: number; r6: number; r24: number;
};
export type FeatureSet = { defs: FeatDef[]; X: Float64Array[]; S: Sample[]; m5: Bar[]; m1: Bar[]; ctx: Ctx };
type Ctx = { vwap: number[]; e20: number[]; e50: number[]; asia: Map<number, { hi: number; lo: number; end: number }>; adx: number[]; er: number[]; atrPct: number[]; chop: number[]; hurst: (j: number) => number; pdh: number[]; pdl: number[]; adr: number[] };

const H = 6;                                   /* таамаглах хугацаа: 6 × M5 = 30 мин */
const cl = (x: number, a = 4) => (Number.isFinite(x) ? Math.max(-a, Math.min(a, x)) : NaN);

/** M5 хаалтын мөч бүрт бүрэн хаагдсан том лааны индекс */
function mapTo(times: number[], big: Bar[], w: number): Int32Array {
  const out = new Int32Array(times.length).fill(-1);
  let k = -1;
  times.forEach((T, j) => { while (k + 1 < big.length && big[k + 1].t + w <= T) k++; out[j] = k; });
  return out;
}

export function sessionOf(t: number) {
  const lo = local("Europe/London", t), ny = local("America/New_York", t);
  if (ny.min >= 1020 && ny.min < 1080) return "rollover";
  if (lo.min >= 480 && ny.min < 480) return "london";
  if (ny.min >= 480 && ny.min < 810) return "ny";
  if (ny.min >= 810 && ny.min < 1020) return "late";
  return "asia";
}
export const SESSION_MN: Record<string, string> = { asia: "Ази", london: "London", ny: "New York", late: "NY орой", rollover: "Rollover" };

export function computeFeatures(D: GoldData, opt: { onlyLast?: number } = {}): FeatureSet {
  const m1 = D.m1;
  /* M5: зөвхөн 5 минут нь бүрэн бүрдсэн лаа (сүүлийн үүсч буй лааг хасна) */
  let m5 = aggregate(m1, 5);
  const last1 = m1[m1.length - 1];
  if (m5.length && last1 && m5[m5.length - 1].t + 4 * 60000 > last1.t) m5 = m5.slice(0, -1);
  const m15 = aggregate(m1, 15), h1 = D.h1, h4 = aggregate(h1, 240), d1 = D.d1;
  const T = m5.map((b) => b.t + 300000);
  const i15 = mapTo(T, m15, 900000), ih = mapTo(T, h1, 3600000), i4 = mapTo(T, h4, 14400000), id = mapTo(T, d1, 86400000);
  const i1 = mapTo(T, m1, 60000);

  /* ── цуваа ── */
  const c1 = m1.map((b) => b.c), rsi7_1 = rsi(c1, 7), a1 = atr(m1, 14);
  const c5 = m5.map((b) => b.c), a5 = atr(m5, 14), ad5 = adx(m5, 14), er5 = er(c5, 12), bb5 = boll(c5, 20, 2), kc5 = keltner(m5, 20, 1.5);
  const e9 = ema(c5, 9), e20 = ema(c5, 20), e21 = ema(c5, 21), e50 = ema(c5, 50), e200 = ema(c5, 200);
  const md5 = macd(c5).hist, mdb = macd(c5, 5, 35, 5).hist, st5 = supertrend(m5, 10, 3).dir, sl5 = slope(c5, 20), r25 = rsq(c5, 20);
  const hu5 = hull(c5, 21), ka5 = kama(c5, 10), r14 = rsi(c5, 14), r7 = rsi(c5, 7), r21 = rsi(c5, 21), s14 = stoch(m5, 14, 3), s5 = stoch(m5, 5, 3);
  const cc5 = cci(m5, 20), wr5 = willr(m5, 14), tx5 = trix(c5, 15), fi5 = fisher(m5, 10), uo5 = ultimate(m5), ch5 = chop(m5, 14), dc5 = donchPos(m5, 20);
  const cm5 = cmf(m5, 20), ob5 = obv(m5), mf5 = mfi(m5, 14), bbw = bb5.sd.map((s, j) => (bb5.mid[j] ? s / bb5.mid[j] : NaN));
  const c15 = m15.map((b) => b.c), e9q = ema(c15, 9), e21q = ema(c15, 21), e20q = ema(c15, 20), a15 = atr(m15, 14), ad15 = adx(m15, 14), st15 = supertrend(m15, 10, 3).dir;
  const sl15 = slope(c15, 20), r2q = rsq(c15, 20), r14q = rsi(c15, 14), md15 = macd(c15).hist, s14q = stoch(m15, 14, 3), cc15 = cci(m15, 20), ar15 = aroon(m15, 25), vx15 = vortex(m15, 14);
  const bb15 = boll(c15, 20, 2), dc55 = donchPos(m15, 55);
  const ch = h1.map((b) => b.c), e20h = ema(ch, 20), e50h = ema(ch, 50), e200h = ema(ch, 200), ah = atr(h1, 14), adh = adx(h1, 14), sth = supertrend(h1, 10, 3).dir, rsh = rsi(ch, 14), mdh = macd(ch).hist;
  const c4 = h4.map((b) => b.c), e20f = ema(c4, 20), e50f = ema(c4, 50), a4 = atr(h4, 14);
  const cd = d1.map((b) => b.c), e20d = ema(cd, 20), ad = atr(d1, 14);
  const atrPct = a5.map((_, j) => pctRank(a5, j, 288));

  /* Heikin-Ashi өнгөний дараалал (M5) */
  const ha: number[] = [];
  { let ho = m5[0]?.o ?? 0, hc = m5[0]?.c ?? 0, streak = 0;
    m5.forEach((b, j) => { const nc = (b.o + b.h + b.l + b.c) / 4, no = j ? (ho + hc) / 2 : b.o; const col = nc >= no ? 1 : -1; streak = Math.sign(streak) === col ? streak + col : col; ho = no; hc = nc; ha.push(Math.max(-5, Math.min(5, streak)) / 5); }); }
  /* Ichimoku tenkan−kijun (M15) */
  const hl = (k: number, n: number) => { let hi = -Infinity, lo = Infinity; for (let q = Math.max(0, k - n + 1); q <= k; q++) { hi = Math.max(hi, m15[q].h); lo = Math.min(lo, m15[q].l); } return (hi + lo) / 2; };
  /* өдрийн VWAP (тикийн эзлэхүүн), өдрийн өндөр/нам, Азийн хүрээ */
  const vwap: number[] = [], vsd: number[] = [], dHi: number[] = [], dLo: number[] = [];
  const asia = new Map<number, { hi: number; lo: number; end: number }>();
  { let day = -1, sw = 0, spv = 0, sp2 = 0, hi = -Infinity, lo = Infinity;
    m5.forEach((b) => {
      const d = Math.floor(b.t / 864e5);
      if (d !== day) { day = d; sw = 0; spv = 0; sp2 = 0; hi = -Infinity; lo = Infinity; }
      const p = (b.h + b.l + b.c) / 3, w = Math.max(b.v, 1e-6);
      sw += w; spv += p * w; sp2 += p * p * w; hi = Math.max(hi, b.h); lo = Math.min(lo, b.l);
      const m = spv / sw; vwap.push(m); vsd.push(Math.sqrt(Math.max(0, sp2 / sw - m * m))); dHi.push(hi); dLo.push(lo);
      if (local("Europe/London", b.t).min < 480) {
        let r = asia.get(d);
        if (!r) { r = { hi: -Infinity, lo: Infinity, end: 0 }; asia.set(d, r); }
        r.hi = Math.max(r.hi, b.h); r.lo = Math.min(r.lo, b.l); r.end = b.t + 300000;
      }
    }); }
  /* бүтэц: баталгаажсан swing (k=2 → 2 лааны дараа баталгаажна), BOS-ийн төлөв (сулрах) */
  const bos = (bars: Bar[]) => {
    const out: number[] = new Array(bars.length).fill(0);
    let sh = NaN, slw = NaN, s = 0;
    for (let j = 0; j < bars.length; j++) {
      const p = j - 2;
      if (p >= 2) {
        if (bars[p].h >= Math.max(bars[p - 1].h, bars[p - 2].h, bars[p + 1].h, bars[p + 2].h)) sh = bars[p].h;
        if (bars[p].l <= Math.min(bars[p - 1].l, bars[p - 2].l, bars[p + 1].l, bars[p + 2].l)) slw = bars[p].l;
      }
      if (bars[j].c > sh) { s = 1; sh = Infinity; } else if (bars[j].c < slw) { s = -1; slw = -Infinity; } else s *= 0.9;
      out[j] = s;
    }
    return out;
  };
  const bos5 = bos(m5), bos15 = bos(m15);
  /* DXY (синтетик, M5) — алтны M5 цагт тааруулж, сүүлийн мэдэгдэх утгаар дүүргэнэ */
  const dx: number[] = []; { let last = NaN; m5.forEach((b) => { const v = D.dxy.get(b.t); if (v !== undefined) last = v; dx.push(last); }); }
  const lr = (a: number[], j: number, n: number) => (j >= n ? Math.log(a[j] / a[j - n]) : NaN);
  const rollZ = (f: (j: number) => number) => {
    const raw = m5.map((_, j) => f(j)), out: number[] = new Array(m5.length).fill(NaN);
    for (let j = 300; j < raw.length; j++) {
      let s = 0, s2 = 0, n = 0;
      for (let k = j - 288; k < j; k++) { const x = raw[k]; if (Number.isFinite(x)) { s += x; s2 += x * x; n++; } }
      if (n > 50 && Number.isFinite(raw[j])) { const m = s / n, sd = Math.sqrt(Math.max(1e-18, s2 / n - m * m)); out[j] = (raw[j] - m) / sd; }
    }
    return out;
  };
  const dz6 = rollZ((j) => lr(dx, j, 6)), dz24 = rollZ((j) => lr(dx, j, 24)), gz6 = rollZ((j) => lr(c5, j, 6));
  const corr48 = (j: number) => {
    if (j < 50) return NaN;
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, n = 0;
    for (let k = j - 47; k <= j; k++) { const x = Math.log(c5[k] / c5[k - 1]), y = Math.log(dx[k] / dx[k - 1]); if (!Number.isFinite(x) || !Number.isFinite(y)) continue; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; n++; }
    const cv = n * sxy - sx * sy, vx = n * sxx - sx * sx, vy = n * syy - sy * sy;
    return n > 20 && vx > 0 && vy > 0 ? cv / Math.sqrt(vx * vy) : NaN;
  };

  /* ── онцлогийн тодорхойлолт: [түлхүүр, гэр бүл, монгол нэр, функц(j)] ── */
  type Def = [string, Fam, string, (j: number) => number];
  const A = (j: number) => a5[j], q = (j: number) => i15[j], h = (j: number) => ih[j], f4 = (j: number) => i4[j], dd = (j: number) => id[j];
  const defs: Def[] = [
    ["ema9_21_m5", "trend", "EMA 9/21 (M5)", (j) => (e9[j] - e21[j]) / A(j)],
    ["ema21_50_m5", "trend", "EMA 21/50 (M5)", (j) => (e21[j] - e50[j]) / A(j)],
    ["ema20_slope_m5", "trend", "EMA20 налуу (M5)", (j) => (e20[j] - e20[j - 3]) / A(j)],
    ["px_ema200_m5", "trend", "Үнэ − EMA200 (M5)", (j) => (c5[j] - e200[j]) / A(j)],
    ["ema9_21_m15", "trend", "EMA 9/21 (M15)", (j) => (e9q[q(j)] - e21q[q(j)]) / a15[q(j)]],
    ["ema20_slope_m15", "trend", "EMA20 налуу (M15)", (j) => (e20q[q(j)] - e20q[q(j) - 3]) / a15[q(j)]],
    ["ema20_50_h1", "trend", "EMA 20/50 (H1)", (j) => (e20h[h(j)] - e50h[h(j)]) / ah[h(j)]],
    ["ema20_slope_h1", "trend", "EMA20 налуу (H1)", (j) => (e20h[h(j)] - e20h[h(j) - 3]) / ah[h(j)]],
    ["px_ema200_h1", "trend", "Үнэ − EMA200 (H1)", (j) => (c5[j] - e200h[h(j)]) / ah[h(j)]],
    ["ema20_50_h4", "trend", "EMA 20/50 (H4)", (j) => (e20f[f4(j)] - e50f[f4(j)]) / a4[f4(j)]],
    ["px_ema20_d1", "trend", "Үнэ − EMA20 (D1)", (j) => (c5[j] - e20d[dd(j)]) / ad[dd(j)]],
    ["ema20_slope_d1", "trend", "EMA20 налуу (D1)", (j) => (e20d[dd(j)] - e20d[dd(j) - 3]) / ad[dd(j)]],
    ["adx_m5", "trend", "ADX·DI (M5)", (j) => ((ad5.pdi[j] - ad5.mdi[j]) / (ad5.pdi[j] + ad5.mdi[j] || 1)) * Math.min(2, ad5.adx[j] / 25)],
    ["adx_m15", "trend", "ADX·DI (M15)", (j) => ((ad15.pdi[q(j)] - ad15.mdi[q(j)]) / (ad15.pdi[q(j)] + ad15.mdi[q(j)] || 1)) * Math.min(2, ad15.adx[q(j)] / 25)],
    ["adx_h1", "trend", "ADX·DI (H1)", (j) => ((adh.pdi[h(j)] - adh.mdi[h(j)]) / (adh.pdi[h(j)] + adh.mdi[h(j)] || 1)) * Math.min(2, adh.adx[h(j)] / 25)],
    ["st_m5", "trend", "Supertrend (M5)", (j) => st5[j]],
    ["st_m15", "trend", "Supertrend (M15)", (j) => st15[q(j)]],
    ["st_h1", "trend", "Supertrend (H1)", (j) => sth[h(j)]],
    ["linreg_m5", "trend", "Регресс налуу×R² (M5)", (j) => ((sl5[j] * 20) / A(j)) * r25[j]],
    ["linreg_m15", "trend", "Регресс налуу×R² (M15)", (j) => ((sl15[q(j)] * 20) / a15[q(j)]) * r2q[q(j)]],
    ["hull_m5", "trend", "Hull MA налуу (M5)", (j) => (hu5[j] - hu5[j - 2]) / A(j)],
    ["kama_m5", "trend", "KAMA налуу (M5)", (j) => (ka5[j] - ka5[j - 3]) / A(j)],
    ["aroon_m15", "trend", "Aroon (M15)", (j) => ar15[q(j)] / 100],
    ["vortex_m15", "trend", "Vortex (M15)", (j) => vx15[q(j)]],
    ["ha_m5", "trend", "Heikin-Ashi дараалал (M5)", (j) => ha[j]],
    ["ichi_m15", "trend", "Ichimoku tenkan−kijun (M15)", (j) => (hl(q(j), 9) - hl(q(j), 26)) / a15[q(j)]],

    ["rsi7_m1", "mom", "RSI 7 (M1)", (j) => (rsi7_1[i1[j]] - 50) / 50],
    ["rsi7_m5", "mom", "RSI 7 (M5)", (j) => (r7[j] - 50) / 50],
    ["rsi14_m5", "mom", "RSI 14 (M5)", (j) => (r14[j] - 50) / 50],
    ["rsi21_m5", "mom", "RSI 21 (M5)", (j) => (r21[j] - 50) / 50],
    ["rsi14_m15", "mom", "RSI 14 (M15)", (j) => (r14q[q(j)] - 50) / 50],
    ["rsi14_h1", "mom", "RSI 14 (H1)", (j) => (rsh[h(j)] - 50) / 50],
    ["macd_m5", "mom", "MACD 12/26/9 (M5)", (j) => md5[j] / A(j)],
    ["macd535_m5", "mom", "MACD 5/35/5 (M5)", (j) => mdb[j] / A(j)],
    ["macd_m15", "mom", "MACD (M15)", (j) => md15[q(j)] / a15[q(j)]],
    ["macd_h1", "mom", "MACD (H1)", (j) => mdh[h(j)] / ah[h(j)]],
    ["stoch14_m5", "mom", "Stochastic 14 (M5)", (j) => (s14[j] - 50) / 50],
    ["stoch5_m5", "mom", "Stochastic 5 (M5)", (j) => (s5[j] - 50) / 50],
    ["stoch14_m15", "mom", "Stochastic 14 (M15)", (j) => (s14q[q(j)] - 50) / 50],
    ["cci_m5", "mom", "CCI 20 (M5)", (j) => cc5[j] / 100],
    ["cci_m15", "mom", "CCI 20 (M15)", (j) => cc15[q(j)] / 100],
    ["wr_m5", "mom", "Williams %R (M5)", (j) => (wr5[j] + 50) / 50],
    ["ret1_m5", "mom", "Өгөөж 5 мин", (j) => (c5[j] - c5[j - 1]) / A(j)],
    ["ret3_m5", "mom", "Өгөөж 15 мин", (j) => (c5[j] - c5[j - 3]) / A(j)],
    ["ret6_m5", "mom", "Өгөөж 30 мин", (j) => (c5[j] - c5[j - 6]) / A(j)],
    ["ret12_m5", "mom", "Өгөөж 1 цаг", (j) => (c5[j] - c5[j - 12]) / A(j)],
    ["ret24_m5", "mom", "Өгөөж 2 цаг", (j) => (c5[j] - c5[j - 24]) / A(j)],
    ["ret4_h1", "mom", "Өгөөж 4 цаг (H1)", (j) => (c5[j] - ch[h(j) - 3]) / ah[h(j)]],
    ["trix_m5", "mom", "TRIX 15 (M5)", (j) => tx5[j]],
    ["fisher_m5", "mom", "Fisher (M5)", (j) => fi5[j]],
    ["uo_m5", "mom", "Ultimate osc (M5)", (j) => (uo5[j] - 50) / 50],
    ["mom5_m1", "mom", "Момент 5 мин (M1)", (j) => (c1[i1[j]] - c1[i1[j] - 5]) / a1[i1[j]]],

    ["zvwap", "loc", "VWAP-аас σ", (j) => (vsd[j] ? (c5[j] - vwap[j]) / vsd[j] : 0)],
    ["bb_m5", "loc", "Bollinger %B (M5)", (j) => (c5[j] - bb5.lo[j]) / (bb5.up[j] - bb5.lo[j] || 1) - 0.5],
    ["bb_m15", "loc", "Bollinger %B (M15)", (j) => (c15[q(j)] - bb15.lo[q(j)]) / (bb15.up[q(j)] - bb15.lo[q(j)] || 1) - 0.5],
    ["stretch_m5", "loc", "EMA20-оос сунасан (M5)", (j) => (c5[j] - e20[j]) / A(j)],
    ["keltner_m5", "loc", "Keltner байрлал (M5)", (j) => (c5[j] - (kc5.up[j] + kc5.lo[j]) / 2) / ((kc5.up[j] - kc5.lo[j]) / 2 || 1)],
    ["donch20_m5", "loc", "Donchian 20 (M5)", (j) => dc5[j]],
    ["donch55_m15", "loc", "Donchian 55 (M15)", (j) => dc55[q(j)]],
    ["pdh", "loc", "Өчигдрийн оргилоос", (j) => (c5[j] - d1[dd(j)].h) / ad[dd(j)]],
    ["pdl", "loc", "Өчигдрийн ёроолоос", (j) => (c5[j] - d1[dd(j)].l) / ad[dd(j)]],
    ["daypos", "loc", "Өнөөдрийн хүрээнд байрлал", (j) => (dHi[j] > dLo[j] ? (c5[j] - dLo[j]) / (dHi[j] - dLo[j]) - 0.5 : 0)],
    ["asiapos", "loc", "Азийн хүрээнд байрлал", (j) => { const r = asia.get(Math.floor(m5[j].t / 864e5)); return r && T[j] > r.end && r.hi > r.lo ? Math.max(-2, Math.min(2, (c5[j] - (r.hi + r.lo) / 2) / (r.hi - r.lo))) : 0; }],
    ["round10", "loc", "$10 түвшинд байрлал", (j) => ((c5[j] % 10) - 5) / 5],

    ["bos_m5", "struct", "Бүтэц эвдрэл BOS (M5)", (j) => bos5[j]],
    ["bos_m15", "struct", "Бүтэц эвдрэл BOS (M15)", (j) => bos15[q(j)]],
    ["sweep_m5", "struct", "Хөрвөх чадварын «шүүрдэлт»", (j) => {
      for (let p = j; p >= j - 2 && p > 22; p--) {
        let hi = -Infinity, lo = Infinity;
        for (let k = p - 20; k < p; k++) { hi = Math.max(hi, m5[k].h); lo = Math.min(lo, m5[k].l); }
        if (m5[p].h > hi && m5[p].c < hi) return -1;
        if (m5[p].l < lo && m5[p].c > lo) return 1;
      }
      return 0; }],
    ["fvg_m5", "struct", "Нөхөгдөөгүй FVG", (j) => {
      let s = 0;
      for (let p = Math.max(2, j - 20); p <= j; p++) {
        if (m5[p].l > m5[p - 2].h) { let lo = Infinity; for (let k = p + 1; k <= j; k++) lo = Math.min(lo, m5[k].l); if (lo > m5[p - 2].h) s++; }
        if (m5[p].h < m5[p - 2].l) { let hi = -Infinity; for (let k = p + 1; k <= j; k++) hi = Math.max(hi, m5[k].h); if (hi < m5[p - 2].l) s--; }
      }
      return Math.max(-3, Math.min(3, s)); }],
    ["engulf_m5", "struct", "Залгих лаа (M5)", (j) => { const b = m5[j], p = m5[j - 1]; return b.c > b.o && p.c < p.o && b.o <= p.c && b.c >= p.o ? 1 : b.c < b.o && p.c > p.o && b.o >= p.c && b.c <= p.o ? -1 : 0; }],
    ["pin_m5", "struct", "Pin bar (M5)", (j) => { const b = m5[j], r = b.h - b.l, body = Math.abs(b.c - b.o), lw = Math.min(b.o, b.c) - b.l, uw = b.h - Math.max(b.o, b.c); return !r ? 0 : lw >= 2 * body && lw >= 0.6 * r ? 1 : uw >= 2 * body && uw >= 0.6 * r ? -1 : 0; }],
    ["inside_m5", "struct", "Inside bar эвдрэл (M5)", (j) => { const b = m5[j], p = m5[j - 1], pp = m5[j - 2]; return p.h <= pp.h && p.l >= pp.l ? (b.c > p.h ? 1 : b.c < p.l ? -1 : 0) : 0; }],
    ["body_m5", "struct", "Лааны бие (M5)", (j) => { const b = m5[j]; return b.h > b.l ? (b.c - b.o) / (b.h - b.l) : 0; }],

    ["cmf_m5", "flow", "Chaikin money flow", (j) => cm5[j]],
    ["obv_m5", "flow", "OBV налуу", (j) => { let v = 0; for (let k = j - 11; k <= j; k++) v += m5[k].v; return v ? (ob5[j] - ob5[j - 12]) / v : 0; }],
    ["mfi_m5", "flow", "MFI 14", (j) => (mf5[j] - 50) / 50],
    ["volz_m5", "flow", "Эзлэхүүний цочрол × чиглэл", (j) => { let s = 0, s2 = 0; for (let k = j - 20; k < j; k++) { s += m5[k].v; s2 += m5[k].v ** 2; } const m = s / 20, sd = Math.sqrt(Math.max(1e-18, s2 / 20 - m * m)); return ((m5[j].v - m) / sd) * Math.sign(m5[j].c - m5[j].o); }],
    ["delta6_m5", "flow", "Худалдан авалт/зарах даралт", (j) => { let s = 0, v = 0; for (let k = j - 5; k <= j; k++) { const b = m5[k]; if (b.h > b.l) s += ((b.c - b.o) / (b.h - b.l)) * b.v; v += b.v; } return v ? s / v : 0; }],

    ["dxy6", "macro", "DXY 30 мин", (j) => dz6[j]],
    ["dxy24", "macro", "DXY 2 цаг", (j) => dz24[j]],
    ["dxy_div", "macro", "Алт·DXY зөрөлт", (j) => gz6[j] + dz6[j]],
    ["dxy_corr_adj", "macro", "DXY × корреляц", (j) => -dz6[j] * Math.abs(corr48(j))],

    ["ret6_x_er", "inter", "Момент × тренд цэвэр", (j) => ((c5[j] - c5[j - 6]) / A(j)) * er5[j]],
    ["vwap_x_chop", "inter", "VWAP зай × chop", (j) => (vsd[j] ? (c5[j] - vwap[j]) / vsd[j] : 0) * (ch5[j] / 100)],
    ["macd_x_adx", "inter", "MACD × ADX", (j) => (md5[j] / A(j)) * Math.min(2, ad5.adx[j] / 25)],
    ["rsi_x_hurst", "inter", "RSI × Hurst", (j) => ((r14[j] - 50) / 50) * (hurstAt(c1, i1[j], 128) - 0.5) * 4],
    ["bb_x_squeeze", "inter", "Bollinger × шахалт", (j) => ((c5[j] - bb5.lo[j]) / (bb5.up[j] - bb5.lo[j] || 1) - 0.5) * (bb5.up[j] < kc5.up[j] ? 1 : -1)],
  ];

  /* ── дээжүүд ── */
  const start = 300;
  const S: Sample[] = [], cols: number[][] = defs.map(() => []);
  const from = opt.onlyLast ? Math.max(start, m5.length - opt.onlyLast) : start;
  for (let j = from; j < m5.length; j++) {
    if (i15[j] < 60 || ih[j] < 210 || i4[j] < 55 || id[j] < 25 || i1[j] < 200 || !(a5[j] > 0)) continue;
    const ses = sessionOf(T[j]);
    if (ses === "rollover") continue;
    const k = j + H, y = k < m5.length && m5[k].t - m5[j].t <= (H + 3) * 300000 ? (c5[k] - c5[j]) / a5[j] : NaN;
    let lo = Infinity, hi = -Infinity, lo24 = Infinity, hi24 = -Infinity;
    for (let p = j - 5; p <= j; p++) { lo = Math.min(lo, m5[p].l); hi = Math.max(hi, m5[p].h); }
    for (let p = j - 23; p <= j; p++) { lo24 = Math.min(lo24, m5[p].l); hi24 = Math.max(hi24, m5[p].h); }
    let fHi = -Infinity, fLo = Infinity;
    if (Number.isFinite(y)) for (let p = j + 1; p <= k; p++) { fHi = Math.max(fHi, m5[p].h); fLo = Math.min(fLo, m5[p].l); }
    const ok = Number.isFinite(fHi) && Number.isFinite(fLo);
    S.push({ t: T[j], c: c5[j], a5: a5[j], regime: er5[j] >= 0.3 && ad5.adx[j] >= 20 ? 1 : 0, session: ses, m1i: i1[j], y: cl(y, 6), swingLo: lo, swingHi: hi,
      rng: ok ? fHi - fLo : NaN, up: ok ? fHi - c5[j] : NaN, dn: ok ? c5[j] - fLo : NaN, r6: hi - lo, r24: hi24 - lo24 });
    defs.forEach((d, n) => cols[n].push(cl(d[3](j), 50)));
  }
  return {
    defs: defs.map(([key, fam, mn]) => ({ key, fam, mn })), X: cols.map((c) => Float64Array.from(c)), S, m5, m1,
    ctx: { vwap, e20, e50, asia, adx: ad5.adx, er: er5, atrPct, chop: ch5, hurst: (j) => hurstAt(c1, i1[j], 128), pdh: m5.map((_, j) => d1[id[j]]?.h ?? NaN), pdl: m5.map((_, j) => d1[id[j]]?.l ?? NaN), adr: m5.map((_, j) => ad[id[j]] ?? NaN) },
  };
}

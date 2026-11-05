import { type Bar, ema, atr, rsi, adx, er, boll, keltner, stoch, willr, cci, macd, roc, supertrend, slope, obv, mfi, pctRank, neff } from "./ind";

/* ─── Tesla Trader · Scalp хөдөлгүүр (2026-11-04) ─────────────────────────────
   20 жилийн скальперын аксиомууд — код бүр аль нэгийг хэрэгжүүлнэ:
   A1 Зардал эхний дайсан: SL ≥ 5×spread, spread/SL ≤ 0.2R. Үгүй бол арилжаа биш.
   A2 Хөрвөх чадвартай цагт л: London → NY өглөө (JPY/AUD/NZD-д Токио). Rollover, баасан орой, мэдээ = 0.
   A3 Эхлээд горим: тренд / хүрээ / эмх замбараагүй / үхмэл. Горимд таарсан загвар л ажиллана.
   A4 Том хугацаа чиглэл, жижиг нь орох цэг: M15 чиглэл · M5 загвар · M1 гох.
   A5 Байршил > дохио: үнэ цэнийн бүсэд (EMA20, VWAP, хүрээний зах) орно, дундаас биш.
   A6 Индикаторууд нэг үнээс гардаг — бие даасан санал биш. Гэр бүлээр нь нэг удаа тоолно.
   A7 Макро шүүлтүүр: доллартой хос, алтанд DXY эсрэг хүчтэй бол орохгүй.
   A8 Давуу тал итгэл биш, хэмжилт: загвар бүрийг сүүлийн 28 хоногийн 1 мин дата дээр spread
      хассан R-ээр тоолно. Сөрөг бол унтраана.
   A9 Эрсдэл тогтмол, хэмжээ хувьсах: 1R = данс×%; өдрийн −3R эсвэл дараалсан 3 алдагдал = зогс.
   A10 Цаг бол эрсдэл: 45 минутад TP1 хүрэхгүй скальп = буруу санаа, гар. */

export type Kind = "fx" | "metal" | "crypto";
export type Inst = {
  sym: string; name: string; kind: Kind; src: "duka" | "binance"; ticker: string; sq?: string;
  pip: number; digits: number; contract: number; quote: string;
  /** мэдээний календарт харах валютууд */
  ccy: string[];
  /** BUY хийхэд доллараар ямар байр суурь: +1 USD урт, −1 USD богино, 0 хамааралгүй */
  usd: number;
  /** ердийн бүх-зардал spread (үнийн нэгжээр) — backtest-ийн зардал */
  spread: number;
  /** Swissquote prime-ийн ердийн spread (2026-11-04 хэмжсэн) — одоогийн spread хэд дахин өргөссөнийг үүнтэй харьцуулна */
  sqBase?: number;
  asia: boolean;
};

const fx = (sym: string, name: string, spreadPips: number, sqPips: number, usd: number, asia = false): Inst => {
  const b = sym.slice(0, 3), q = sym.slice(3), jpy = q === "JPY", pip = jpy ? 0.01 : 0.0001;
  return { sym, name, kind: "fx", src: "duka", ticker: `${b}/${q}`, sq: `${b}/${q}`, pip, digits: jpy ? 3 : 5, contract: 100000, quote: q, ccy: [b, q], usd, spread: spreadPips * pip, sqBase: sqPips * pip, asia };
};
export const UNIVERSE: Inst[] = [
  fx("EURUSD", "Евро · Доллар", 0.9, 1.1, -1),
  fx("GBPUSD", "Фунт · Доллар", 1.2, 1.3, -1),
  fx("USDJPY", "Доллар · Иен", 1.0, 0.9, 1, true),
  fx("AUDUSD", "Австрали · Доллар", 1.0, 1.2, -1, true),
  fx("USDCAD", "Доллар · Канад", 1.5, 1.4, 1),
  fx("USDCHF", "Доллар · Франк", 1.4, 1.4, 1),
  fx("NZDUSD", "Шинэ Зеланд · Доллар", 1.6, 1.3, -1, true),
  fx("EURJPY", "Евро · Иен", 1.6, 1.8, 0, true),
  fx("GBPJPY", "Фунт · Иен", 2.4, 1.9, 0, true),
  fx("EURGBP", "Евро · Фунт", 1.2, 1.2, 0),
  { sym: "XAUUSD", name: "Алт", kind: "metal", src: "duka", ticker: "XAU/USD", sq: "XAU/USD", pip: 0.1, digits: 2, contract: 100, quote: "USD", ccy: ["USD"], usd: -1, spread: 0.25, sqBase: 0.64, asia: false },
  { sym: "BTCUSD", name: "Биткойн", kind: "crypto", src: "binance", ticker: "BTCUSDT", pip: 1, digits: 1, contract: 1, quote: "USD", ccy: ["USD"], usd: 0, spread: 20, asia: true },
  { sym: "ETHUSD", name: "Этериум", kind: "crypto", src: "binance", ticker: "ETHUSDT", pip: 0.1, digits: 2, contract: 1, quote: "USD", ccy: ["USD"], usd: 0, spread: 1.5, asia: true },
];
export const bySym = (s: string) => UNIVERSE.find((x) => x.sym === String(s || "").toUpperCase()) || null;

/* ── цаг: London / New York / Tokyo орон нутгийн цаг (DST-тэй). Өдөр бүрийн зөрүүг кэшлэнэ — backtest-д хурдан ── */
const offCache = new Map<string, number>();
function tzOff(tz: string, t: number): number {
  const day = Math.floor(t / 864e5), key = tz + day;
  let o = offCache.get(key);
  if (o === undefined) {
    const d = new Date(day * 864e5 + 12 * 3600e3);
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
    const g = (k: string) => Number(p.find((x) => x.type === k)?.value);
    o = Math.round((Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - d.getTime()) / 60000);
    offCache.set(key, o);
  }
  return o;
}
export function local(tz: string, t: number) {
  const ms = t + tzOff(tz, t) * 60000, d = new Date(ms);
  return { min: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay(), day: Math.floor(ms / 864e5) };
}
const LON = "Europe/London", NY = "America/New_York", TYO = "Asia/Tokyo";

/** A2: скальп хийх цонх. Валют/алт: London 08:00 → NY 12:00 (+ Токио 09:00–11:30 JPY/AUD/NZD-д). Крипто: 24/7, rollover-гүй. */
export function sessionAt(inst: Inst, t: number): { ok: boolean; name: string; why: string } {
  const lo = local(LON, t), ny = local(NY, t), tk = local(TYO, t);
  if (inst.kind === "crypto") return { ok: true, name: lo.min >= 480 && ny.min < 1020 ? "London/NY" : tk.min >= 540 && tk.min < 900 ? "Tokyo" : "24/7", why: "" };
  const weekend = ny.dow === 6 || (ny.dow === 0 && ny.min < 1020) || (ny.dow === 5 && ny.min >= 1020);
  if (weekend) return { ok: false, name: "Хаалттай", why: "Амралтын өдөр — зах зээл хаалттай" };
  if (ny.min >= 1005 && ny.min < 1095) return { ok: false, name: "Rollover", why: "Rollover (NY 17:00) — spread өргөсдөг цаг" };
  if (ny.dow === 5 && ny.min >= 720) return { ok: false, name: "Баасан орой", why: "Баасан гарагийн орой — хөрвөх чадвар нимгэн" };
  if (lo.min >= 480 && ny.min < 720 && lo.dow >= 1 && lo.dow <= 5) return { ok: true, name: ny.min >= 480 ? "London + NY" : "London", why: "" };
  if (inst.asia && tk.min >= 540 && tk.min < 690) return { ok: true, name: "Tokyo", why: "" };
  return { ok: false, name: "Нам цаг", why: inst.asia ? "Скальпын цонх: London 08:00–NY 12:00, Токио 09:00–11:30" : "Скальпын цонх: London 08:00 → NY 12:00" };
}

/* ── нэгтгэл M1 → M5/M15 ── */
export function aggregate(m1: Bar[], mins: number): Bar[] {
  const out: Bar[] = [], w = mins * 60000;
  for (const b of m1) {
    const t = Math.floor(b.t / w) * w, last = out[out.length - 1];
    if (last && last.t === t) { last.h = Math.max(last.h, b.h); last.l = Math.min(last.l, b.l); last.c = b.c; last.v += b.v; }
    else out.push({ ...b, t });
  }
  return out;
}
/** M1 лаа бүрийн хаалт дээр БҮРЭН хаагдсан сүүлийн том лааны индекс (ирээдүйг харахгүй) */
function mapClosed(m1: Bar[], big: Bar[], mins: number): Int32Array {
  const out = new Int32Array(m1.length).fill(-1), w = mins * 60000;
  let k = -1;
  for (let i = 0; i < m1.length; i++) {
    const now = m1[i].t + 60000;
    while (k + 1 < big.length && big[k + 1].t + w <= now) k++;
    out[i] = k;
  }
  return out;
}

export type Series = ReturnType<typeof build>;
export function build(inst: Inst, m1: Bar[]) {
  const m5 = aggregate(m1, 5), m15 = aggregate(m1, 15);
  const c1 = m1.map((x) => x.c), c5 = m5.map((x) => x.c), c15 = m15.map((x) => x.c);
  const hasVol = m1.slice(-200).some((x) => x.v > 0);
  const bb = boll(c5, 20, 2), kc = keltner(m5, 20, 1.5), ad = adx(m5, 14), md = macd(c5), st = supertrend(m5, 10, 3);
  const a5 = atr(m5, 14);
  /* өдрийн (00:00 UTC) VWAP — эзлэхүүнгүй валютад TWAP (ижил жин) */
  const vwap: number[] = [], vsd: number[] = [];
  let day = -1, sw = 0, spv = 0, sp2 = 0;
  for (const b of m1) {
    const d = Math.floor(b.t / 864e5);
    if (d !== day) { day = d; sw = 0; spv = 0; sp2 = 0; }
    const p = (b.h + b.l + b.c) / 3, w = hasVol ? Math.max(b.v, 1e-9) : 1;
    sw += w; spv += p * w; sp2 += p * p * w;
    const m = spv / sw;
    vwap.push(m); vsd.push(Math.sqrt(Math.max(0, sp2 / sw - m * m)));
  }
  /* C загварт: өдөр бүрийн Азийн хүрээ (00:00 UTC → London 08:00) ба анхны M5 эвдрэлийн хугацаа */
  const asia = new Map<number, { hi: number; lo: number; open: number; upAt: number; dnAt: number }>();
  for (const b of m1) {
    const d = Math.floor(b.t / 864e5), lo = local(LON, b.t);
    let r = asia.get(d);
    if (!r) { const open = d * 864e5 + (480 - tzOff(LON, b.t)) * 60000; r = { hi: -Infinity, lo: Infinity, open, upAt: 0, dnAt: 0 }; asia.set(d, r); }
    if (b.t < r.open && lo.min < 480) { r.hi = Math.max(r.hi, b.h); r.lo = Math.min(r.lo, b.l); }
  }
  m5.forEach((b, j) => {
    const r = asia.get(Math.floor(b.t / 864e5));
    if (!r || b.t < r.open || b.t > r.open + 150 * 60000 || !Number.isFinite(r.hi) || Number.isNaN(a5[j])) return;
    if (!r.upAt && b.c > r.hi + 0.1 * a5[j]) r.upAt = b.t + 5 * 60000;
    if (!r.dnAt && b.c < r.lo - 0.1 * a5[j]) r.dnAt = b.t + 5 * 60000;
  });
  return {
    inst, m1, m5, m15, hasVol,
    i5: mapClosed(m1, m5, 5), i15: mapClosed(m1, m15, 15),
    e9: ema(c1, 9), rsi7: rsi(c1, 7), a1: atr(m1, 14),
    e20: ema(c5, 20), e50: ema(c5, 50), a5, rsi14: rsi(c5, 14), adx: ad.adx, pdi: ad.pdi, mdi: ad.mdi, er: er(c5, 12),
    bb, bbw: bb.sd.map((s, j) => (bb.mid[j] ? (4 * s) / bb.mid[j] : NaN)), kc, macd: md.hist, stoch: stoch(m5, 14, 3), cci: cci(m5, 20),
    roc: roc(c5, 10), wr: willr(m5, 14), st: st.dir, slope: slope(c5, 20), obv: obv(m5), mfi: mfi(m5, 14),
    e50h: ema(c15, 50), e200h: ema(c15, 200), a15: atr(m15, 14), adxh: adx(m15, 14).adx,
    vwap, vsd, asia,
  };
}

/* ── A3 горим ── */
export type RegimeKind = "trend" | "range" | "mixed" | "chaos" | "dead";
export type Regime = { kind: RegimeKind; adx: number; er: number; atrPct: number; bbwPct: number; squeeze: boolean };
export function regimeAt(S: Series, j: number): Regime {
  const atrPct = pctRank(S.a5, j, 288), bbwPct = pctRank(S.bbw, j, 288), a = S.adx[j], e = S.er[j];
  const squeeze = S.bb.up[j] < S.kc.up[j] && S.bb.lo[j] > S.kc.lo[j];
  const kind: RegimeKind = atrPct >= 0.97 ? "chaos" : atrPct <= 0.08 ? "dead" : a >= 22 && e >= 0.28 ? "trend" : a < 20 && e < 0.22 ? "range" : "mixed";
  return { kind, adx: a, er: e, atrPct, bbwPct, squeeze };
}
/** A4 M15 чиглэл */
export function biasAt(S: Series, k: number): { dir: number; adx: number } {
  if (k < 4) return { dir: 0, adx: NaN };
  const c = S.m15[k].c, e50 = S.e50h[k], e200 = S.e200h[k], rising = e50 > S.e50h[k - 4], falling = e50 < S.e50h[k - 4];
  return { dir: c > e50 && e50 > e200 && rising ? 1 : c < e50 && e50 < e200 && falling ? -1 : 0, adx: S.adxh[k] };
}

/* ── загварууд ── */
export type Play = "pullback" | "fade" | "breakout";
export const PLAYS: Play[] = ["pullback", "fade", "breakout"];
export const PLAY_MN: Record<Play, string> = { pullback: "Трендийн буцалт", fade: "Хүрээний эргэлт", breakout: "Сешний эвдрэл" };
export type Setup = { play: Play; dir: 1 | -1; i: number; slRef: number; target?: number; ctx: Record<string, number> };

const WARM5 = 300, WARM15 = 210;
/** Дүрмийн тогтмолууд — нэг газар. 2026-11-04: 5 хувилбарыг ХУУЧИН 14 хоног дээр харьцуулж сонгосон
    (SL ≥ 1 ATR(M5) нь M5-ын шуугианаас гадна, 45 мин цагийн зогсоолт, хүрээнд RSI 38) — сүүлийн 14 хоногийг
    тааруулахад ашиглаагүй. Ямар ч хувилбарт FX-ийн загварууд spread хассаны дараа тогтвортой эерэг гараагүй —
    тиймээс grade() сөрөг давуу талтайг унтраана, калибровк өдөр бүр шинэчлэгдэнэ. */
export const P = { slMin: 1.0, slMax: 2.0, maxBars: 45, fadeRsi: 38, tp2: 2 };
export function ready(S: Series, i: number) { return S.i5[i] >= WARM5 && S.i15[i] >= WARM15 && i >= 20; }

export function setupAt(S: Series, i: number, reg: Regime, bias: { dir: number; adx: number }): Setup | null {
  const j = S.i5[i], a = S.a5[j], m = S.m1, b = m[i];
  if (!(a > 0)) return null;
  /* A — трендийн буцалт: M15 чиглэл + M5 тренд горим, M5 EMA20 бүс рүү буцаад, M1 EMA9-ийг дахин давна */
  if (reg.kind === "trend" && bias.dir && Math.sign(S.pdi[j] - S.mdi[j]) === bias.dir) {
    const d = bias.dir as 1 | -1;
    let ext = d > 0 ? Infinity : -Infinity;
    for (let k = i - 7; k <= i; k++) ext = d > 0 ? Math.min(ext, m[k].l) : Math.max(ext, m[k].h);
    const touched = d > 0 ? ext <= S.e20[j] + 0.25 * a : ext >= S.e20[j] - 0.25 * a;
    const intact = d > 0 ? ext >= S.e50[j] - 0.5 * a : ext <= S.e50[j] + 0.5 * a;
    const cross = d > 0 ? b.c > S.e9[i] && m[i - 1].c <= S.e9[i - 1] : b.c < S.e9[i] && m[i - 1].c >= S.e9[i - 1];
    const mom = d > 0 ? S.rsi7[i] > 50 : S.rsi7[i] < 50;
    const notFar = (b.c - S.e20[j]) * d <= 0.8 * a;
    if (touched && intact && cross && mom && (b.c - b.o) * d > 0 && notFar)
      return { play: "pullback", dir: d, i, slRef: ext - d * 0.15 * a, ctx: { e20: S.e20[j], adx: reg.adx, er: reg.er } };
  }
  /* B — хүрээний эргэлт: M5 Bollinger-ийн гадна + RSI туйл, M1 өмнөх лааг эсрэг давна */
  if (reg.kind === "range") {
    for (const d of [1, -1] as const) {
      if (bias.dir === -d && bias.adx >= 25) continue;
      const pierced = [j, j - 1].some((q) => (d > 0 ? S.m5[q].l <= S.bb.lo[q] && S.rsi14[q] <= P.fadeRsi : S.m5[q].h >= S.bb.up[q] && S.rsi14[q] >= 100 - P.fadeRsi));
      if (!pierced) continue;
      const turn = (b.c - b.o) * d > 0 && (d > 0 ? b.c > m[i - 1].h : b.c < m[i - 1].l);
      const inside = d > 0 ? b.c > S.bb.lo[j] : b.c < S.bb.up[j];
      if (!turn || !inside) continue;
      let ext = d > 0 ? Infinity : -Infinity;
      for (let k = i - 5; k <= i; k++) ext = d > 0 ? Math.min(ext, m[k].l) : Math.max(ext, m[k].h);
      return { play: "fade", dir: d, i, slRef: ext - d * 0.2 * a, target: S.bb.mid[j], ctx: { rsi: S.rsi14[j], adx: reg.adx, mid: S.bb.mid[j] } };
    }
  }
  /* C — сешний эвдрэл: London нээлтээр Азийн хүрээ эвдэрч, M1 дээр эвдэрсэн түвшинг дахин тестлээд тогтоно */
  if (S.inst.kind !== "crypto" && reg.kind !== "chaos" && reg.kind !== "dead") {
    const r = S.asia.get(Math.floor(b.t / 864e5));
    const w = r ? r.hi - r.lo : 0;
    if (r && Number.isFinite(w) && w >= 3 * a && w <= 14 * a) {
      for (const d of [1, -1] as const) {
        const at = d > 0 ? r.upAt : r.dnAt, lvl = d > 0 ? r.hi : r.lo;
        if (!at || b.t + 60000 < at || b.t - at > 90 * 60000) continue;
        if (bias.dir === -d) continue;
        const retest = d > 0 ? b.l <= lvl + 0.2 * a && b.c > lvl + 0.05 * a : b.h >= lvl - 0.2 * a && b.c < lvl - 0.05 * a;
        if (retest && (b.c - b.o) * d > 0) return { play: "breakout", dir: d, i, slRef: lvl - d * 0.6 * a, ctx: { level: lvl, width: w } };
      }
    }
  }
  return null;
}

/* ── A1 түвшин: SL бүтцийн цаана, гэхдээ ≥ P.slMin ATR(M5) ба ≥ 5×spread; P.slMax ATR-аас хол бол скальп биш ── */
export type Plan = { entry: number; sl: number; tp1: number; tp2: number; risk: number; rr1: number; rr2: number; costR: number; slPips: number; tp1Pips: number; tp2Pips: number };
export function plan(S: Series, s: Setup, entry: number, spread: number): Plan | null {
  const a = S.a5[S.i5[s.i]], d = s.dir, inst = S.inst;
  let risk = (entry - s.slRef) * d;
  if (!(risk > 0) || risk > P.slMax * a) return null;
  risk = Math.max(risk, P.slMin * a, 5 * spread);
  let rr2 = P.tp2;
  if (s.play === "fade" && s.target !== undefined) {
    const room = ((s.target - entry) * d) / risk;
    if (room < 1) return null;
    rr2 = Math.min(P.tp2, Math.max(1.3, room));
  }
  const r = (x: number) => +x.toFixed(inst.digits), pips = (x: number) => +(Math.abs(x) / inst.pip).toFixed(1);
  return {
    entry: r(entry), sl: r(entry - d * risk), tp1: r(entry + d * risk), tp2: r(entry + d * risk * rr2), risk,
    rr1: 1, rr2: +rr2.toFixed(2), costR: +(spread / risk).toFixed(3), slPips: pips(risk), tp1Pips: pips(risk), tp2Pips: pips(risk * rr2),
  };
}

/* ── A10 удирдлага: TP1-д 50% хааж SL-ийг орох цэг рүү, үлдсэнийг TP2 хүртэл, цагийн зогсоолт (P.maxBars мин).
   Нэг лаанд SL ба TP хоёулаа хүрвэл SL (болгоомжтой). Бодит скан, журнал, backtest — НЭГ функц. */
export type Sim = { status: "open" | "sl" | "be" | "tp2" | "time"; r: number; tp1: boolean; exit: number; at: number; bars: number };
export function simulate(bars: Bar[], start: number, dir: number, p: { entry: number; sl: number; tp1: number; tp2: number; risk: number; rr2: number }, maxBars = P.maxBars, final = true): Sim {
  let hit1 = false;
  const mtm = (c: number) => ((c - p.entry) * dir) / p.risk;
  for (let k = start, n = 0; k < bars.length; k++, n++) {
    const b = bars[k];
    if (n >= maxBars) {
      const c = bars[k - 1].c;
      return { status: "time", r: +(hit1 ? 0.5 + 0.5 * mtm(c) : mtm(c)).toFixed(3), tp1: hit1, exit: k - 1, at: bars[k - 1].t, bars: n };
    }
    const lowHit = (x: number) => (dir > 0 ? b.l <= x : b.h >= x), highHit = (x: number) => (dir > 0 ? b.h >= x : b.l <= x);
    if (!hit1) {
      if (lowHit(p.sl)) return { status: "sl", r: -1, tp1: false, exit: k, at: b.t, bars: n + 1 };
      if (highHit(p.tp2)) return { status: "tp2", r: +(0.5 + 0.5 * p.rr2).toFixed(3), tp1: true, exit: k, at: b.t, bars: n + 1 };
      if (highHit(p.tp1)) hit1 = true;
    } else {
      if (highHit(p.tp2)) return { status: "tp2", r: +(0.5 + 0.5 * p.rr2).toFixed(3), tp1: true, exit: k, at: b.t, bars: n + 1 };
      if (lowHit(p.entry)) return { status: "be", r: 0.5, tp1: true, exit: k, at: b.t, bars: n + 1 };
    }
  }
  const last = bars.length - 1, n = last - start + 1;
  if (final && n >= maxBars) {
    const c = bars[last].c;
    return { status: "time", r: +(hit1 ? 0.5 + 0.5 * mtm(c) : mtm(c)).toFixed(3), tp1: hit1, exit: last, at: bars[last].t, bars: n };
  }
  return { status: "open", r: +(hit1 ? 0.5 + 0.5 * mtm(bars[last]?.c ?? p.entry) : mtm(bars[last]?.c ?? p.entry)).toFixed(3), tp1: hit1, exit: last, at: bars[last]?.t ?? 0, bars: Math.max(0, n) };
}

/* ── A7 макро: синтетик DXY (ICE томьёо) 6 валютын M5 хаалтаас — бодит цагийн ── */
export const DXY_LEGS: [string, number][] = [["EURUSD", -0.576], ["USDJPY", 0.136], ["GBPUSD", -0.119], ["USDCAD", 0.091], ["USDSEK", 0.042], ["USDCHF", 0.036]];
/** M5 хугацааны тэмдэг → DXY-ийн 30 минутын моментийн z-оноо */
export function dxyZ(legs: Record<string, Bar[]>): Map<number, number> {
  const times = new Set<number>();
  const maps = DXY_LEGS.map(([s]) => {
    const m = new Map<number, number>();
    for (const b of legs[s] || []) { m.set(b.t, b.c); times.add(b.t); }
    return m;
  });
  if (maps.some((m) => !m.size)) return new Map();
  const ts = [...times].sort((a, b) => a - b), last: number[] = DXY_LEGS.map(() => NaN), lv: { t: number; v: number }[] = [];
  for (const t of ts) {
    maps.forEach((m, k) => { const v = m.get(t); if (v !== undefined) last[k] = v; });
    if (last.some((x) => Number.isNaN(x))) continue;
    lv.push({ t, v: Math.log(50.14348112) + DXY_LEGS.reduce((s, [, w], k) => s + w * Math.log(last[k]), 0) });
  }
  const out = new Map<number, number>(), r6: number[] = [];
  for (let k = 6; k < lv.length; k++) {
    r6.push(lv[k].v - lv[k - 6].v);
    if (r6.length < 120) continue;
    const win = r6.slice(-288), mu = win.reduce((a, b) => a + b, 0) / win.length;
    const sd = Math.sqrt(win.reduce((a, b) => a + (b - mu) ** 2, 0) / win.length) || 1e-9;
    out.set(lv[k].t, (lv[k].v - lv[k - 6].v) / sd);
  }
  return out;
}

/* ── шүүлтүүрүүд (gate) — нэг нь ч хаалттай бол арилжаа санал болгохгүй ── */
export type Gate = { key: string; label: string; ok: boolean; warn?: boolean; text: string };
export const MACRO_BLOCK = 1.5;
export function macroGate(inst: Inst, dir: number, z: number | undefined): Gate | null {
  if (!inst.usd || z === undefined || Number.isNaN(z)) return null;
  const exp = inst.usd * dir * z;
  return { key: "macro", label: "Макро · DXY", ok: exp > -MACRO_BLOCK, warn: exp < -0.8, text: `DXY 30 мин момент ${z > 0 ? "+" : ""}${z.toFixed(1)}σ — ${exp > 0.5 ? "чиглэлийг дэмжиж байна" : exp < -MACRO_BLOCK ? "эсрэг хүчтэй, орохгүй" : exp < -0.8 ? "бага зэрэг эсрэг" : "саармаг"}` };
}

/* ── A8 backtest: тогтмол дүрмийг 1 мин дата дээр (нэг хэрэгсэлд нэг байрлал) ── */
export type BTRow = { play: Play; dir: number; t: number; r: number; net: number; tp1: boolean; status: string; bars: number; costR: number; session: string };
export function backtest(S: Series, z?: Map<number, number>, maxBars = P.maxBars): BTRow[] {
  const out: BTRow[] = [], used = new Set<string>();
  let busyTo = -1;
  for (let i = 21; i < S.m1.length - 2; i++) {
    if (i <= busyTo || !ready(S, i)) continue;
    const t = S.m1[i].t, ses = sessionAt(S.inst, t);
    if (!ses.ok) continue;
    const j = S.i5[i], reg = regimeAt(S, j);
    if (reg.kind === "chaos" || reg.kind === "dead") continue;
    if (S.a1[i] > 0 && S.m1[i].h - S.m1[i].l > 4 * S.a1[i]) continue;
    const s = setupAt(S, i, reg, biasAt(S, S.i15[i]));
    if (!s) continue;
    if (s.play === "breakout") { const key = `${Math.floor(t / 864e5)}${s.dir}`; if (used.has(key)) continue; used.add(key); }
    const mg = macroGate(S.inst, s.dir, z?.get(S.m5[j].t));
    if (mg && !mg.ok) continue;
    const entry = S.m1[i + 1].o, p = plan(S, s, entry, S.inst.spread);
    if (!p || p.costR > 0.2) continue;
    const sim = simulate(S.m1, i + 1, s.dir, p, maxBars, true);
    if (sim.status === "open") break;
    out.push({ play: s.play, dir: s.dir, t, r: sim.r, net: +(sim.r - p.costR).toFixed(3), tp1: sim.tp1, status: sim.status, bars: sim.bars, costR: p.costR, session: ses.name });
    busyTo = sim.exit;
  }
  return out;
}

/* ── A6 индикаторын гэр бүл: 11 индикатор → хэдэн бие даасан дохио ── */
const cl = (x: number) => (Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0);
type Vote = { key: string; fam: "trend" | "mom" | "flow"; label: string; f: (S: Series, j: number) => number; v: (S: Series, j: number) => string };
const VOTES: Vote[] = [
  { key: "ema", fam: "trend", label: "EMA 20/50", f: (S, j) => cl((S.e20[j] - S.e50[j]) / (0.5 * S.a5[j])), v: (S, j) => (S.e20[j] > S.e50[j] ? "20 > 50" : "20 < 50") },
  { key: "adx", fam: "trend", label: "ADX · DI", f: (S, j) => Math.sign(S.pdi[j] - S.mdi[j]) * cl(S.adx[j] / 40), v: (S, j) => `ADX ${S.adx[j].toFixed(0)} · ${S.pdi[j] > S.mdi[j] ? "+DI" : "−DI"}` },
  { key: "st", fam: "trend", label: "Supertrend", f: (S, j) => S.st[j] || 0, v: (S, j) => (S.st[j] > 0 ? "өсөх" : "унах") },
  { key: "slope", fam: "trend", label: "Регрессийн налуу", f: (S, j) => cl((S.slope[j] * 20) / S.a5[j]), v: (S, j) => `${((S.slope[j] * 20) / S.a5[j]).toFixed(1)} ATR/20 лаа` },
  { key: "rsi", fam: "mom", label: "RSI 14", f: (S, j) => cl((S.rsi14[j] - 50) / 25), v: (S, j) => S.rsi14[j].toFixed(0) },
  { key: "macd", fam: "mom", label: "MACD", f: (S, j) => cl(S.macd[j] / (0.3 * S.a5[j])), v: (S, j) => (S.macd[j] > 0 ? "эерэг" : "сөрөг") },
  { key: "stoch", fam: "mom", label: "Stochastic", f: (S, j) => cl((S.stoch[j] - 50) / 40), v: (S, j) => S.stoch[j].toFixed(0) },
  { key: "cci", fam: "mom", label: "CCI 20", f: (S, j) => cl(S.cci[j] / 150), v: (S, j) => S.cci[j].toFixed(0) },
  { key: "roc", fam: "mom", label: "ROC 10", f: (S, j) => cl(S.roc[j] / (2 * S.a5[j])), v: (S, j) => `${(S.roc[j] / S.a5[j]).toFixed(1)} ATR` },
  { key: "wr", fam: "mom", label: "Williams %R", f: (S, j) => cl((S.wr[j] + 50) / 40), v: (S, j) => S.wr[j].toFixed(0) },
  { key: "obv", fam: "flow", label: "OBV", f: (S, j) => { const d = S.obv[j] - S.obv[j - 12]; let v = 0; for (let k = j - 11; k <= j; k++) v += S.m5[k].v; return cl(v ? (d / v) * 2 : 0); }, v: (S, j) => (S.obv[j] >= S.obv[j - 12] ? "өсөж" : "буурч") },
  { key: "mfi", fam: "flow", label: "MFI 14", f: (S, j) => cl((S.mfi[j] - 50) / 25), v: (S, j) => S.mfi[j].toFixed(0) },
];
export const FAM_MN = { trend: "Тренд", mom: "Момент", flow: "Урсгал (эзлэхүүн)", vol: "Хэлбэлзэл", loc: "Байршил", macro: "Макро" };
export function families(S: Series, i: number, z?: number) {
  const j = S.i5[i];
  const votes = VOTES.filter((x) => x.fam !== "flow" || S.hasVol).map((x) => ({ key: x.key, fam: x.fam, label: x.label, vote: +x.f(S, j).toFixed(2), value: x.v(S, j) }));
  const fam = (f: string) => { const v = votes.filter((x) => x.fam === f); return v.length ? +(v.reduce((s, x) => s + x.vote, 0) / v.length).toFixed(2) : null; };
  const series = VOTES.filter((x) => x.fam !== "flow" || S.hasVol).map((x) => { const a: number[] = []; for (let k = Math.max(30, j - 239); k <= j; k++) a.push(x.f(S, k)); return a; });
  const reg = regimeAt(S, j), p = S.m1[i].c, a = S.a5[j];
  const bbPct = (S.m5[j].c - S.bb.lo[j]) / (S.bb.up[j] - S.bb.lo[j] || 1);
  const r = S.asia.get(Math.floor(S.m1[i].t / 864e5));
  return {
    votes, trend: fam("trend"), mom: fam("mom"), flow: fam("flow"),
    macro: S.inst.usd && z !== undefined && !Number.isNaN(z) ? +cl((S.inst.usd * z) / 2).toFixed(2) : null,
    count: votes.length, neff: +neff(series).toFixed(1),
    vol: { atrPct: Math.round(reg.atrPct * 100), bbwPct: Math.round(reg.bbwPct * 100), er: +reg.er.toFixed(2), adx: +reg.adx.toFixed(0), squeeze: reg.squeeze, atr5: a, atr1: S.a1[i] },
    loc: {
      vwap: S.vwap[i], vwapSig: S.vsd[i] ? +((p - S.vwap[i]) / S.vsd[i]).toFixed(1) : 0, vwapKind: S.hasVol ? "VWAP" : "TWAP",
      bbPct: +bbPct.toFixed(2), e20Atr: +((p - S.e20[j]) / a).toFixed(1),
      asiaHi: r && Number.isFinite(r.hi) ? r.hi : null, asiaLo: r && Number.isFinite(r.lo) ? r.lo : null,
    },
    m15: biasAt(S, S.i15[i]), rsi7: +S.rsi7[i].toFixed(0),
  };
}

/* ── статистик: n, TP1 хүрсэн, хүлээлт (spread хассан). Бага өгөгдлийг 0 руу татна (shrink) — итгэлийг «зохиохгүй» ── */
export type Stat = { n: number; tp1: number; win: number; sumR: number; sumNet: number; sumSq: number; bars: number };
export const emptyStat = (): Stat => ({ n: 0, tp1: 0, win: 0, sumR: 0, sumNet: 0, sumSq: 0, bars: 0 });
export function addStat(s: Stat, r: BTRow) { s.n++; if (r.tp1) s.tp1++; if (r.net > 0) s.win++; s.sumR += r.r; s.sumNet += r.net; s.sumSq += r.net * r.net; s.bars += r.bars; }
export function summarize(s: Stat) {
  const n = s.n, mean = n ? s.sumNet / n : 0, sd = n > 1 ? Math.sqrt(Math.max(0, s.sumSq / n - mean * mean)) : 0;
  return {
    n, tp1Rate: n ? Math.round((s.tp1 / n) * 100) : null,
    /** TP1 түрүүлж хүрэх магадлал — Beta(10,10) prior-оор татсан */
    pTp1: Math.round(((s.tp1 + 10) / (n + 20)) * 100),
    exp: +mean.toFixed(3), expShr: +((s.sumNet) / (n + 20)).toFixed(3), se: n > 1 ? +(sd / Math.sqrt(n)).toFixed(3) : null,
    totalR: +s.sumNet.toFixed(1), avgMin: n ? Math.round(s.bars / n) : null,
  };
}
export type Summary = ReturnType<typeof summarize>;

/** Зэрэглэл: хэмжсэн давуу тал + бие даасан гэр бүлийн тохирол + зардал. Сөрөг давуу талтай загварыг унтраана. */
export function grade(st: Summary | null, fam: { trend: number | null; mom: number | null; flow: number | null; macro: number | null }, dir: number, costR: number) {
  if (st && st.n >= 30 && st.expShr < -0.02) return { grade: "OFF" as const, score: -9, why: `Энэ загвар сүүлийн 28 хоногт алдагдалтай (${st.n} арилжаа, ${st.exp > 0 ? "+" : ""}${st.exp}R) — унтраалттай` };
  let score = 0;
  const why: string[] = [];
  if (st && st.n >= 30) { if (st.expShr >= 0.12) { score += 2; why.push("түүхэн давуу тал хүчтэй"); } else if (st.expShr >= 0.04) { score += 1; why.push("түүхэн давуу тал эерэг"); } else why.push("түүхэн давуу тал сул"); }
  else why.push(`түүхэн дата бага (${st?.n || 0})`);
  const fs = [fam.trend, fam.mom, fam.flow, fam.macro].filter((x): x is number => x !== null);
  const with_ = fs.filter((x) => x * dir >= 0.25).length, against = fs.filter((x) => x * dir <= -0.25).length;
  if (with_ - against >= 2) { score += 1; why.push(`${with_} гэр бүл дэмжиж байна`); }
  if (against >= 2) { score -= 1; why.push(`${against} гэр бүл эсэргүүцэж байна`); }
  if (costR <= 0.1) { score += 1; why.push("зардал бага"); }
  return { grade: (score >= 3 ? "A" : score >= 2 ? "B" : "C") as "A" | "B" | "C", score, why: why.join(" · ") };
}

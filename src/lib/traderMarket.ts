/* ─── Tesla Trader · зах зээлийн бодит өгөгдөл (2026-10-25) ─────────
   Зурган дээрх уншилтыг БОДИТ лаатай тулгахын тулд Yahoo Finance-ийн chart API
   (түлхүүргүй, droplet-оос ажилладаг — 2026-10-25 шалгасан). Алт = GC=F фьючерс
   (XAUUSD=X Yahoo-д байхгүй) тул спот ханшаас хэдэн доллар зөрж болно.
   Индикатор бүрийг энд өөрсдөө тооцно — AI-гаас тоо зохиолгохгүй. */

export type Candle = { t: number; o: number; h: number; l: number; c: number };
export type TF = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1" | "W1";
export const TFS: TF[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1"];
export const TF_MIN: Record<TF, number> = { M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440, W1: 10080 };

export type Inst = { symbol: string; yahoo: string; kind: "fx" | "metal" | "index" | "crypto"; pip: number; contract: number; base: string; quote: string; digits: number; note?: string };

const FX = ["EUR", "USD", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "SEK", "NOK", "SGD", "HKD", "CNH", "MXN", "ZAR", "TRY", "PLN"];
const SPECIAL: Record<string, Omit<Inst, "symbol">> = {
  XAUUSD: { yahoo: "GC=F", kind: "metal", pip: 0.1, contract: 100, base: "XAU", quote: "USD", digits: 2, note: "Алтны ханш COMEX фьючерсээс (GC=F) — спотоос бага зөрж болно" },
  XAGUSD: { yahoo: "SI=F", kind: "metal", pip: 0.01, contract: 5000, base: "XAG", quote: "USD", digits: 3, note: "Мөнгөний ханш фьючерсээс (SI=F)" },
  BTCUSD: { yahoo: "BTC-USD", kind: "crypto", pip: 1, contract: 1, base: "BTC", quote: "USD", digits: 2 },
  ETHUSD: { yahoo: "ETH-USD", kind: "crypto", pip: 0.1, contract: 1, base: "ETH", quote: "USD", digits: 2 },
  US30: { yahoo: "^DJI", kind: "index", pip: 1, contract: 1, base: "US30", quote: "USD", digits: 1 },
  NAS100: { yahoo: "^NDX", kind: "index", pip: 1, contract: 1, base: "NAS100", quote: "USD", digits: 1 },
  US500: { yahoo: "^GSPC", kind: "index", pip: 0.1, contract: 1, base: "US500", quote: "USD", digits: 1 },
  GER40: { yahoo: "^GDAXI", kind: "index", pip: 1, contract: 1, base: "GER40", quote: "EUR", digits: 1 },
  USOIL: { yahoo: "CL=F", kind: "metal", pip: 0.01, contract: 1000, base: "WTI", quote: "USD", digits: 2, note: "WTI нефть фьючерсээс (CL=F)" },
};
const ALIAS: Record<string, string> = { GOLD: "XAUUSD", XAU: "XAUUSD", SILVER: "XAGUSD", BTC: "BTCUSD", BITCOIN: "BTCUSD", ETH: "ETHUSD", DJI: "US30", DOW: "US30", DJ30: "US30", NDX: "NAS100", NASDAQ: "NAS100", US100: "NAS100", USTEC: "NAS100", SPX: "US500", SP500: "US500", DAX: "GER40", DE40: "GER40", WTI: "USOIL", OIL: "USOIL", XTIUSD: "USOIL" };

/** "EUR/USD", "eurusd.m", "XAUUSDm", "GOLD" гэх мэтээс стандарт хэрэгсэл (брокерын төгсгөлийг хаяна) */
export function resolveSymbol(raw: string): Inst | null {
  let s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return null;
  if (ALIAS[s]) s = ALIAS[s];
  const sp = Object.keys(SPECIAL).find((k) => s.startsWith(k)) || Object.keys(ALIAS).find((k) => s === k);
  if (sp) { const k = SPECIAL[sp] ? sp : ALIAS[sp]; return { symbol: k, ...SPECIAL[k] }; }
  const b = s.slice(0, 3), q = s.slice(3, 6);
  if (s.length >= 6 && FX.includes(b) && FX.includes(q) && b !== q) {
    const jpy = q === "JPY";
    return { symbol: b + q, yahoo: `${b}${q}=X`, kind: "fx", pip: jpy ? 0.01 : 0.0001, contract: 100000, base: b, quote: q, digits: jpy ? 3 : 5 };
  }
  return null;
}
export function resolveTF(raw: string): TF | null {
  const s = String(raw || "").toUpperCase().replace(/\s+/g, "");
  const m: Record<string, TF> = { "1M": "M1", M1: "M1", "1MIN": "M1", "5M": "M5", M5: "M5", "15M": "M15", M15: "M15", "30M": "M30", M30: "M30", "1H": "H1", H1: "H1", "60M": "H1", "60": "H1", "4H": "H4", H4: "H4", "240": "H4", "1D": "D1", D1: "D1", D: "D1", DAILY: "D1", "1W": "W1", W1: "W1", W: "W1", WEEKLY: "W1" };
  return m[s] || null;
}

/* Yahoo-гийн interval/range — индикаторт хүрэлцэхүйц (≥ 220 лаа) */
const Y: Record<TF, { i: string; r: string; agg?: number }> = {
  M1: { i: "1m", r: "1d" }, M5: { i: "5m", r: "5d" }, M15: { i: "15m", r: "5d" }, M30: { i: "30m", r: "1mo" },
  H1: { i: "60m", r: "1mo" }, H4: { i: "60m", r: "3mo", agg: 4 }, D1: { i: "1d", r: "2y" }, W1: { i: "1wk", r: "10y" },
};

async function yahoo(ticker: string, interval: string, range: string, period?: { from: number; to: number }): Promise<{ candles: Candle[]; price: number; time: number }> {
  const q = period ? `interval=${interval}&period1=${Math.floor(period.from / 1000)}&period2=${Math.floor(period.to / 1000)}` : `interval=${interval}&range=${range}`;
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${q}`, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!r.ok) throw new Error(`Ханшийн өгөгдөл ирсэнгүй (${r.status})`);
  const d = (await r.json()) as { chart?: { result?: { meta: { regularMarketPrice?: number; regularMarketTime?: number }; timestamp?: number[]; indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[] }[] } }[] } };
  const res = d.chart?.result?.[0];
  if (!res?.timestamp) throw new Error("Ханшийн өгөгдөл хоосон");
  const q0 = res.indicators.quote[0];
  const candles: Candle[] = [];
  res.timestamp.forEach((t, i) => {
    const o = q0.open[i], h = q0.high[i], l = q0.low[i], c = q0.close[i];
    if ([o, h, l, c].every((x) => typeof x === "number" && Number.isFinite(x))) candles.push({ t: t * 1000, o: o!, h: h!, l: l!, c: c! });
  });
  return { candles, price: res.meta.regularMarketPrice || candles.at(-1)?.c || 0, time: (res.meta.regularMarketTime || 0) * 1000 };
}
function aggregate(cs: Candle[], n: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < cs.length; i += n) {
    const g = cs.slice(i, i + n);
    if (!g.length) break;
    out.push({ t: g[0].t, o: g[0].o, h: Math.max(...g.map((x) => x.h)), l: Math.min(...g.map((x) => x.l)), c: g[g.length - 1].c });
  }
  return out;
}
export async function candles(inst: Inst, tf: TF) {
  const y = Y[tf];
  const d = await yahoo(inst.yahoo, y.i, y.r);
  const cs = y.agg ? aggregate(d.candles, y.agg) : d.candles;
  if (cs.length < 30) throw new Error("Энэ хос/хугацаанд хангалттай өгөгдөл алга");
  return { candles: cs, price: d.price, time: d.time };
}
/** Скан хийснээс хойшхи лаа — TP/SL аль нь түрүүлж хүрснийг шалгахад */
export async function candlesSince(inst: Inst, since: number) {
  const age = Date.now() - since;
  const interval = age < 6 * 864e5 ? "5m" : age < 55 * 864e5 ? "60m" : "1d";
  const d = await yahoo(inst.yahoo, interval, "", { from: since - 60e3, to: Date.now() });
  return d.candles.filter((c) => c.t >= since - 5 * 60e3);
}
/** Quote валютын 1 нэгж = ? USD (лот хэмжээ тооцоход) */
export async function quoteToUsd(quote: string): Promise<number> {
  if (quote === "USD") return 1;
  try {
    const d = await yahoo(`${quote}USD=X`, "1d", "5d");
    if (d.price > 0) return d.price;
  } catch { /* доош */ }
  const d = await yahoo(`USD${quote}=X`, "1d", "5d");
  return d.price > 0 ? 1 / d.price : 0;
}

/* ─── индикатор ─── */
export function ema(v: number[], n: number): number[] {
  const k = 2 / (n + 1), out: number[] = [];
  v.forEach((x, i) => out.push(i === 0 ? x : x * k + out[i - 1] * (1 - k)));
  return out;
}
export function rsi(c: number[], n = 14): number {
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; if (d >= 0) g += d; else l -= d; }
  g /= n; l /= n;
  for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}
export function atr(cs: Candle[], n = 14): number {
  const tr = cs.map((c, i) => (i === 0 ? c.h - c.l : Math.max(c.h - c.l, Math.abs(c.h - cs[i - 1].c), Math.abs(c.l - cs[i - 1].c))));
  let a = tr.slice(1, n + 1).reduce((x, y) => x + y, 0) / n;
  for (let i = n + 1; i < tr.length; i++) a = (a * (n - 1) + tr[i]) / n;
  return a;
}
/** Swing high/low (k лаа хоёр талдаа) — сүүлийнхээс эхэлж */
export function pivots(cs: Candle[], k = 3) {
  const highs: { i: number; p: number }[] = [], lows: { i: number; p: number }[] = [];
  for (let i = k; i < cs.length - k; i++) {
    const win = cs.slice(i - k, i + k + 1);
    if (cs[i].h === Math.max(...win.map((x) => x.h))) highs.push({ i, p: cs[i].h });
    if (cs[i].l === Math.min(...win.map((x) => x.l))) lows.push({ i, p: cs[i].l });
  }
  return { highs, lows };
}

export type Snapshot = {
  price: number; time: number; tf: TF; bars: number;
  ema20: number; ema50: number; ema200: number; rsi: number; atr: number; macdHist: number; macdPrev: number;
  structure: "up" | "down" | "range"; lastHighs: number[]; lastLows: number[];
  support: number[]; resistance: number[]; change20: number; recent: Candle[];
};
export function snapshot(cs: Candle[], price: number, time: number, tf: TF): Snapshot {
  const c = cs.map((x) => x.c);
  const e20 = ema(c, 20), e50 = ema(c, 50), e200 = ema(c, Math.min(200, Math.max(50, c.length - 5)));
  const m12 = ema(c, 12), m26 = ema(c, 26), macd = m12.map((x, i) => x - m26[i]), sig = ema(macd, 9);
  const hist = macd.map((x, i) => x - sig[i]);
  const { highs, lows } = pivots(cs, 3);
  const H = highs.slice(-3).map((x) => x.p), L = lows.slice(-3).map((x) => x.p);
  const up = H.length >= 2 && L.length >= 2 && H.at(-1)! > H.at(-2)! && L.at(-1)! > L.at(-2)!;
  const down = H.length >= 2 && L.length >= 2 && H.at(-1)! < H.at(-2)! && L.at(-1)! < L.at(-2)!;
  const a = atr(cs);
  /* түвшин: сүүлийн 120 лааны swing-үүдийг ATR*0.6 дотор бөөгнөрүүлнэ */
  const look = pivots(cs.slice(-120), 2);
  const cluster = (ps: number[]) => {
    const s = [...ps].sort((x, y) => x - y), out: { p: number; n: number }[] = [];
    s.forEach((p) => { const g = out.find((x) => Math.abs(x.p - p) < a * 0.6); if (g) { g.p = (g.p * g.n + p) / (g.n + 1); g.n++; } else out.push({ p, n: 1 }); });
    return out;
  };
  const lv = cluster([...look.highs.map((x) => x.p), ...look.lows.map((x) => x.p)]);
  const support = lv.filter((x) => x.p < price).sort((x, y) => y.p - x.p).slice(0, 3).map((x) => x.p);
  const resistance = lv.filter((x) => x.p > price).sort((x, y) => x.p - y.p).slice(0, 3).map((x) => x.p);
  return {
    price, time, tf, bars: cs.length,
    ema20: e20.at(-1)!, ema50: e50.at(-1)!, ema200: e200.at(-1)!, rsi: rsi(c), atr: a,
    macdHist: hist.at(-1)!, macdPrev: hist.at(-2)!,
    structure: up ? "up" : down ? "down" : "range", lastHighs: H, lastLows: L,
    support, resistance, change20: c.length > 21 ? (c.at(-1)! - c.at(-21)!) / a : 0, recent: cs.slice(-60),
  };
}

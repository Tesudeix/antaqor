import type { Bar } from "../scalp/ind";
import { duka, dukaSince } from "../scalp/feeds";

/* ─── Tesla Trader · Шинжилгээний ширээ — зах зээлийн дата (2026-11-06) ───
   XAU/USD: Dukascopy, BTC/USDT: Binance. 8 хугацаа, түлхүүргүй. Сүүлийн лаа үүсч буй байж болно —
   шинжилгээ зөвхөн хаагдсан лаа дээр (closedOf), чарт бүгдийг зурна. */

export const TFS = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W"] as const;
export type TF = (typeof TFS)[number];
export const TF_MIN: Record<TF, number> = { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1H": 60, "4H": 240, "1D": 1440, "1W": 10080 };
const DUKA: Record<TF, string> = { "1m": "1MIN", "5m": "5MIN", "15m": "15MIN", "30m": "30MIN", "1H": "1HOUR", "4H": "4HOUR", "1D": "1DAY", "1W": "1WEEK" };
const DUKA_PAGE: Record<TF, number> = { "1m": 5000, "5m": 5000, "15m": 2000, "30m": 1000, "1H": 5000, "4H": 5000, "1D": 3000, "1W": 1200 };
const BIN: Record<TF, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1H": "1h", "4H": "4h", "1D": "1d", "1W": "1w" };
const TTL: Record<TF, number> = { "1m": 8e3, "5m": 15e3, "15m": 20e3, "30m": 30e3, "1H": 45e3, "4H": 60e3, "1D": 120e3, "1W": 300e3 };

export const SYMBOLS = {
  XAUUSD: { pair: "XAU/USD", mn: "Алт", src: "duka" as const, ticker: "XAU/USD", digits: 2, ccy: ["USD", "CNY"], cost: () => 0.25 },
  BTCUSDT: { pair: "BTC/USDT", mn: "Биткойн", src: "binance" as const, ticker: "BTCUSDT", digits: 2, ccy: ["USD"], cost: (p: number) => p * 0.0006 },
};
export type Sym = keyof typeof SYMBOLS;

async function binance(symbol: string, interval: string, limit: number, end?: number): Promise<Bar[]> {
  const q = new URLSearchParams({ symbol, interval, limit: String(limit) });
  if (end) q.set("endTime", String(end));
  const r = await fetch(`https://api.binance.com/api/v3/klines?${q}`, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!r.ok) throw new Error(`Binance ${r.status}`);
  return ((await r.json()) as (string | number)[][]).map((k) => ({ t: Number(k[0]), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
}

const memo = new Map<string, { at: number; v: unknown; p?: Promise<unknown> }>();
async function cached<T>(key: string, ttl: number, f: () => Promise<T>): Promise<T> {
  const c = memo.get(key);
  if (c && c.v !== undefined && Date.now() - c.at < ttl) return c.v as T;
  if (c?.p) return c.p as Promise<T>;
  const p = f().then((v) => { memo.set(key, { at: Date.now(), v }); return v; }).catch((e) => { const x = memo.get(key); if (x) x.p = undefined; if (x?.v !== undefined) return x.v as T; throw e; });
  memo.set(key, { at: c?.at ?? 0, v: c?.v, p });
  return p;
}

const MON = Date.UTC(2024, 0, 1);
/** Лааны эхлэх мөч (UTC). 1W нь даваа гарагаас — Dukascopy, Binance хоёулаа ижил. */
export function bucket(t: number, tf: TF) {
  const w = TF_MIN[tf] * 60000;
  return tf === "1W" ? MON + Math.floor((t - MON) / w) * w : Math.floor(t / w) * w;
}
/* Dukascopy үүсч буй лааг өгдөггүй, том хугацааны сүүлийн лаа хоцордог (2026-11-06 хэмжсэн: 1H 95 мин, 4H 7.5 цаг,
   1D 2 өдөр, 1W 11 хоног). Иймд base-ийн дараах лаануудыг жижиг лаанаас өөрсдөө нэгтгэнэ. */
function rollup(base: Bar[], fine: Bar[], tf: TF): Bar[] {
  const out = base.map((b) => ({ ...b })), last = out[out.length - 1]?.t ?? 0;
  for (const b of fine) {
    const k = bucket(b.t, tf);
    if (k <= last) continue;
    const c = out[out.length - 1];
    if (c && c.t === k) { c.h = Math.max(c.h, b.h); c.l = Math.min(c.l, b.l); c.c = b.c; c.v += b.v; }
    else out.push({ ...b, t: k });
  }
  return out;
}
const m1Tail = (ticker: string) => cached(`m1:${ticker}`, 5000, () => duka(ticker, 1600, Date.now(), "1MIN"));
const h1Tail = (ticker: string) => cached(`h1:${ticker}`, 120e3, () => duka(ticker, 900, Date.now(), "1HOUR"));
/* Dukascopy лаа нь bid үнэ (Swissquote-ийн bid-тэй 0.01–0.13-аар таарна), харин ханш нь bid/ask-ийн дундаж, spread ≈$0.64
   (2026-11-06 хэмжсэн). Лаа, төлөвлөгөө, ханш нэг түвшинд байхын тулд лааг хагас spread-ээр өргөнө. */
const XAU_MID = 0.3;
const toMid = (b: Bar[]) => b.map((x) => ({ ...x, o: x.o + XAU_MID, h: x.h + XAU_MID, l: x.l + XAU_MID, c: x.c + XAU_MID }));
export const bars = (sym: Sym, tf: TF) => cached(`b:${sym}:${tf}`, TTL[tf], async () => {
  const s = SYMBOLS[sym];
  if (s.src === "binance") return binance(s.ticker, BIN[tf], 700);
  const m1 = await m1Tail(s.ticker);
  if (tf === "1m") return toMid(m1.slice(-700));
  const base = await duka(s.ticker, Math.min(700, DUKA_PAGE[tf]), Date.now(), DUKA[tf]);
  if (TF_MIN[tf] < 240) return toMid(rollup(base, m1, tf));
  const h1 = await h1Tail(s.ticker), from = m1[0]?.t ?? Infinity;
  return toMid(rollup(base, [...h1.filter((b) => b.t + 3600e3 <= from), ...m1], tf));
});
/** Сүүлийн лааг бодит үнээр шинэчилнэ, цаг нь шилжсэн бол шинэ лаа нээнэ */
export function withLive(b: Bar[], tf: TF, px: number, now = Date.now()): Bar[] {
  if (!b.length || !(px > 0)) return b;
  const out = b.slice(), k = bucket(now, tf), l = out[out.length - 1];
  if (l.t === k) out[out.length - 1] = { ...l, h: Math.max(l.h, px), l: Math.min(l.l, px), c: px };
  else if (k > l.t) out.push({ t: k, o: l.c, h: Math.max(l.c, px), l: Math.min(l.c, px), c: px, v: 0 });
  return out;
}
/** Хэмжилтэд: хамгийн ихдээ ≈5000 лаа */
export async function deep(sym: Sym, tf: TF): Promise<Bar[]> {
  const s = SYMBOLS[sym];
  if (s.src === "duka") return tf === "15m" || tf === "30m" ? dukaSince(s.ticker, DUKA[tf], Date.now() - 90 * 864e5, DUKA_PAGE[tf]) : duka(s.ticker, DUKA_PAGE[tf], Date.now(), DUKA[tf]);
  let out: Bar[] = [], end: number | undefined;
  for (let k = 0; k < 5; k++) {
    const part = await binance(s.ticker, BIN[tf], 1000, end);
    if (!part.length) break;
    out = [...part.filter((b) => !out.length || b.t < out[0].t), ...out];
    end = part[0].t - 1;
    if (part.length < 1000) break;
  }
  return out;
}
export const closedOf = (b: Bar[], tf: TF, now = Date.now()) => (b.length && b[b.length - 1].t + TF_MIN[tf] * 60000 > now ? b.slice(0, -1) : b);

/* 24 цагийн өмнөх ханшийг дэвсгэрт шинэчилнэ — секунд тутмын үнийг лааны татлага хэзээ ч саатуулахгүй */
const refs = new Map<Sym, { at: number; ref: number }>();
async function ref24(sym: Sym) {
  const c = refs.get(sym);
  if (c && Date.now() - c.at < 60e3) return c.ref;
  refs.set(sym, { at: Date.now(), ref: c?.ref ?? 0 });
  const load = bars(sym, "1H").then((h) => {
    let ref = h[0]?.c ?? 0;
    for (let k = h.length - 1; k >= 0; k--) if (h[k].t <= Date.now() - 864e5) { ref = h[k].c; break; }
    refs.set(sym, { at: Date.now(), ref });
    return ref;
  }).catch(() => c?.ref ?? 0);
  return c ? c.ref : load;
}
export type Quote = { px: number; bid: number; ask: number; t: number; chg: number };
const G = globalThis as { __deskQuote?: Map<Sym, { at: number; q: Quote }> };
const latest: Map<Sym, { at: number; q: Quote }> = (G.__deskQuote ??= new Map());
const round = (sym: Sym, x: number) => +x.toFixed(SYMBOLS[sym].digits + 1);

/** Кэшгүй шууд ханш. Hub секундэд хэд хэдэн удаа дуудах тул завсрын кэш энд байж болохгүй: хоёр 900 мс кэш ханшийг 2 секунд болгож байсан. */
export async function liveQuote(sym: Sym): Promise<Quote | null> {
  let bid = 0, ask = 0, px = 0, t = Date.now();
  if (sym === "XAUUSD") {
    const r = await fetch("https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD", { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(1500), cache: "no-store" });
    if (!r.ok) return null;
    const d = (await r.json()) as { spreadProfilePrices: { spreadProfile: string; bid: number; ask: number }[]; ts: number }[];
    const p = d?.[0]?.spreadProfilePrices?.find((x) => x.spreadProfile === "prime") || d?.[0]?.spreadProfilePrices?.[0];
    if (!p || !(p.ask > p.bid)) return null;
    bid = p.bid; ask = p.ask; px = (bid + ask) / 2; t = d[0].ts;
  } else {
    const r = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", { signal: AbortSignal.timeout(1200), cache: "no-store" });
    if (!r.ok) return null;
    px = +((await r.json()) as { price: string }).price; bid = ask = px;
  }
  if (!(px > 0)) return null;
  const ref = await ref24(sym), q = { px: round(sym, px), bid, ask, t, chg: ref ? +(((px - ref) / ref) * 100).toFixed(2) : 0 };
  latest.set(sym, { at: Date.now(), q });
  return q;
}
/** Hub ажиллаж байвал яг тэр tick-ийг өгнө: чартын сүүлийн лаа, толгойн ханш нэг тоо байна */
export const quote = (sym: Sym): Promise<Quote> => {
  const h = latest.get(sym);
  if (h && Date.now() - h.at < 1500) return Promise.resolve(h.q);
  return cached(`q:${sym}`, 900, async () => {
    const q = await liveQuote(sym).catch(() => null);
    if (q) return q;
    const m = await bars(sym, "1m"), l = m[m.length - 1], px = l?.c ?? 0, ref = await ref24(sym);
    return { px: round(sym, px), bid: 0, ask: 0, t: l?.t ?? Date.now(), chg: ref ? +(((px - ref) / ref) * 100).toFixed(2) : 0 };
  });
};

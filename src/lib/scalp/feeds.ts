import type { Bar } from "./ind";
import type { Inst } from "./engine";

/* ─── Tesla Trader · Scalp — өгөгдлийн эх сурвалж (2026-11-04, droplet-оос хэмжсэн) ───
   Валют + алт: Dukascopy-ийн нийтийн чарт (freeserv, Swiss ECN) — бодит OHLC 1 мин, тикийн эзлэхүүнтэй,
     нэг хүсэлтээр 30,000 лаа (≈29 хоног), бодит цаг. Referer толгойгүй бол 403.
     Yahoo-г ХЭРЭГЛЭХГҮЙ: EURUSD/GBPUSD-ийн 1 мин лаа нь o=h=l=c (минутад нэг үнэ) — сүүдэргүй тул
     SL/TP-ийн цохилт, ATR бүгд худлаа гарна. Yahoo-ийн алт (GC=F) 10 мин хоцордог.
   Крипто: Binance 1 мин. Spread: Swissquote-ийн нийтийн BBO (prime профайл ≈ жижиглэнгийн).
   Мэдээ: ForexFactory долоо хоногийн JSON. Бүгд түлхүүргүй; нэг процессын кэшээр (pm2 fork, 1 instance). */

const UA = { "User-Agent": "Mozilla/5.0" };

/** Dukascopy: timestamp-аас өмнөх `limit` лаа (bid), өсөх дарааллаар. interval: 1MIN · 5MIN · 15MIN · 1HOUR · 4HOUR · 1DAY */
export async function duka(instr: string, limit: number, ts = Date.now(), interval = "1MIN"): Promise<Bar[]> {
  const q = `path=chart/json3&instrument=${encodeURIComponent(instr)}&offer_side=B&interval=${interval}&splits=true&stocks=true&limit=${limit}&time_direction=P&timestamp=${ts}&jsonp=_callbacks____1`;
  const r = await fetch(`https://freeserv.dukascopy.com/2.0/?${q}`, { headers: { ...UA, Referer: "https://freeserv.dukascopy.com/" }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!r.ok) throw new Error(`Dukascopy ${instr} ${r.status}`);
  const t = await r.text(), a = JSON.parse(t.slice(t.indexOf("(") + 1, t.lastIndexOf(")"))) as number[][];
  return a.map((k) => ({ t: k[0], o: k[1], h: k[2], l: k[3], c: k[4], v: k[5] || 0 })).filter((b) => b.o > 0 && b.h >= b.l).reverse();
}

async function binance(symbol: string, interval: string, opt: { start?: number; limit?: number }): Promise<Bar[]> {
  const q = new URLSearchParams({ symbol, interval, limit: String(opt.limit || 1000) });
  if (opt.start) q.set("startTime", String(opt.start));
  const r = await fetch(`https://api.binance.com/api/v3/klines?${q}`, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!r.ok) throw new Error(`Binance ${symbol} ${r.status}`);
  const d = (await r.json()) as (string | number)[][];
  return d.map((k) => ({ t: Number(k[0]), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
}

/** Урт түүх: хуудаслан хойш нь татна (1MIN-д нэг хуудас 30,000 ≈ 29 хоног) */
export async function dukaSince(instr: string, interval: string, from: number, page = 30000): Promise<Bar[]> {
  let out: Bar[] = [], ts = Date.now();
  for (let guard = 0; guard < 12 && ts > from; guard++) {
    const part = await duka(instr, page, ts, interval);
    if (!part.length) break;
    out = [...part.filter((b) => !out.length || b.t < out[0].t), ...out];
    ts = part[0].t - 1;
    if (part.length < page * 0.5) break;
  }
  return out.filter((b) => b.t >= from);
}

function merge(a: Bar[], b: Bar[], keep: number): Bar[] {
  if (!b.length) return a;
  const from = b[0].t, head = a.filter((x) => x.t < from);
  return [...head, ...b].slice(-keep);
}

/** Backtest-д: сүүлийн ≈28 хоногийн 1 мин лаа */
export async function history(inst: Pick<Inst, "src" | "ticker">, days = 28): Promise<Bar[]> {
  const now = Date.now();
  if (inst.src === "duka") return (await duka(inst.ticker, 30000, now)).filter((b) => b.t >= now - days * 864e5);
  let out: Bar[] = [];
  for (let s = now - days * 864e5; s < now; ) {
    const part = await binance(inst.ticker, "1m", { start: s, limit: 1000 });
    if (!part.length) break;
    out = merge(out, part, 1e6);
    s = part[part.length - 1].t + 60000;
    if (part.length < 1000) break;
  }
  return out;
}

/* ── бодит цагийн 1 мин кэш: эхлээд ~5 хоног, дараа нь сүүлийн хэдэн минутыг л нэмж татна ── */
type Live = { bars: Bar[]; at: number; full: number; p?: Promise<Bar[]> };
const live = new Map<string, Live>();
export async function liveM1(inst: Pick<Inst, "src" | "ticker">, ttl = 20_000): Promise<Bar[]> {
  const key = inst.ticker, now = Date.now();
  let c = live.get(key);
  if (c && c.bars.length && now - c.at < ttl) return c.bars;
  if (c?.p) return c.p;
  if (!c) { c = { bars: [], at: 0, full: 0 }; live.set(key, c); }
  const cur = c;
  cur.p = (async () => {
    const fullLoad = !cur.bars.length || now - cur.full > 6 * 3600e3;
    const lastT = cur.bars[cur.bars.length - 1]?.t || 0;
    let fresh: Bar[];
    if (inst.src === "duka") fresh = await duka(inst.ticker, fullLoad ? 8000 : Math.min(500, Math.max(10, Math.ceil((now - lastT) / 60000) + 5)), now);
    else if (fullLoad) {
      fresh = [];
      for (let k = 6; k >= 1; k--) fresh = merge(fresh, await binance(inst.ticker, "1m", { start: now - k * 1000 * 60000, limit: 1000 }), 1e6);
    } else fresh = await binance(inst.ticker, "1m", { start: lastT - 5 * 60000, limit: 1000 });
    cur.bars = fullLoad ? fresh.slice(-8000) : merge(cur.bars, fresh, 8000);
    if (fullLoad) cur.full = now;
    cur.at = Date.now();
    return cur.bars;
  })().finally(() => { cur.p = undefined; });
  return cur.p;
}
/** Зөвхөн бүрэн хаагдсан лаа (одоо үүсч буй минутыг хасна) */
export const closed = (bars: Bar[], now = Date.now()) => (bars.length && bars[bars.length - 1].t + 60000 > now ? bars.slice(0, -1) : bars);

/* ── spread: Swissquote BBO (prime) ── */
export type Quote = { bid: number; ask: number; spread: number; ts: number };
const quotes = new Map<string, { q: Quote | null; at: number }>();
export async function bbo(inst: Pick<Inst, "sq">, ttl = 10_000): Promise<Quote | null> {
  if (!inst.sq) return null;
  const c = quotes.get(inst.sq);
  if (c && Date.now() - c.at < ttl) return c.q;
  let q: Quote | null = null;
  try {
    const r = await fetch(`https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${inst.sq}`, { headers: UA, signal: AbortSignal.timeout(6000), cache: "no-store" });
    const d = (await r.json()) as { spreadProfilePrices: { spreadProfile: string; bid: number; ask: number }[]; ts: number }[];
    const p = d?.[0]?.spreadProfilePrices?.find((x) => x.spreadProfile === "prime") || d?.[0]?.spreadProfilePrices?.[0];
    if (p && p.ask > p.bid) q = { bid: p.bid, ask: p.ask, spread: p.ask - p.bid, ts: d[0].ts };
  } catch { /* spread мэдэгдэхгүй бол ердийн утгыг ашиглана */ }
  quotes.set(inst.sq, { q, at: Date.now() });
  return q;
}

/* ── эдийн засгийн мэдээ (ForexFactory) ── */
export type NewsEv = { t: number; ccy: string; title: string; impact: "High" | "Medium" | "Low"; forecast: string; previous: string };
let newsCache: { at: number; ev: NewsEv[] } = { at: 0, ev: [] };
export async function news(): Promise<NewsEv[]> {
  if (newsCache.at && Date.now() - newsCache.at < 30 * 60e3) return newsCache.ev;
  try {
    const r = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", { headers: UA, signal: AbortSignal.timeout(8000), cache: "no-store" });
    const d = (await r.json()) as { title: string; country: string; date: string; impact: string; forecast: string; previous: string }[];
    const ev = d.filter((x) => ["High", "Medium", "Low"].includes(x.impact)).map((x) => ({ t: Date.parse(x.date), ccy: x.country, title: x.title, impact: x.impact as NewsEv["impact"], forecast: x.forecast || "", previous: x.previous || "" })).filter((x) => Number.isFinite(x.t));
    newsCache = { at: Date.now(), ev };
  } catch {
    newsCache = { ...newsCache, at: Date.now() - 25 * 60e3 };  /* 5 мин дараа дахин оролдоно */
  }
  return newsCache.ev;
}

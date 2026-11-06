import { liveQuote, SYMBOLS, type Sym } from "./market";

/* ─── Tesla Trader · бодит цагийн урсгал (2026-11-06) ───
   Нэг хэрэгсэлд нэг л давталт, бүх үзэгчид SSE-ээр түгээнэ. Сонсогчгүй бол зогсоно.
   Давталт өөрөө хэмнэлээ барина: өмнөх хариу ирсний дараа л дараагийн хүсэлт явна, тиймээс удаан хариу давхцахгүй.
   Хэмжсэн хурд: алт Swissquote ≈2 шинэ үнэ/сек (RTT 450 мс), биткойн Binance 4 хүсэлт/сек (RTT 85 мс).
   Node 20 тул сервер талд WebSocket клиент алга. Үнэ хөдлөхгүй бол секундэд нэг удаа амьд гэдгээ мэдэгдэнэ. */

export type Tick = { sym: Sym; px: number; bid: number; ask: number; chg: number; t: number; at: number };
type Hub = { subs: Set<(t: Tick) => void>; last: Tick | null; run: boolean };
const G = globalThis as { __deskHub2?: Map<Sym, Hub> };
const hubs: Map<Sym, Hub> = (G.__deskHub2 ??= new Map());
const PACE: Record<Sym, number> = { XAUUSD: 300, BTCUSDT: 250 }, IDLE = 2000, QUIET = 60e3;

function hub(sym: Sym) {
  let h = hubs.get(sym);
  if (!h) { h = { subs: new Set(), last: null, run: false }; hubs.set(sym, h); }
  return h;
}
async function loop(sym: Sym, h: Hub) {
  let sent = 0, moved = Date.now();
  while (h.subs.size) {
    const at = Date.now(), q = await liveQuote(sym).catch(() => null);
    if (q) {
      const change = q.px !== h.last?.px, now = Date.now();
      if (change) moved = now;
      h.last = { sym, ...q, at: now };
      if (change || now - sent >= 1000) { sent = now; h.subs.forEach((f) => f(h.last!)); }
    }
    /* амралтын өдөр, хаалттай үед эх үүсвэрийг дэмий цохихгүй */
    const pace = Date.now() - moved > QUIET ? IDLE : PACE[sym];
    await new Promise((r) => setTimeout(r, Math.max(0, pace - (Date.now() - at))));
  }
  h.run = false;
}
export function subscribe(sym: Sym, fn: (t: Tick) => void) {
  if (!(sym in SYMBOLS)) throw new Error("sym");
  const h = hub(sym);
  h.subs.add(fn);
  if (h.last) fn(h.last);
  if (!h.run) { h.run = true; loop(sym, h).catch(() => { h.run = false; }); }
  return () => { h.subs.delete(fn); };
}

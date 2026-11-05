import { quote, SYMBOLS, type Sym } from "./market";

/* ─── Tesla Trader · бодит цагийн урсгал (2026-11-06) ───
   Нэг хэрэгсэлд нэг л эх үүсвэрийн давталт (1 сек), бүх үзэгчид SSE-ээр түгээнэ. Сонсогчгүй бол зогсоно.
   Node 20 тул сервер талд WebSocket клиент алга — BTC ч ижил давталтаар. */

export type Tick = { sym: Sym; px: number; bid: number; ask: number; chg: number; t: number; at: number };
type Hub = { subs: Set<(t: Tick) => void>; last: Tick | null; timer: ReturnType<typeof setInterval> | null };
const G = globalThis as { __deskHub?: Map<Sym, Hub> };
const hubs = (G.__deskHub ??= new Map());

function hub(sym: Sym) {
  let h = hubs.get(sym);
  if (!h) { h = { subs: new Set(), last: null, timer: null }; hubs.set(sym, h); }
  return h;
}
async function poll(sym: Sym, h: Hub) {
  try {
    const q = await quote(sym);
    if (!(q.px > 0)) return;
    h.last = { sym, px: q.px, bid: q.bid, ask: q.ask, chg: q.chg, t: q.t, at: Date.now() };
    h.subs.forEach((f) => f(h.last!));
  } catch { /* дараагийн секундэд */ }
}
export function subscribe(sym: Sym, fn: (t: Tick) => void) {
  if (!(sym in SYMBOLS)) throw new Error("sym");
  const h = hub(sym);
  h.subs.add(fn);
  if (h.last) fn(h.last);
  if (!h.timer) { poll(sym, h); h.timer = setInterval(() => poll(sym, h), 1000); h.timer.unref?.(); }
  return () => {
    h.subs.delete(fn);
    if (!h.subs.size && h.timer) { clearInterval(h.timer); h.timer = null; }
  };
}

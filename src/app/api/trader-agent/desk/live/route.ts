import { NextRequest } from "next/server";
import { SYMBOLS, type Sym } from "@/lib/desk/market";
import { subscribe } from "@/lib/desk/live";

/* SSE: секунд тутмын үнэ. Нийтийн зах зээлийн ханш тул нэвтрэлт шаардахгүй; нэг hub-аас түгээдэг тул зардалгүй. */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sym = req.nextUrl.searchParams.get("sym") || "XAUUSD";
  if (!(sym in SYMBOLS)) return new Response("bad sym", { status: 400 });
  const enc = new TextEncoder();
  let stop = () => {}, ping: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream({
    start(c) {
      const send = (s: string) => { try { c.enqueue(enc.encode(s)); } catch { stop(); } };
      const un = subscribe(sym as Sym, (t) => send(`data: ${JSON.stringify(t)}\n\n`));
      ping = setInterval(() => send(": ping\n\n"), 15000);
      stop = () => { un(); if (ping) clearInterval(ping); ping = null; };
      req.signal.addEventListener("abort", () => { stop(); try { c.close(); } catch { /* хаагдсан */ } });
    },
    cancel() { stop(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}

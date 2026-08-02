import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { addSubscriber } from "@/lib/sseHub";

// Server-Sent Events endpoint for realtime feed updates. Clients open one
// long-lived connection on mount; we push `post-created` and
// `comment-created` events as they happen elsewhere in the app via
// broadcastSSE().
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      // Tell nginx not to buffer; tell browsers we're streaming.
      send("retry: 5000\n\n");
      send(": connected\n\n");

      // 25s heartbeat — keeps the connection alive past nginx's default
      // 60s proxy_read_timeout. Browser auto-reconnects via `retry:` if
      // the connection ever does drop.
      const heartbeat = setInterval(() => {
        try { send(": ping\n\n"); } catch { /* dead */ }
      }, 25_000);

      const remove = addSubscriber({ id: randomUUID(), send });

      const cleanup = () => {
        clearInterval(heartbeat);
        remove();
        try { controller.close(); } catch { /* already closed */ }
      };

      // Browser navigated away / closed tab
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no", // explicit hint to nginx
      Connection: "keep-alive",
    },
  });
}

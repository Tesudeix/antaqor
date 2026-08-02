"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

// Single global EventSource — opened once per session. Receives realtime
// `post-created` and `comment-created` events from the server-side hub
// (src/lib/sseHub.ts) and re-dispatches them as window CustomEvents so
// existing components (home feed `feed:refresh`, PostCard CommentsThread
// `comment:created`) react without any new wiring.
export default function RealtimeBridge() {
  const { status } = useSession();

  useEffect(() => {
    // Don't burn a connection for guests — they won't have a personalized
    // feed anyway. Authed users only.
    if (status !== "authenticated") return;
    if (typeof window === "undefined") return;

    let es: EventSource | null = null;
    let backoff = 1000;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      es = new EventSource("/api/posts/stream");

      es.addEventListener("chat-message", (e) => {
        try {
          window.dispatchEvent(
            new CustomEvent("chat:message", { detail: JSON.parse((e as MessageEvent).data) })
          );
        } catch {
          /* malformed frame — ignore */
        }
      });

      es.addEventListener("post-created", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          if (data?.post) {
            window.dispatchEvent(new CustomEvent("feed:refresh", { detail: data.post }));
          }
        } catch { /* malformed payload */ }
      });

      es.addEventListener("comment-created", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          if (data?.postId && data?.comment) {
            window.dispatchEvent(new CustomEvent("comment:created", { detail: data }));
          }
        } catch { /* malformed payload */ }
      });

      es.onopen = () => { backoff = 1000; };
      es.onerror = () => {
        // Browser already auto-reconnects via the `retry:` header, but on
        // some networks the EventSource itself dies. Manual reconnect with
        // backoff covers that case.
        if (es && es.readyState === EventSource.CLOSED) {
          es = null;
          if (!stopped) {
            timer = setTimeout(connect, Math.min(backoff, 30_000));
            backoff *= 2;
          }
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (es) es.close();
    };
  }, [status]);

  return null;
}

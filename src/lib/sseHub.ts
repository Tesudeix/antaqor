// ─── SSE broadcast hub ────────────────────────────────────────────────
// Single in-memory subscriber set, shared across all server-side modules
// in this Node process. Works because pm2 runs antaqor as 1 instance —
// if you ever scale to N instances, swap this for Redis pub/sub.

type Subscriber = {
  id: string;
  send: (chunk: string) => void;
};

// Module-level singleton — persists across hot reloads in dev because we
// stash it on `globalThis`. Without this, dev HMR creates orphaned sets
// and broadcasts vanish.
const G = globalThis as unknown as { __antaqorSseSubs?: Set<Subscriber> };
const subs: Set<Subscriber> = G.__antaqorSseSubs ?? (G.__antaqorSseSubs = new Set());

export function addSubscriber(s: Subscriber): () => void {
  subs.add(s);
  return () => { subs.delete(s); };
}

// Broadcast an SSE-formatted event. Failed sends auto-evict.
export function broadcastSSE(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const s of Array.from(subs)) {
    try {
      s.send(payload);
    } catch {
      subs.delete(s);
    }
  }
}

export function subscriberCount(): number {
  return subs.size;
}

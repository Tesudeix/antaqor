// ─── In-memory token-bucket rate limiter ───
// Single-process safe. For multi-instance scaling, swap to Redis later.
// Keyed by arbitrary string (IP, userId, or composite like `upload:userId`).

interface Bucket {
  tokens: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// Periodic GC so the map doesn't grow unbounded for stale keys.
// Runs every 5 min; drops buckets untouched for >1h.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      if (now - b.windowStart > 60 * 60_000) buckets.delete(key);
    }
  }, 5 * 60_000).unref?.();
}

export interface RateConfig {
  max: number;       // max requests in window
  windowMs: number;  // window size in ms
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  resetInMs: number;
  limit: number;
}

/** Consume one token. Returns ok=false if empty. */
export function rateLimit(key: string, cfg: RateConfig): RateResult {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now - b.windowStart >= cfg.windowMs) {
    buckets.set(key, { tokens: cfg.max - 1, windowStart: now });
    return { ok: true, remaining: cfg.max - 1, resetInMs: cfg.windowMs, limit: cfg.max };
  }

  if (b.tokens > 0) {
    b.tokens -= 1;
    return {
      ok: true,
      remaining: b.tokens,
      resetInMs: cfg.windowMs - (now - b.windowStart),
      limit: cfg.max,
    };
  }

  return {
    ok: false,
    remaining: 0,
    resetInMs: cfg.windowMs - (now - b.windowStart),
    limit: cfg.max,
  };
}

/** Peek without consuming — useful for dashboards. */
export function rateInspect(key: string, cfg: RateConfig): RateResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.windowStart >= cfg.windowMs) {
    return { ok: true, remaining: cfg.max, resetInMs: cfg.windowMs, limit: cfg.max };
  }
  return {
    ok: b.tokens > 0,
    remaining: b.tokens,
    resetInMs: cfg.windowMs - (now - b.windowStart),
    limit: cfg.max,
  };
}

/** Extract client IP from Next.js request headers. */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

// ─── Predefined limit configs (single source of truth) ───
export const LIMITS = {
  SIGNUP_PER_IP: { max: 3, windowMs: 60 * 60_000 },           // 3/hour
  SIGNIN_PER_IP: { max: 20, windowMs: 60 * 60_000 },          // 20/hour (generous but caps brute force)
  UPLOAD_FREE_PER_DAY: { max: 5, windowMs: 24 * 60 * 60_000 },
  UPLOAD_PAID_PER_DAY: { max: 30, windowMs: 24 * 60 * 60_000 },
  UPLOAD_PER_MINUTE: { max: 3, windowMs: 60_000 },            // burst cap for everyone
  POST_FREE_PER_HOUR: { max: 3, windowMs: 60 * 60_000 },
  POST_PAID_PER_HOUR: { max: 30, windowMs: 60 * 60_000 },
  USER_PUT_PER_HOUR: { max: 20, windowMs: 60 * 60_000 },
  SHARE_PER_MINUTE: { max: 20, windowMs: 60_000 },
  GLOBAL_PER_IP_PER_MIN: { max: 300, windowMs: 60_000 },      // abuse floor
  AI_TOOL_PER_MINUTE: { max: 2, windowMs: 60_000 },           // burst cap on Gemini-backed tools
  AI_TOOL_PER_DAY: { max: 20, windowMs: 24 * 60 * 60_000 },   // generous daily cap so one user can't drain the key
} as const;

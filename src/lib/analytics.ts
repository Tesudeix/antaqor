// Thin GA4 wrapper. Safe on the server (every fn no-ops if window/gtag missing).
// Use `track()` for normal events; `trackOnce()` for funnel milestones we want
// to fire exactly once per user (signup_complete, first_agent_chat, paid_member).

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type FunnelEvent =
  | "home_view"
  | "signup_click"
  | "signup_complete"
  | "first_agent_chat"
  | "paid_member"
  // Generic events you can keep adding without changing this file:
  | (string & { _generic?: never });

function send(event: FunnelEvent, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  // Push to dataLayer even if gtag hasn't initialised yet — GTM picks it up later.
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event, ...params });
  }
  if (typeof window.gtag === "function") {
    window.gtag("event", event, params || {});
  }
}

export function track(event: FunnelEvent, params?: Record<string, unknown>) {
  try { send(event, params); } catch { /* never let analytics throw */ }
}

const STORAGE_PREFIX = "aq_ga_once:";

export function trackOnce(event: FunnelEvent, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const key = STORAGE_PREFIX + event;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
    send(event, params);
  } catch {
    // Storage blocked (private mode etc.) — fall back to firing every time.
    // Better to over-count than under-count for a one-shot funnel event.
    send(event, params);
  }
}

// Surface in case we ever need to reset the dedupe (e.g. logout).
export function clearOnceDedupe(event?: FunnelEvent) {
  if (typeof window === "undefined") return;
  try {
    if (event) {
      window.localStorage.removeItem(STORAGE_PREFIX + event);
    } else {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
      }
      for (const k of keys) window.localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

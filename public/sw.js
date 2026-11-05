// Antaqor service worker — v77 (push-only, NO fetch interception).
//
// History: earlier versions cached navigations / pages / admin responses, which
// repeatedly served stale content — including a cached 404 for /admin/broadcast
// that survived refreshes and SW bumps. There is no real upside: nginx already
// serves /_next/static as `immutable`, so the browser HTTP cache handles asset
// perf. So this worker intentionally has **no fetch handler** — it never
// intercepts a request, which makes stale-cache bugs structurally impossible —
// while keeping push notifications working.
//
// On activate it deletes EVERY cache from older workers (clean slate) and claims
// all clients, so any device that fetches this file is healed immediately.

const SW_VERSION = "antaqor-v78-pushonly-heal";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      // One-time self-heal: force every open tab to reload once. This clears a
      // stale in-memory Next.js router cache (a prefetch poisoned as "not-found"
      // during a deploy, which made client-side clicks render a 404 even though
      // the route returns 200). Same-version reloads don't re-trigger activate,
      // so this runs exactly once per client.
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((wins) =>
        wins.forEach((c) => {
          try { c.navigate(c.url); } catch (_e) { /* navigation not allowed; ignore */ }
        })
      )
  );
});

// NO "fetch" listener on purpose — the browser handles every request directly,
// so the SW can never serve a stale page / 404.

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// ─── Push Notifications (preserved) ───
self.addEventListener("push", (event) => {
  let data = { title: "Antaqor", body: "Шинэ мэдэгдэл", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // fallback
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon",
      data: { url: data.url || "/" },
      vibrate: [100, 50, 100],
      tag: data.tag || "default",
      renotify: !!data.tag,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

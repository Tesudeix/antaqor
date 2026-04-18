const CACHE_VERSION = "antaqor-v3";
const STATIC_CACHE = "antaqor-static-v3";
const API_CACHE = "antaqor-api-v1";
const OFFLINE_URL = "/offline";

// App shell to precache
const PRECACHE_URLS = [
  "/",
  "/offline",
  "/manifest.json",
  "/logo.png",
  "/favicon.svg",
];

// ─── Install: precache app shell ───
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// ─── Activate: clean old caches ───
self.addEventListener("activate", (event) => {
  const keep = [STATIC_CACHE, API_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: strategy routing ───
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, etc.
  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;

  // Navigation requests: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // API requests: stale-while-revalidate
  if (url.pathname.startsWith("/api/")) {
    // Skip auth/push/upload endpoints
    if (
      url.pathname.includes("/auth/") ||
      url.pathname.includes("/push/") ||
      url.pathname.includes("/upload")
    ) {
      return;
    }

    event.respondWith(
      caches.open(API_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetched = fetch(request)
            .then((response) => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached);

          return cached || fetched;
        })
      )
    );
    return;
  }

  // Fonts (Google Fonts etc.): cache-first
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }
});

// ─── Push Notifications ───
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

// ─── Notification Click ───
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if any
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

// ─── Message: skip waiting ───
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

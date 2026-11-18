// GymApra V2 Lightweight Service Worker - Static Asset Caching
const CACHE_NAME = "gymapra-v2-static-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  // Pass-through for all API, auth, server actions, and HTML/RSC navigation requests
  // so live gym operations and authentication are never stale
  const isHtmlOrRsc =
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html") ||
    request.headers.get("rsc") === "1" ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/auth");

  if (isHtmlOrRsc) {
    return;
  }

  // Cache-First strategy for Next.js static bundles, fonts, icons, and static images
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/i);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
  }
});

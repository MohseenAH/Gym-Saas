// GymApra V2 Lightweight Service Worker - Static Asset Caching
const CACHE_NAME = "gymapra-v2-static-v2";

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

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Exclude unsupported schemes (e.g., chrome-extension://) and cross-origin requests
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }
  if (url.origin !== self.location.origin) {
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

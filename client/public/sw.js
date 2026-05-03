const HTML_CACHE = "nisam-video-html-v5";
const STATIC_CACHE = "nisam-video-static-v5";
const IMAGE_CACHE = "nisam-video-images-v5";
const urlsToCache = ["/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(HTML_CACHE)
      .then((cache) => {
        console.log("Opened cache");
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log("Cache installation failed:", error);
      }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== HTML_CACHE && cacheName !== STATIC_CACHE && cacheName !== IMAGE_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Skip non-GET requests (POST, PUT, DELETE, etc.)
  if (event.request.method !== "GET") {
    return;
  }

  // Skip API requests - these should never be cached
  if (event.request.url.includes("/api/")) {
    return;
  }

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  // Skip non-http(s) schemes
  if (!event.request.url.startsWith("http")) {
    return;
  }

  // Handle navigation requests (HTML pages)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Cache images (Stale-While-Revalidate)
  if (event.request.destination === "image" || url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|avif)$/)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(IMAGE_CACHE).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Cache JS and CSS (Stale-While-Revalidate)
  if (event.request.destination === "script" || event.request.destination === "style") {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});

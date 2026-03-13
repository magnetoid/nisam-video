const HTML_CACHE = "nisam-video-html-v4";
const STATIC_CACHE = "nisam-video-static-v4";
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

  // Skip chrome-extension and other non-http(s) schemes
  if (!event.request.url.startsWith("http")) {
    return;
  }

  // Skip browser extension requests
  if (event.request.url.startsWith("chrome-extension://")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html")),
    );
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;
  const pathname = url.pathname;
  const isAsset = isSameOrigin && pathname.startsWith("/assets/");
  const isStaticFile = /\.(?:js|css|map|json|txt|xml|webmanifest)$/i.test(pathname);
  const isMedia = /\.(?:png|jpg|jpeg|webp|gif|svg|ico|mp4|webm|woff2?|ttf|otf)$/i.test(pathname);

  // Never cache HTML/JS/CSS (prevents stale bundles after deploy)
  if (isAsset || isStaticFile) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for images/fonts/media
  if (isMedia) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const res = await fetch(event.request);
        if (res && res.status === 200 && res.type === "basic") {
          cache.put(event.request, res.clone()).catch(() => {});
        }
        return res;
      }),
    );
    return;
  }

  event.respondWith(fetch(event.request));
});

self.addEventListener("activate", (event) => {
  const cacheWhitelist = [HTML_CACHE, STATIC_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

const CACHE_NAME = "nisam-video-v1";
const urlsToCache = ["/", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
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

  // Skip chrome-extension and other non-http(s) schemes
  if (!event.request.url.startsWith("http")) {
    return;
  }

  // Skip browser extension requests
  if (event.request.url.startsWith("chrome-extension://")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request)
        .then((response) => {
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }
          
          // Additional safety check before caching
          if (event.request.url.startsWith("http://") || event.request.url.startsWith("https://")) {
            const responseToCache = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              })
              .catch((error) => {
                console.log("Cache put failed:", error);
              });
          }
          
          return response;
        })
        .catch(() => {
          return caches.match("/offline.html");
        });
    }),
  );
});

self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
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

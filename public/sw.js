const CACHE_NAME = "otakureader-v1";
const STATIC_CACHE = "otakureader-static-v1";
const IMAGE_CACHE = "otakureader-images-v1";
const API_CACHE = "otakureader-api-v1";

const STATIC_ASSETS = ["/", "/manifest.json", "/favicon.ico"];

const IMAGE_CACHE_MAX_ENTRIES = 100;

async function pruneImageCache() {
  const cache = await caches.open(IMAGE_CACHE);
  const keys = await cache.keys();
  if (keys.length > IMAGE_CACHE_MAX_ENTRIES) {
    const deleteCount = keys.length - IMAGE_CACHE_MAX_ENTRIES;
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
  }
}

self.addEventListener("install", (event: any) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event: any) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== IMAGE_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event: any) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              cache.put(request, clone);
            }
            return response;
          }).catch(() => {
            if (cached) return cached;
            return new Response("Offline", { status: 503 });
          });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  if (request.destination === "image") {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
              pruneImageCache();
            }
            return response;
          }).catch(() => new Response("", { status: 503, statusText: "Offline" }));
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        if (cached) return cached;
        if (url.pathname === "/" || url.pathname === "/index.html") {
          return caches.match("/");
        }
        return new Response("Offline", { status: 503 });
      });
      return cached || fetchPromise;
    })
  );
});

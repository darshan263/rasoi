/*
 * Rasoi service worker: what makes the app installable, and lets recently opened recipes
 * work without internet (in the kitchen, on a bad connection).
 *
 *  - Built assets (/_next/static) never change under one URL: cache first.
 *  - Uploaded photos (/api/images/<id>) never change either: cache first.
 *  - Recipe and ingredient reads: network first, falling back to the last copy seen.
 *  - Pages: network first, falling back to the last copy (they are client-rendered shells).
 *  - Everything else, and every non-GET, goes straight to the network.
 *
 * Caches holding your data are named "rasoi-data-*" so signing out can delete them
 * (see signOut in components/AppShell.tsx). Photos hot-linked from other sites are left to
 * the browser's own cache: a cross-origin response is opaque, and Chrome counts each one
 * against the storage quota as several megabytes.
 */

const VERSION = "v1";
const STATIC = `rasoi-static-${VERSION}`;
const PAGES = `rasoi-pages-${VERSION}`;
const DATA = `rasoi-data-api-${VERSION}`;
const PHOTOS = `rasoi-data-photos-${VERSION}`;
const KEEP = [STATIC, PAGES, DATA, PHOTOS];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!KEEP.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC));
  } else if (url.pathname.startsWith("/api/images/")) {
    event.respondWith(cacheFirst(request, PHOTOS));
  } else if (url.pathname.startsWith("/api/recipes") || url.pathname.startsWith("/api/ingredients") || url.pathname === "/api/auth/me") {
    event.respondWith(networkFirst(request, DATA));
  } else if (request.mode === "navigate") {
    // Query strings carry the recipe id, but the page shell is the same: cache by path.
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(url.pathname, response.clone());
          return response;
        } catch (err) {
          const hit = (await cache.match(url.pathname)) || (await cache.match("/"));
          if (hit) return hit;
          throw err;
        }
      })(),
    );
  }
});

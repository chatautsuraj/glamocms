/*
 * GLAMO POS service worker (hand-written, registered in production only).
 * - App shell + static assets so the POS screen opens and sells offline.
 * - Never caches API traffic (api.glamonepal.com is cross-origin) or auth.
 * Business data lives in IndexedDB (Dexie), not here.
 */
const VERSION = "glamo-pos-v2";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const PAGES = `${VERSION}-pages`;
const SHELL_URLS = ["/", "/pos", "/login", "/dashboard", "/orders", "/images/logo.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(new Request(url, { cache: "reload" }))))).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/images/") ||
  /\.(?:js|css|woff2?|png|jpe?g|svg|webp|ico)$/.test(url.pathname);

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(ASSETS)).put(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") (await caches.open(PAGES)).put(request, response.clone());
    return response;
  } catch (err) {
    const cached = (await caches.match(request, { ignoreVary: true })) || (fallbackUrl && (await caches.match(fallbackUrl)));
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API, Firebase, fonts CDN: straight to network
  if (url.pathname === "/sw.js") return;
  if (isStatic(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/pos"));
    return;
  }
  // RSC payloads for client-side navigation
  event.respondWith(networkFirst(request));
});

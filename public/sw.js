// Service worker for Waking Life PWA (v2).
// Strategy:
//   - Shell (HTML/CSS/JS/manifest/icons): cache-first.
//   - data/lineup.json: stale-while-revalidate so refreshes land on next reload.
//   - Vendor (qrcode): cache-first.

const VERSION = "wl-v2.4.4";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE  = `${VERSION}-data`;

const SHELL_ASSETS = [
  "./",
  "index.html",
  "app.css",
  "app.js",
  "store.js",
  "helpers.js",
  "calendar.js",
  "manifest.webmanifest",
  "views/timetable.js",
  "views/lineup.js",
  "views/favourites.js",
  "views/info.js",
  "components/event-row.js",
  "components/event-block.js",
  "components/detail-modal.js",
  "components/share-sheet.js",
  "components/add-event-form.js",
  "vendor/qrcode.mjs",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith("/data/lineup.json")) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) (await caches.open(SHELL_CACHE)).put(req, res.clone());
    return res;
  } catch (e) {
    if (req.mode === "navigate") {
      const fallback = await caches.match("index.html");
      if (fallback) return fallback;
    }
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await network) || new Response("{}", { headers: { "Content-Type": "application/json" } });
}

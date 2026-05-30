/*
 * BondCheck service worker (PLAN D2). Hand written, no build step, so it works the same on
 * Vercel and on Cloudflare. Strategies:
 *   - shell assets (/_next/static, /icons, fonts): cache first, they are content hashed
 *   - draw result pages: stale while revalidate (results are immutable once published)
 *   - other pages: network first with a timeout, then cache, then the offline page
 *   - public bond and market JSON: stale while revalidate
 *   - wallet API, RSC payloads, POST requests, other origins: never touched
 * Push handlers live in /sw-push.js (wallet lane) and are imported when present.
 */

const VERSION = "v1";
const STATIC_CACHE = `bc-static-${VERSION}`;
const PAGE_CACHE = `bc-pages-${VERSION}`;
const DATA_CACHE = `bc-data-${VERSION}`;
const LOCALES = ["en", "ur"];
const PRECACHE = [
  "/en",
  "/ur",
  "/en/offline",
  "/ur/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];
const LIMITS = { [STATIC_CACHE]: 250, [PAGE_CACHE]: 80, [DATA_CACHE]: 60 };
const NETWORK_TIMEOUT_MS = 4000;

// Tells the wallet's push script that the shell worker owns install, activate and fetch.
self.BONDCHECK_SHELL_SW = true;
try {
  importScripts("/sw-push.js");
} catch {
  // Push support is optional until the wallet lane ships sw-push.js.
}

/** Decides how a request is handled. Pure, exported for tests through `self.__bcRoute`. */
function route(url, request) {
  if (request.method !== "GET") return "bypass";
  if (url.origin !== self.location.origin) return "bypass";
  const p = url.pathname;
  if (p === "/sw.js" || p === "/sw-push.js") return "bypass";
  if (p.startsWith("/api/v1/wallets") || p.startsWith("/api/v1/cron") || p.startsWith("/api/legacy")) return "bypass";
  if (p.startsWith("/api/v1/bonds/") || p.startsWith("/api/v1/markets/")) return "data-swr";
  if (p.startsWith("/api/")) return "bypass";
  if (p.startsWith("/_next/static/") || p.startsWith("/icons/") || /\.(?:woff2?|png|svg|ico)$/.test(p)) {
    return "static";
  }
  if (p.startsWith("/_next/")) return "bypass";
  const isPage = request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
  if (isPage) {
    if (/^\/(?:en|ur)\/prize-bonds\/[a-z0-9-]+\/\d+\/?$/.test(p)) return "page-swr";
    return "page-network";
  }
  // RSC payloads for client navigations go to the network only. When offline, Next falls back
  // to a full page load, which the page strategies above answer from the cache.
  return "bypass";
}
self.__bcRoute = route;

function localeOf(url) {
  const first = url.pathname.split("/")[1];
  return LOCALES.includes(first) ? first : "en";
}

async function trim(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const max = LIMITS[cacheName] || 100;
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function put(cacheName, request, response) {
  if (!response || !response.ok || response.redirected || response.type !== "basic") return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  void trim(cacheName);
}

async function cacheFirst(event) {
  const cached = await caches.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  event.waitUntil(put(STATIC_CACHE, event.request, response.clone()));
  return response;
}

async function staleWhileRevalidate(event, cacheName, fallback) {
  const cached = await caches.match(event.request, { ignoreVary: true });
  const network = fetch(event.request)
    .then((response) => {
      event.waitUntil(put(cacheName, event.request, response.clone()));
      return response;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || (fallback ? fallback() : Response.error());
}

async function networkFirst(event, cacheName, fallback) {
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS));
  const network = fetch(event.request)
    .then((response) => {
      event.waitUntil(put(cacheName, event.request, response.clone()));
      return response;
    })
    .catch(() => null);
  const first = await Promise.race([network, timeout]);
  if (first) return first;
  const cached = await caches.match(event.request, { ignoreVary: true, ignoreSearch: cacheName === PAGE_CACHE });
  if (cached) return cached;
  const late = await network;
  if (late) return late;
  return fallback ? fallback() : Response.error();
}

const offlinePage = (url) => async () =>
  (await caches.match(`/${localeOf(url)}/offline`)) ||
  new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGE_CACHE);
      // One failing URL must not abort the install.
      await Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE, DATA_CACHE]);
      for (const key of await caches.keys()) if (key.startsWith("bc-") && !keep.has(key)) await caches.delete(key);
      if (self.registration.navigationPreload) await self.registration.navigationPreload.disable();
      await self.clients.claim();
    })(),
  );
});

/**
 * The page posts the URLs it loaded before this worker took control (first visit), so the
 * page and its assets are available offline straight away.
 */
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    Promise.all(
      data.urls.slice(0, 120).map(async (raw) => {
        try {
          const url = new URL(raw, self.location.origin);
          const request = new Request(url.href, { headers: url.pathname.startsWith("/_next/") ? {} : { Accept: "text/html" } });
          const kind = route(url, { method: "GET", mode: "no-cors", headers: request.headers });
          const target = kind === "static" ? STATIC_CACHE : kind.startsWith("page") ? PAGE_CACHE : kind === "data-swr" ? DATA_CACHE : null;
          if (!target || (await caches.match(url.href))) return;
          const response = await fetch(request);
          await put(target, url.href, response);
        } catch {
          // Ignore: best effort.
        }
      }),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  switch (route(url, event.request)) {
    case "static":
      event.respondWith(cacheFirst(event));
      return;
    case "data-swr":
      event.respondWith(staleWhileRevalidate(event, DATA_CACHE));
      return;
    case "page-swr":
      event.respondWith(staleWhileRevalidate(event, PAGE_CACHE, offlinePage(url)));
      return;
    case "page-network":
      event.respondWith(networkFirst(event, PAGE_CACHE, offlinePage(url)));
      return;
    default:
      return;
  }
});

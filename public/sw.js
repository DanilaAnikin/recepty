/* eslint-disable no-restricted-globals */

/**
 * Service worker pro offline provoz.
 *
 * Kuchařka bez signálu je k ničemu — v kuchyni bývá wifi slabá a v obchodě
 * s nákupním seznamem taky nemusí být signál. Data samotná žijí v IndexedDB,
 * takže offline stačí obsloužit aplikační obal a statické soubory.
 *
 * Strategie:
 * - navigace (HTML): nejdřív síť, při výpadku poslední uložená verze stránky,
 *   aby se po nasazení nové verze nezaseklo staré HTML,
 * - statické soubory Next.js (`/_next/static/*`): rovnou z cache, obsahují
 *   hash v názvu a nikdy se nemění pod rukama,
 * - fotky z CDN: cache s doplněním ze sítě, ať výchozí recepty mají obrázky
 *   i offline,
 * - `/api/*`: nikdy necachovat, sync i import musí vždycky na server.
 */

const VERSION = "v2";
const SHELL_CACHE = `recepty-shell-${VERSION}`;
const ASSET_CACHE = `recepty-assets-${VERSION}`;
const IMAGE_CACHE = `recepty-images-${VERSION}`;

/** Kolik vzdálených fotek se drží offline, než se začnou zahazovat nejstarší. */
const MAX_CACHED_IMAGES = 80;

const SHELL_ASSETS = ["/", "/manifest.webmanifest", "/icon.png", "/branding/logo_wordmark.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // `addAll` selže celé, když spadne jediný soubor — proto po jednom.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(asset))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Sync a import musí vždycky na síť.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (url.origin === self.location.origin && SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, MAX_CACHED_IMAGES));
  }
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put("/", response.clone());
    }
    return response;
  } catch {
    // Aplikace je jednostránková, takže uložený kořen obslouží každou adresu
    // včetně `/?recept=12`.
    const cached = (await cache.match(request)) ?? (await cache.match("/"));
    if (cached) {
      return cached;
    }
    return new Response(
      "<!doctype html><meta charset=\"utf-8\"><title>Offline</title><p>Recepty Terinky jsou offline a stránka zatím není uložená.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      // `opaque` odpovědi (cizí CDN bez CORS) mají status 0, ale uložit se dají.
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone()).then(() => trimCache(cacheName, maxEntries));
      }
      return response;
    })
    .catch(() => null);

  return cached ?? network.then((response) => response ?? Response.error());
}

/** Drží cache na uzdě — bez toho by fotky rostly donekonečna. */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) {
    return;
  }
  for (const key of keys.slice(0, keys.length - maxEntries)) {
    await cache.delete(key);
  }
}

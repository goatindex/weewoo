// Service worker for WeeWoo.
// Caches the app shell at install time, GeoJSON stale-while-revalidate,
// and OSM tiles cache-first (bounded to MAX_TILES entries).
//
// IMPORTANT: bump SHELL_CACHE when you bump ?v=N in index.html so users
// get fresh JS/CSS.  Format: 'weewoo-shell-vN' where N matches the highest
// ?v= number across app.js / style.css / sectorisation.js.

const SHELL_CACHE  = 'weewoo-shell-v6';
const GEOJSON_CACHE = 'weewoo-geojson-v1';
const TILE_CACHE   = 'weewoo-tiles-v1';
const MAX_TILES    = 500;

// Paths relative to the SW scope — resolved against self.location at runtime.
// Keep in sync with index.html when bumping ?v=N cache-busters.
const SHELL_PATHS = [
  './',
  './index.html',
  './app.js?v=4',
  './core.js?v=1',
  './map-view.js?v=1',
  './data-loading.js?v=1',
  './modals.js?v=1',
  './persistence.js?v=1',
  './pins.js?v=1',
  './style.css?v=5',
  './sectorisation.js?v=3',
  './manifest.json',
  // CDN libraries — version-pinned, safe to cache indefinitely
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/jsts@2.12.1/dist/jsts.min.js',
  'https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/turf.min.js',
];

// ------------------------------------------------------------------ install --

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => {
      const urls = SHELL_PATHS.map(p =>
        p.startsWith('http') ? p : new URL(p, self.location).href
      );
      // Add each individually so one 404 doesn't abort the whole precache.
      return Promise.all(
        urls.map(url =>
          cache.add(url).catch(err =>
            console.warn('[sw] precache miss:', url, err.message)
          )
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ----------------------------------------------------------------- activate --

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== GEOJSON_CACHE && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// -------------------------------------------------------------------- fetch --

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);

  // ---- OSM tiles: cache-first, bounded cache ----
  if (url.hostname.endsWith('.tile.openstreetmap.org')) {
    event.respondWith(tileStrategy(request));
    return;
  }

  // ---- CDN libs (Leaflet, JSTS, Turf): cache-first ----
  if (url.hostname === 'unpkg.com' || url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // Only handle same-origin requests from here on.
  if (url.origin !== scope.origin) return;

  const path = url.pathname;

  // ---- GeoJSON data: stale-while-revalidate ----
  if (path.startsWith(scope.pathname + 'geojson/') ||
      path.startsWith(scope.pathname + 'config/')) {
    event.respondWith(staleWhileRevalidate(request, GEOJSON_CACHE));
    return;
  }

  // ---- App shell (HTML, JS, CSS, icons, manifest): cache-first ----
  event.respondWith(cacheFirst(request, SHELL_CACHE));
});

// --------------------------------------------------------- strategy helpers --

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    console.warn('[sw] cacheFirst network error:', request.url, err.message);
    return new Response('Offline — resource not cached.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise || new Response('Offline — data not cached.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' },
  });
}

async function tileStrategy(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      // Evict oldest entries if we're over the limit.
      cache.keys().then(keys => {
        if (keys.length > MAX_TILES) {
          keys.slice(0, keys.length - MAX_TILES).forEach(k => cache.delete(k));
        }
      });
    }
    return response;
  } catch (err) {
    console.warn('[sw] tile fetch failed:', request.url, err.message);
    // Return a transparent 1×1 PNG placeholder so the map stays usable.
    return new Response(
      atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
      { status: 200, headers: { 'Content-Type': 'image/png' } }
    );
  }
}

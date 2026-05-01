// Service Worker stub — registers successfully, no caching implemented yet.
// Extend this to cache GeoJSON files for offline use.

const CACHE_NAME = 'weewoo-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Passthrough — all requests go to network.
// Future: cache GeoJSON and tile responses here.
self.addEventListener('fetch', () => {});

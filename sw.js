const CACHE_NAME = 'bible-app-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './data/books.json',
  './data/cuv.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith((async () => {
    const cachedResponse = await caches.match(e.request);
    if (cachedResponse) return cachedResponse;

    const networkResponse = await fetch(e.request);
    if (e.request.url.includes('/data/') && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(e.request, networkResponse.clone());
    }
    return networkResponse;
  })());
});
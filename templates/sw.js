// Minimal service worker for an experiment served under /@@SLUG@@/.
// Enough to satisfy PWA installability and give a basic offline fallback.
// Lives in public/sw.js, so it is served at /@@SLUG@@/sw.js with scope /@@SLUG@@/.
const CACHE = '@@SLUG@@-v1';
const SCOPE = '/@@SLUG@@/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add(SCOPE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for navigations (so updates show up), cache fallback when offline.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match(SCOPE)))
    );
  }
});

/* ══════════════════════════════════════════════════════════════
   Office of Academics · Attendance — service worker

   The previous version precached /static/style.css and
   /static/images/logo.png. Neither file existed, and because
   cache.addAll() rejects the whole batch if any single request
   fails, the worker never finished installing. Fixed below.

   Strategy:
     · navigations  → network first (attendance state must be fresh)
     · static files → cache first, refreshed in the background
     · /api/*       → never cached
   ══════════════════════════════════════════════════════════════ */

const CACHE = 'ooa-attendance-v3';

const PRECACHE = [
  '/static/css/oa-core.css',
  '/static/css/oa-components.css',
  '/static/images/applogo.png',
  '/static/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // Added one at a time so a single bad URL cannot break install.
      .then(cache => Promise.all(
        PRECACHE.map(url => cache.add(url).catch(err =>
          console.warn('[sw] skipped', url, err)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Attendance state must always come from the server.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/attendance/')) return;

  // Pages: network first, cache as an offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('/')))
    );
    return;
  }

  // Static assets: cache first, refresh behind the scenes.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

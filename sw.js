// Service Worker — network-first for HTML so deploys don't serve stale asset hashes.
// force_orphan Pages deploys delete old hashed JS/CSS; cache-first index.html causes 404s.
const CACHE_NAME = 'thuchi-v1.1.2';

self.addEventListener('install', (event) => {
  const base = self.registration.scope;
  const precache = [`${base}manifest.json`, `${base}logo.svg`];
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          precache.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[sw] precache skip', url, err);
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isHtmlRequest(request, url) {
  if (request.mode === 'navigate') return true;
  const path = url.pathname;
  if (path.endsWith('.html')) return true;
  // SPA shell under /quan-ly-thu-chi/ or /
  if (path.endsWith('/') || /\/quan-ly-thu-chi\/?$/.test(path)) return true;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // HTML / navigation: always prefer network (fresh asset hashes after deploy)
  if (isHtmlRequest(event.request, url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const forRequest = response.clone();
            const forIndex = response.clone();
            void caches.open(CACHE_NAME).then((cache) => {
              void cache.put(event.request, forRequest);
              void cache.put(new Request(`${self.registration.scope}index.html`), forIndex);
            });
          }
          return response;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || caches.match(`${self.registration.scope}index.html`))
            .then((cached) => cached || Response.error()),
        ),
    );
    return;
  }

  // Static assets: network-first, cache offline fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || Response.error())),
  );
});

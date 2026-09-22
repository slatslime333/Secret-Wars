/* Secret Wars offline service worker.
 * Cache stamp is rewritten by scripts/copy-pages-bundle.mjs on each Pages build.
 * Scope is this directory (/Secret-Wars/ on GitHub Pages). */
const CACHE_NAME = 'secret-wars-offline-vc049502a';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './assets/game.js',
  './assets/game.css',
  './assets/heroes/cole.png',
  './assets/heroes/death.png',
  './assets/heroes/mender.png',
  './assets/heroes/ninja.png',
  './assets/heroes/rope.png',
  './assets/heroes/shadow.png',
  './assets/heroes/witch.png',
  './assets/audio/music.mp3',
];

const toAbsolute = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS.map(toAbsolute));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('secret-wars-offline-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

const sameOrigin = (url) => url.origin === self.location.origin;

const isNavigation = (request) =>
  request.mode === 'navigate' ||
  (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (!sameOrigin(url)) {
    return;
  }

  // Only handle requests under this SW scope (project Pages path).
  if (!url.href.startsWith(self.registration.scope)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      if (isNavigation(request)) {
        try {
          const network = await fetch(request);
          if (network.ok) {
            cache.put(toAbsolute('./index.html'), network.clone());
          }
          return network;
        } catch {
          return (
            (await cache.match(toAbsolute('./index.html'))) ||
            (await cache.match(toAbsolute('./'))) ||
            Response.error()
          );
        }
      }

      const cached =
        (await cache.match(request, { ignoreSearch: true })) ||
        (await cache.match(url.pathname.endsWith('/') ? request : url.href.split('?')[0], {
          ignoreSearch: true,
        }));

      if (cached) {
        return cached;
      }

      try {
        const network = await fetch(request);
        if (network.ok && url.pathname.includes('/assets/')) {
          cache.put(request, network.clone());
        }
        return network;
      } catch {
        return Response.error();
      }
    })(),
  );
});

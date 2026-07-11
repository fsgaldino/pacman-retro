/**
 * sw.js — Service Worker do Pac-Man Retrô v4.0
 * Estratégia: Network First com cache para assets estáticos
 * Cache scope: /demos/Pacman/ (subpath corporativo)
 */

const CACHE = 'pacman-v4';
const ASSETS = [
  '/demos/Pacman/',
  '/demos/Pacman/index.html',
  '/demos/Pacman/game.js',
  '/demos/Pacman/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // API calls: network only (prefixo /demos/Pacman/api/)
  if (event.request.url.includes('/demos/Pacman/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        if (response.ok) {
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

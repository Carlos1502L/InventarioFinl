const CACHE_NAME = 'stockly-pwa-v8';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// RN-SEC-04: Endurecimiento de Seguridad - Aislamiento estricto de Caché en Service Worker
// Queda prohibido cachear respuestas transaccionales, de autenticación o con Cache-Control: no-store
const SENSITIVE_PATH_PATTERNS = [
  /^\/api(\/|$)/i,
  /^\/rest(\/|$)/i,
  /^\/auth(\/|$)/i,
  /^\/storage(\/|$)/i,
  /^\/health(\/|$)/i,
  /^\/sales(\/|$)/i,
  /^\/reports(\/|$)/i
];

function isSensitiveRequest(url) {
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

function hasNoStoreHeader(response) {
  if (!response || !response.headers) return false;
  const cc = (response.headers.get('cache-control') || '').toLowerCase();
  return cc.includes('no-store') || cc.includes('private') || cc.includes('no-cache');
}

self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones GET dentro del mismo origen
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);
  if (url.pathname === '/sw.js') return;

  // RN-SEC-04: Excluir inmediatamente cualquier endpoint transaccional o API
  if (isSensitiveRequest(url)) {
    return;
  }

  // 1. Para navegación HTML: Network-first con fallback a caché
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && !hasNoStoreHeader(networkResponse)) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((res) => res || caches.match('/index.html') || caches.match('/')))
    );
    return;
  }

  // 2. Para otros recursos estáticos (JS, CSS, imágenes, fuentes): Stale-while-revalidate con validación de seguridad
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && !hasNoStoreHeader(networkResponse)) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && !hasNoStoreHeader(networkResponse)) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      });
    })
  );
});

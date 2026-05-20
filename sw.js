// ─── TEBAM Digital — Service Worker ──────────────────────────
const VERSION   = 'tebam-v2';
const CACHE_KEY = `${VERSION}-static`;

const PRECACHE = [
  '/login.html',
  '/app.html',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_KEY)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_KEY).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorar: no-GET, extensiones Chrome, supabase, CDN externos
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;
  if (url.hostname.includes('supabase.co'))   return;
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('gstatic.com'))   return;
  if (url.hostname.includes('jsdelivr.net'))  return;

  // Solo manejar recursos del mismo origen
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;

        // Fetch con redirect: 'follow' para evitar el error
        return fetch(event.request, { redirect: 'follow' })
          .then(response => {
            // No cachear respuestas no exitosas o redirecciones opacas
            if (!response || response.status !== 200 || response.type === 'opaqueredirect') {
              return response;
            }
            const clone = response.clone();
            caches.open(CACHE_KEY).then(cache => cache.put(event.request, clone));
            return response;
          })
          .catch(() => caches.match('/app.html'));
      })
  );
});

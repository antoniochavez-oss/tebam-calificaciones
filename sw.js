// ─── TEBAM Digital — Service Worker ──────────────────────────
// Estrategia: Cache First para assets estáticos,
//             Network First para llamadas a Supabase.
// ─────────────────────────────────────────────────────────────

const VERSION   = 'tebam-v1';
const CACHE_KEY = `${VERSION}-static`;

// Archivos que se cachean al instalar
const PRECACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/app.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Fuentes Google (se cachean en runtime)
];

// ── INSTALL: precachear assets esenciales ────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_KEY)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())  // activar inmediatamente
  );
});

// ── ACTIVATE: limpiar caches viejos ──────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_KEY)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia por tipo de request ────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase → Network First (datos siempre frescos)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Google Fonts → Cache First
  if (url.hostname.includes('fonts.google') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Assets propios → Cache First con fallback a network
  if (event.request.method === 'GET') {
    event.respondWith(cacheFirst(event.request));
  }
});

// ── Estrategias ───────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_KEY);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Sin red y sin caché → página offline
    const offlinePage = await caches.match('/app.html');
    return offlinePage || new Response('Sin conexión', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'Sin conexión a internet' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

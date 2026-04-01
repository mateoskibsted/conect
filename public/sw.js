const CACHE = 'conect-v1'

// Recursos del app shell que se cachean al instalar
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg',
]

// ── Instalación: cachear el shell ────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  )
  // Activa el SW nuevo sin esperar a que cierren todas las pestañas
  self.skipWaiting()
})

// ── Activación: limpiar cachés viejos ────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch: estrategia por tipo de recurso ────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Solo peticiones GET
  if (request.method !== 'GET') return

  // Peticiones a Supabase (API, auth, storage): siempre red
  if (url.hostname.includes('supabase.co')) return

  // Navegación (rutas SPA): red primero, fallback al index.html cacheado
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // Recursos estáticos: caché primero, luego red y se actualiza el caché
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, clone))
        }
        return response
      })
    })
  )
})

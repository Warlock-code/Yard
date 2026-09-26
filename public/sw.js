const STATIC_CACHE = 'yard-static-v1'
const DYNAMIC_CACHE = 'yard-dynamic-v1'

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/apple-touch-icon-180.png',
  '/apple-touch-icon-167.png',
  '/apple-touch-icon-152.png',
  '/apple-touch-icon-120.png',
  '/splash-640x1136.png',
  '/splash-750x1334.png',
  '/splash-1125x2436.png',
  '/splash-1242x2688.png',
  '/splash-1536x2048.png',
  '/splash-1668x2224.png',
  '/splash-1668x2388.png',
  '/splash-2048x2732.png',
  '/og-image.svg',
  '/favicon.ico',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
      })
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') {
    return
  }

  if (url.origin !== location.origin) {
    if (url.pathname.match(/\.(png|jpg|jpeg|svg|webp|avif|woff|woff2)$/)) {
      event.respondWith(cacheFirst(request, DYNAMIC_CACHE))
    }
    return
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE))
    return
  }

  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|avif|woff|woff2|ico)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  if (url.pathname === '/' || url.pathname.match(/^\/(feed|explore|search|lair|notifications|compose|shop|battles|admin|profile|post|u|owned|welcome|verify-email|upgrade|reset-password|forgot-password|join|guidelines|terms|privacy|download|leaderboard|analytics|payment|child-safety)/)) {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE))
    return
  }

  event.respondWith(networkFirst(request, DYNAMIC_CACHE))
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) {
      return cached
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  }).catch(() => cached)

  return cached || fetchPromise
}

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting()
  }
})
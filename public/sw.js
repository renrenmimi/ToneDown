// v2: navigations are network-first so deploys (and the router shell) are
// never pinned by an old cache; static assets stay cache-first. Hashed
// build assets are immutable by name, so caching them on first fetch is safe.
const CACHE_NAME = 'tonedown-cache-v2'
const PRECACHE = ['/', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/')) return

  // SPA navigations: network-first, cached shell as the offline fallback.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const cloned = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put('/', cloned))
          }
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Static assets: cache-first with network fill.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }

        const cloned = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned))
        return response
      })
    }),
  )
})

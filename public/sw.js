const CACHE = 'multiply-offline-v2'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    OFFLINE_URL,
    '/multiply-logo.svg',
    '/icons/icon-192.png?v=2',
    '/icons/icon-512.png?v=2',
  ])))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('multiply-offline-') && key !== CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Family data and authenticated responses are never stored by this worker.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
  } else if ([OFFLINE_URL, '/multiply-logo.svg', '/icons/icon-192.png', '/icons/icon-512.png'].includes(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)))
  }
})

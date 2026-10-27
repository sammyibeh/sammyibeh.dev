// The Gatsby site registered an offline service worker at /sw.js. This replacement
// unregisters it and clears its caches so returning visitors get the live site.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key)
      await self.registration.unregister()
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url)
    })()
  )
})

/*
 * Temporary cleanup service worker.
 * It removes old caches and unregisters itself to avoid stale PWA assets.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      } catch {
        // Ignore cache cleanup errors.
      }

      try {
        await self.registration.unregister();
      } catch {
        // Ignore unregister errors.
      }

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(
        clients.map(client => {
          if ('navigate' in client) {
            return client.navigate(client.url);
          }
          return Promise.resolve();
        })
      );
    })()
  );
});

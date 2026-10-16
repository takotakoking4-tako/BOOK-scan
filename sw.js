// v0.5: no offline cache; avoids stale JS on GitHub Pages.
self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister()));

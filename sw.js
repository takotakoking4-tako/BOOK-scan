// v0.6: no offline cache; force updated camera lifecycle scripts.
self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister()));

// v0.4: No offline cache. Avoid stale scripts during testing.
self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister()));

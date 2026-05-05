// Minimal service worker — satisfies Chrome's PWA installability requirement.
// No caching strategy is applied; the network is always the source of truth.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

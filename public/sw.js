// Exists only to make the site installable on Android (Chrome's install criteria wants a
// registered service worker with a fetch handler). Deliberately does no caching at all — this is
// a live-pricing storefront (CLAUDE.md §7.5: price/stock must always come from the server), so an
// offline cache could serve a stale price or "in stock" state. Every request just falls through
// to the network as if this file didn't exist.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No event.respondWith(...) — the browser handles the request normally.
});

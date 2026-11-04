/* Minimal service worker: makes the dashboard installable. It never caches
   API data (always live), only keeps a fallback page for when you're offline. */
const OFFLINE = '/offline.html';
self.addEventListener('install', e => {
    e.waitUntil(caches.open('shell-v1').then(c => c.add(OFFLINE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
    if (e.request.mode !== 'navigate') return;   // scripts, styles, API: straight to the network
    e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});

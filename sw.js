/* Offline support and fast repeat visits. Only files from this site are cached;
   the database and CDN are always fetched live. */
const VERSION = 'v4';
const CACHE = 'vishu-' + VERSION;
const CORE = [
  'index.html', 'css/common.css', 'favicon.png', 'brand/avatar.png',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;          // database, CDN and fonts: always live

  // pages: network first, so the latest content is shown; cached copy if offline
  if(req.mode === 'navigate'){
    event.respondWith(fetch(req).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
    return;
  }
  // styles, scripts, images: show the cached copy at once, refresh it in the background
  if(/\.(css|js|svg|png|webmanifest)$/.test(url.pathname)){
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req);
      const network = fetch(req).then(res => { if(res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
      return cached || network;
    }));
  }
});

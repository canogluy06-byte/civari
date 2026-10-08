/* CİVARİ Service Worker — ağ öncelikli (online'da her zaman güncel, offline'da yedek) */
const CACHE = 'civari-v24';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'index.html']).catch(() => {})));
});

self.addEventListener('activate', e => {
  self.clients.claim();
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // POST (API) -> her zaman ağ
  /* Başka sitelere giden istekler (harita karoları, fontlar, analitik) SW'den geçmez.
     SW'nin fetch()'i sayfanın CSP connect-src kuralına tabidir; tile.openstreetmap.org
     orada olmadığı için istek düşüyor ve aşağıdaki yedek her karoya index.html
     döndürüyordu — harita gri kalıyordu. */
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (req.mode === 'navigate') {                // sadece sayfa gezintisini offline için sakla
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(m => m
      || (req.mode === 'navigate' ? caches.match('./') : Response.error())))   // ana sayfa yedeği yalnızca sayfa gezintisine
  );
});

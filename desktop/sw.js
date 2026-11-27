// Service worker САМО за /desktop/. Има свој кеш и ги брише само кешовите со префикс "tppe-desktop-",
// за никогаш да не го допре кешот на мобилната апликација ("tppe-strumica-v..").
const CACHE = 'tppe-desktop-v3';
const ASSETS = ['./', './index.html', './manifest.json', './css/dashboard.css',
  './js/firebase-init.js', './js/schedule.js', './js/sound.js', './js/data-store.js',
  './js/widgets.js', './js/admin.js', './js/tv-mode.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE)
    .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {}))))
    .then(() => self.skipWaiting())
));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('tppe-desktop-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

// Прво мрежа (секогаш свеж код), а офлајн — од кеш. Само истиот домен.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(c => c || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

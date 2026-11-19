// Борт-журнал ЧПУ — работа без интернета. Одно приложение: Журнал + Справочник ошибок + Голова TUPC.
// Страница: сначала сеть (чтобы приходили обновления), без сети — из кэша той же страницы.
// Остальные файлы (JS, JSON, картинки, 3D-библиотека): из кэша, обновляются в фоне. Яндекс Диск — только сеть.
// Фото и схемы Журнала лежат в отдельном кэше 'bort-files' (его ведёт сама страница).
const CACHE = 'bort-v3';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable.png', './apple-touch-icon.png',

  './spravochnik/', './spravochnik/index.html', './spravochnik/app.css', './spravochnik/app.js',
  './spravochnik/fanuc.json', './spravochnik/siemens.json', './spravochnik/gcodes.json',
  './spravochnik/icon-192.png', './spravochnik/icon-512.png', './spravochnik/icon-maskable.png', './spravochnik/apple-touch-icon.png',

  './spravochnik/manuals/fanuc_30i_ru.pdf', './spravochnik/manuals/fanuc_0iD_en.pdf',
  './spravochnik/manuals/siemens_840Dsl_alarms.pdf', './spravochnik/manuals/siemens_828D_alarms.pdf',
  './spravochnik/manuals/siemens_ONE_alarms.pdf', './spravochnik/manuals/siemens_840D_pl_alarms.pdf',
  './spravochnik/manuals/siemens_gcodes.pdf',

  './golova/', './golova/index.html', './golova/app.js', './golova/kinematics.js',
  './golova/gcode.js', './golova/head3d.js',
  './golova/vendor/three.module.js', './golova/vendor/OrbitControls.js',
  './golova/icon-192.png', './golova/icon-512.png', './golova/icon-maskable.png', './golova/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'bort-files').map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('yandex') || url.pathname.includes('/__files/') || url.pathname.includes('/data/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { caches.open(CACHE).then(c => c.put(req, r.clone())); return r; })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req);
    const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});

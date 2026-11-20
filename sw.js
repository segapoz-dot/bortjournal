// Борт-журнал ЧПУ — работа без интернета. Одно приложение: Журнал + Справочник ошибок + Голова TUPC.
// Страница: сначала сеть (чтобы приходили обновления), без сети — из кэша той же страницы.
// Остальные файлы (JS, JSON, картинки, 3D-библиотека): из кэша, обновляются в фоне. Яндекс Диск — только сеть.
// Фото и схемы Журнала лежат в отдельном кэше 'bort-files' (его ведёт сама страница).
const CACHE = 'bort-v7';
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

  // PDF viewers (especially on iOS) request byte ranges. A cached 200 response
  // cannot satisfy a Range request, so use the network's native 206 response.
  // Keep manuals that were opened online as an offline fallback.
  if (url.pathname.toLowerCase().endsWith('.pdf')) {
    e.respondWith(fetch(req).then(async response => {
      if (response.ok && !req.headers.has('Range') && response.status === 200) {
        const cache = await caches.open(CACHE);
        cache.put(url.href.split('#')[0], response.clone()).catch(() => {});
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(url.href, {ignoreSearch: true});
      if (!cached) return Response.error();
      const range = req.headers.get('Range');
      if (!range) return cached;
      const blob = await cached.blob();
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, {status: 416, headers: {'Content-Range': 'bytes */' + blob.size}});
      const start = match[1] ? Number(match[1]) : Math.max(0, blob.size - Number(match[2]));
      const end = match[1] && match[2] ? Number(match[2]) : blob.size - 1;
      if (start >= blob.size || end < start) return new Response(null, {status: 416, headers: {'Content-Range': 'bytes */' + blob.size}});
      const last = Math.min(end, blob.size - 1);
      return new Response(blob.slice(start, last + 1, 'application/pdf'), {
        status: 206,
        headers: {
          'Content-Type': 'application/pdf',
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${last}/${blob.size}`,
          'Content-Length': String(last - start + 1)
        }
      });
    }));
    return;
  }

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

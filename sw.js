// オフライン対応: アプリ本体(静的ファイル)をキャッシュし、表示は常にキャッシュ優先で高速に、裏で最新版に更新する。
// 画像は端末に保存しない方針なので、キャッシュするのはアプリのファイルだけ。
const CACHE = 'result-app-v3';   // ファイルを更新したらこの番号を上げる
const FILES = ['./', './index.html', './detect.js', './template.js', './collage.js', './drive.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;   // 外部(Google等)は素通し
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});

const APP_VERSION = '2026.11.13-step-v5';
const CACHE_NAME = `jt2go-pwa-cache-${APP_VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg'
];

// 預快取 OCCT STEP WebAssembly 引擎，確保離線時也能解析 .step / .stp
const OCCT_ASSETS = [
  'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/occt-import-js.js',
  'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/occt-import-js.wasm'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);
      // 外部 CDN 採容錯快取，避免因網路波動阻擋 SW 安裝
      await Promise.allSettled(
        OCCT_ASSETS.map((url) =>
          fetch(url).then((res) => {
            if (res && res.status === 200) return cache.put(url, res);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // 對於大型 WASM / JS 引擎檔案採用 Cache-First 加速離線與二次載入
  if (event.request.url.includes('occt-import-js')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 其餘核心頁面採 Network-First 確保隨時同步 GitHub 最新版
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

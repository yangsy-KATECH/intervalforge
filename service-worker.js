'use strict';
// 배포 파일을 변경할 때마다 VERSION을 올린다.
const VERSION = '1.0.0';
const SCOPE = new URL(self.registration.scope);
const PREFIX = `intervalforge:${encodeURIComponent(SCOPE.pathname)}:`;
const CACHE_NAME = PREFIX + VERSION;
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './timer-core.js',
  './cue-controller.js', './audio.js', './storage.js', './pwa.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './tests/index.html', './tests/test-suite.js', './tests/browser-tests.js'
];
const ALLOWED_PATHS = new Set(
  ASSETS.map(path => new URL(path, SCOPE).pathname)
);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(ASSETS.map(path => new URL(path, SCOPE).href))
    )
  );
  // 운동 중 구버전과 신버전이 섞이지 않도록 여기서 skipWaiting하지 않는다.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter(name => name.startsWith(PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !ALLOWED_PATHS.has(url.pathname)) return;
  const canonical = new URL(url.pathname, SCOPE.origin).href;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(canonical);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') {
        await cache.put(canonical, response.clone());
      }
      return response;
    } catch (_) {
      return new Response(
        '오프라인 파일이 없습니다. 인터넷에 연결한 뒤 다시 열어 주세요.',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    }
  })());
});

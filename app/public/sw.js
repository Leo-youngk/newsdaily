/* 手写 Service Worker：app shell 预缓存 + /data/* stale-while-revalidate + 图片 cache-first */
const VERSION = 'news-pwa-v1';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const DATA = `${VERSION}-data`;

const SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  } catch {
    return new Response('offline', { status: 503, statusText: 'offline' });
  }
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fb = await cache.match(fallbackUrl);
      if (fb) return fb;
    }
    return new Response('offline', { status: 503, statusText: 'offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // AI POST 等不缓存
  const url = new URL(req.url);

  // 数据与图片（可能跨源到 Worker）
  if (url.pathname.startsWith('/data/')) {
    if (url.pathname.startsWith('/data/img/')) {
      event.respondWith(cacheFirst(req, RUNTIME));
    } else {
      event.respondWith(staleWhileRevalidate(req, DATA));
    }
    return;
  }

  // 导航请求：network-first，回退 app shell
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, SHELL, '/index.html'));
    return;
  }

  // 同源静态资源：cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, RUNTIME));
    return;
  }
  // 其余跨源资源（字体等）：stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req, RUNTIME));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

/* 手写 Service Worker：app shell 预缓存 + /data/* stale-while-revalidate + 图片 cache-first + LRU 上限 */
// 版本号在构建时由 vite 插件替换。原来写死成 v1，部署新版本后旧的 hash 资源永远留在缓存里。
const VERSION = '__SW_VERSION__';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const DATA = `data-${VERSION}`;
const IMG = `img-${VERSION}`;

const SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];
// iOS PWA 存储配额很紧，缓存必须有上限，否则整个站点数据会被系统一次性清掉。
// 正文同样要限：单篇 Lex Fridman 逐字稿就有 332KB，一天 176 条合计 7.1MB，
// 只给图片设上限、正文不限，撑爆配额只是时间问题。
const IMG_MAX_ENTRIES = 300;
const DATA_MAX_ENTRIES = 150;

self.addEventListener('install', (event) => {
  // 不再无条件 skipWaiting：新 SW 抢在旧页面还开着时接管，会导致 chunk 版本错配。
  // 改由页面在用户确认后发 'skip-waiting' 消息。
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // Cache API 按插入顺序返回，删最旧的一批
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
}

/** 写缓存失败（iOS 配额满是常事）不能连累这次请求本身 */
async function putSafe(cache, request, res, cacheName, maxEntries) {
  try {
    await cache.put(request, res.clone());
    if (maxEntries) await trimCache(cacheName, maxEntries);
  } catch (e) {
    // 存不下就不存，内容照样返回。静默失败会让人误以为是抓取问题
    console.warn('[sw] 缓存写入失败，本次直接用网络响应', e);
  }
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (res) => {
      if (res && res.ok) await putSafe(cache, request, res, cacheName, maxEntries);
      return res;
    })
    // 没有缓存又拿不到网络时，这里以前返回 undefined，
    // respondWith(undefined) 会让页面侧的 fetch 直接 reject，
    // 阅读页于是把它当成"这个源抓不到正文"，谎报成付费墙 —— 其实内容一直在。
    .catch(() => cached ?? new Response('offline', { status: 503, statusText: 'offline' }));
  return cached || network;
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === 'opaque')) {
      await cache.put(request, res.clone());
      if (maxEntries) trimCache(cacheName, maxEntries);
    }
    return res;
  } catch {
    return new Response('offline', { status: 503, statusText: 'offline' });
  }
}

async function networkFirst(event, request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    const res = preload || (await fetch(request));
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
  if (req.method !== 'GET') return; // AI 的 POST 不缓存
  const url = new URL(req.url);

  // 数据与图片（跨源到 Worker，pathname 同样以 /data/ 开头）
  if (url.pathname.startsWith('/data/')) {
    if (url.pathname.startsWith('/data/img/')) {
      event.respondWith(cacheFirst(req, IMG, IMG_MAX_ENTRIES));
    } else {
      event.respondWith(staleWhileRevalidate(req, DATA, DATA_MAX_ENTRIES));
    }
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(event, req, SHELL, '/index.html'));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, RUNTIME));
    return;
  }
  event.respondWith(staleWhileRevalidate(req, RUNTIME));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

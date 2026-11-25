'use strict';
// Change VERSION when publishing a new offline bundle.
const VERSION = 'myschedule-offline-v77';
const BASE = self.registration.scope;
const CACHE = VERSION + ':' + BASE;
const INDEX = new URL('index.html', BASE).href;
const REQUIRED = ['ui.js?v=73','lesson-card.js?v=68','lens.js?v=68','polish.css?v=74','glass-motion.css?v=68','curriculum.js?v=52','study.js?v=76','study.css?v=70','install.js?v=52','install.css?v=68','cabinet.js?v=77','cabinet.css?v=75','details.css?v=77','grade-visual.js?v=75'].map(path => new URL(path, BASE).href);
const ASSETS = [...REQUIRED, ...['icon-light.png?v=23', 'manifest-light.webmanifest?v=30', 'manifest.webmanifest?v=30', 'icon-192.png?v=7', 'icon-512.png?v=7', 'apple-touch-icon.png?v=7'].map(path => new URL(path, BASE).href)];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Installation only succeeds when the complete timetable is stored.
    const response = await fetch(new Request(INDEX, {cache: 'reload'}));
    if (!response.ok) throw new Error('Timetable download failed');
    await cache.put(INDEX, response);
    // Questions and their UI form one mandatory offline bundle with the page.
    await Promise.all(REQUIRED.map(async url => {
      const asset = await fetch(new Request(url, {cache: 'reload'}));
      if (!asset.ok) throw new Error('Study material download failed');
      await cache.put(url, asset);
    }));
    await Promise.all(ASSETS.filter(url => !REQUIRED.includes(url)).map(async url => {
      try { const asset = await fetch(new Request(url, {cache: 'reload'})); if (asset.ok) await cache.put(url, asset); } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('myschedule-offline-') && name.endsWith(':' + BASE) && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'CHECK_OFFLINE') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const ready = await Promise.all([INDEX, ...REQUIRED].map(url => cache.match(url)));
    if (ready.every(Boolean)) event.source?.postMessage({type: 'OFFLINE_READY'});
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Personal data and authentication always go directly to the API.
  if (url.origin !== new URL(BASE).origin || url.pathname.includes('/api/')) return;
  const isPage = request.mode === 'navigate' && (url.origin + url.pathname === BASE || url.origin + url.pathname === INDEX);
  if (isPage) {
    const manualRefresh = url.searchParams.has('refresh-schedule');
    const cachePromise = caches.open(CACHE);
    // Prefer the latest page on a fast connection. A saved schedule can open
    // after 300 ms on a slow connection while its next copy updates in background.
    const network = cachePromise.then(async cache => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      try {
        const response = await fetch(request, {
          signal: controller.signal,
          cache: manualRefresh ? 'reload' : 'default'
        });
        if (!response.ok) throw new Error('Page unavailable');
        try { await cache.put(INDEX, response.clone()); } catch (_) {}
        return response;
      } finally { clearTimeout(timer); }
    });
    event.waitUntil(network.then(() => {}, () => {}));
    event.respondWith((async () => {
      const cached = await (await cachePromise).match(INDEX);
      if (cached && !manualRefresh) {
        let timer;
        try {
          const fresh = await Promise.race([
            network.catch(() => null),
            new Promise(resolve => { timer = setTimeout(() => resolve(null), 300); })
          ]);
          return fresh || cached;
        } finally { clearTimeout(timer); }
      }
      try { return await network; }
      catch (_) {
        if (cached) return cached;
        return new Response('Откройте расписание с интернетом, чтобы сохранить его на устройстве.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
      }
    })());
  } else if (ASSETS.includes(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) { try { await cache.put(request, response.clone()); } catch (_) {} }
      return response;
    })());
  }
});

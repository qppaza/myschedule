'use strict';
// Change VERSION when publishing a new offline bundle.
const VERSION = 'myschedule-offline-v1';
const BASE = self.registration.scope;
const CACHE = VERSION + ':' + BASE;
const INDEX = new URL('index.html', BASE).href;
const ASSETS = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'].map(path => new URL(path, BASE).href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Installation only succeeds when the complete timetable is stored.
    const response = await fetch(new Request(INDEX, {cache: 'reload'}));
    if (!response.ok) throw new Error('Timetable download failed');
    await cache.put(INDEX, response);
    await Promise.all(ASSETS.map(async url => {
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
    if (await cache.match(INDEX)) event.source?.postMessage({type: 'OFFLINE_READY'});
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isPage = request.mode === 'navigate' && (url.origin + url.pathname === BASE || url.origin + url.pathname === INDEX);
  if (isPage) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      try {
        const response = await fetch(request, {signal: controller.signal});
        if (!response.ok) throw new Error('Page unavailable');
        try { await cache.put(INDEX, response.clone()); } catch (_) {}
        return response;
      } catch (_) {
        return await cache.match(INDEX) || new Response('Откройте расписание с интернетом, чтобы сохранить его на устройстве.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
      } finally { clearTimeout(timer); }
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

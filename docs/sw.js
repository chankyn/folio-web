'use strict';

// Solo almacenamos el código de Folio. Los documentos nunca salen de IndexedDB.
const CACHE_NAME = 'folio-web-assets-v1.0.0';
const PREVIOUS_CACHE_PREFIXES = ['folio-web-static-', 'folio-web-assets-'];
const APP_FILES = [
  './', './index.html', './style.css', './i18n.js',
  './app.js', './document-catalog.js', './exam-planner.js',
  './import.js', './latex.js', './math.js', './lists.js', './pages.js',
  './browser-store.js', './browser-import.js', './web-init.js',
  './folio-icon.png', './manifest.webmanifest',
  './vendor/jszip.min.js',
  './wasm/wasm_exec.js', './wasm/import-worker.js', './wasm/folio-import.wasm'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => name !== CACHE_NAME
        && PREVIOUS_CACHE_PREFIXES.some(prefix => name.startsWith(prefix)))
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Un HTML actualizado debe llegar antes que una copia antigua de la interfaz.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch {
        return await caches.match('./index.html')
          || Response.error();
      }
    })());
    return;
  }

  // Los recursos versionados pueden reutilizarse sin consultar a la red.
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});

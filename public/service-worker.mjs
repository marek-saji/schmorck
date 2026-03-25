const CACHE_NAME = 'yorck-v1';
const PREFILL_URLS = [
  '/',
  '/styles.css',
  '/main.mjs',
  '/trakt.mjs',
  '/manifest.webmanifest',
  '/poster-fallback.svg',
  '/yorck.svg',
  '/trakt.svg',
  '/letterboxd.svg',
  '/images/icons/favicon.svg',
  '/images/icons/icon.svg',
  '/images/icons/maskable.svg',
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Offline</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: system-ui, sans-serif;
    }
  </style>
</head>
<body>
  <main>
    <h1>You are offline</h1>
    <p>Sorry, but it looks like you are offline. Please check your internet connection and try again.</p>
  </main>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PREFILL_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.headers.get('accept') === 'text/event-stream') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;

      if (request.mode === 'navigate') {
        const home = await cache.match('/');
        if (home) return home;

        return new Response(OFFLINE_HTML, {
          status: 503,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        });
      }

      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});

// Höj versionen när ikoner, manifest eller QRious-versionen ändras.
// index.html hämtas alltid från nätet först och behöver ingen versionshöjning.
const CACHE_NAME = 'bjorklunds-rapport-v3';
const QRIOUS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192x192.png',
    './icon-512x512.png',
    QRIOUS_URL
];
// Introvideon cachas inte: den är stor och spelas med Range-förfrågningar.
// Utan nät hoppar appen över introt (play() misslyckas och overlayen stängs).

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || request.headers.has('range')) return;

    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;
    if (!isSameOrigin && request.url !== QRIOUS_URL) return;
    if (isSameOrigin && url.pathname.endsWith('.mp4')) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
    } else {
        event.respondWith(cacheFirst(request));
    }
});

// Sidan: hämta ny version när det finns nät, annars senast cachade.
async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put('./index.html', response.clone());
        return response;
    } catch (error) {
        return (await cache.match('./index.html')) || Response.error();
    }
}

// Statiska resurser: cache först, nätet som reserv.
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
    }
    return response;
}

'use strict';

// Höj versionen när ikoner eller QRious-versionen ändras. Appens egna filer
// (HTML, CSS, JS, manifest) hämtas alltid från nätet först och behöver ingen versionshöjning.
const CACHE_NAME = 'bjorklunds-rapport-v4';
const QRIOUS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
const PRECACHE_URLS = [
    './',
    './index.html',
    './styles.css',
    './storage.js',
    './app.js',
    './manifest.json',
    './icon-192x192.png',
    './icon-512x512.png',
    QRIOUS_URL,
];
// Introvideon cachas inte: den spelas med Range-förfrågningar.
// Utan nät hoppar appen över introt.

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((names) =>
                Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
            )
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || request.headers.has('range')) return;

    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;
    if (!isSameOrigin && request.url !== QRIOUS_URL) return;
    if (isSameOrigin && url.pathname.endsWith('.mp4')) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request, './index.html'));
    } else if (isSameOrigin && !url.pathname.endsWith('.png')) {
        event.respondWith(networkFirst(request, request));
    } else {
        event.respondWith(cacheFirst(request));
    }
});

// Appens filer: ny version när det finns nät, annars senast cachade.
async function networkFirst(request, cacheKey) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(cacheKey, response.clone());
        return response;
    } catch {
        return (await cache.match(cacheKey, { ignoreSearch: true })) || Response.error();
    }
}

// Ikoner och QRious: cache först, nätet som reserv.
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

// Byt namn på CACHE_NAME
const CACHE_NAME = 'bjorklunds-rapport-cache-v2'; 
const urlsToCache = [
    './', 
    './index.html', 
    './icon-192x192.png', // Behåll om du återanvänder ikoner
    './icon-512x512.png'  // Behåll om du återanvänder ikoner
    './videos/intro.mp4'  // Intro Video
    // Lägg till andra statiska resurser om du har nya (t.ex. nya ikoner)
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('ServiceWorker: Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('ServiceWorker: Failed to cache during install:', error);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response; 
                }
                let fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(
                    networkResponse => {
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse; 
                        }
                        let responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    }
                ).catch(error => {
                    console.log('ServiceWorker: Fetch failed for:', event.request.url, error);
                    // Du kan här returnera en fallback-sida om nätverket är nere för okända resurser
                    // return caches.match('./offline.html'); 
                });
            })
    );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME]; 
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('ServiceWorker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
const CACHE_NAME = 'PlaneSailing';
const CACHE_URLS = [
  'index.html',
  './'
  'style.css',
  'code.js',
  'apple-touch-icon.png',
  'favicon.png',
  'favicon.svg',
  'favicon-192.png',
  'favicon-512.png',
  'icons/clear.png',
  'icons/config.png',
  'icons/flightaware.png',
  'icons/friend.png',
  'icons/hostile.png',
  'icons/info.png',
  'icons/loading.png',
  'icons/marinetraffic.png',
  'icons/neutral.png',
  'icons/offline.png',
  'icons/qrz.png',
  'icons/select.png',
  'icons/tracktable.png',
  'icons/unknown.png',
  'eastereggs/eastereggs.js',
  'eastereggs/warning.mp3'
];

self.addEventListener('fetch', (event) => {
  // Is this an asset we can cache?
  const url = new URL(event.request.url);
  const isCacheableRequest = CACHE_URLS.includes(url.pathname);

  if (isCacheableRequest) {
    // Open the cache
    event.respondWith(caches.open(CACHE_NAME).then((cache) => {
      // Go to the network first, cacheing the response
      return fetch(event.request.url).then((fetchedResponse) => {
        cache.put(event.request, fetchedResponse.clone());

        return fetchedResponse;
      }).catch(() => {
        // If the network is unavailable, get from cache.
        return cache.match(event.request.url);
      });
    }));
  } else {
    // Not a cacheable request, must be a call to the API, so no cache involved just go to the network
    return;
  }
});
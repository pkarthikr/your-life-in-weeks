// Life in Weeks — the service worker.
//
// It keeps a copy of the site's own files in this browser (Cache Storage),
// so the site opens without a connection, as an installed app should. It
// never holds your weeks: those are in localStorage (js/storage.js), which a
// service worker can't read, and it sends nothing anywhere.
//
// Network first: online, every file comes fresh from the site, so a new
// version shows straight away, and the copy is updated as it goes. Offline,
// or if the network takes longer than WAIT, the copy is used instead.

// Only caches whose names start with this are this site's: other sites
// served from the same domain may keep their own.
const PREFIX = 'liw-';
const CACHE = `${PREFIX}v1`;

// How long to wait for the network before using the copy, in ms.
const WAIT = 3000;

// Copied when the service worker is installed, so the site opens offline
// even before it has been used with one in place. Everything the page loads
// to start is here (a test checks). Other files, like the fonts for other
// alphabets and the author's photo, are copied the first time they're used.
const FILES = [
  './',
  'styles.css',
  'favicon.svg',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'fonts/geist-latin.woff2',
  'fonts/geist-mono-latin.woff2',
  'js/app.js',
  'js/backup.js',
  'js/colors.js',
  'js/fit.js',
  'js/install.js',
  'js/life-expectancy.js',
  'js/lifespan.js',
  'js/picture.js',
  'js/settings.js',
  'js/storage.js',
  'js/weeks.js',
];

const SCOPE = self.registration.scope;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Where a file's copy is kept. The page has one copy, whatever its address
 * (with or without index.html, a query from a shared link, or the #screen).
 */
function keyFor(request) {
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  if (url.href === SCOPE || url.href === `${SCOPE}index.html`) return SCOPE;
  return request;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only this site's own files; anything else goes to the network as usual.
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;

  const key = keyFor(request);
  const network = fetch(request);
  // Update the copy whenever the network answers, even if it was too slow
  // this time and the copy was used.
  event.waitUntil(
    network
      .then((response) => {
        if (!response.ok) return;
        const copy = response.clone();
        return caches.open(CACHE).then((cache) => cache.put(key, copy));
      })
      .catch(() => {}),
  );
  event.respondWith(answer(network, key));
});

/** The network's answer, unless it fails or is slow and there is a copy. */
async function answer(network, key) {
  const saved = await caches.open(CACHE).then((cache) => cache.match(key));
  if (!saved) return network; // no copy yet: as if there were no service worker
  try {
    const response = await Promise.race([network, new Promise((resolve) => setTimeout(resolve, WAIT))]);
    if (response?.ok) return response;
  } catch {
    // Offline, or the site can't be reached.
  }
  return saved;
}

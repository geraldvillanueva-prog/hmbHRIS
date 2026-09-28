// HMB HRIS service worker — shared by employee.html and supervisor.html.
//
// Caching strategy, deliberately conservative:
//  - App shell (the HTML page itself, icons, manifest): cached, so the app
//    still opens and shows a UI when offline or on a bad connection.
//  - Everything under /api/: NEVER cached, always goes to the network.
//    Time logs, leave balances, payslips etc. must always be current —
//    serving stale cached data here would be actively misleading, not
//    just inconvenient.
//
// Bump this version string whenever the cached files below change, so
// returning users get the new versions instead of a stale cache.
const CACHE_NAME = 'hmb-hris-shell-v1';
const SHELL_FILES = [
  '/employee.html',
  '/supervisor.html',
  '/manifest-employee.json',
  '/manifest-supervisor.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network only, never cached, never served from cache.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Everything else (the app shell): try the network first so users
  // always get the latest deployed version when online; fall back to
  // the cached copy only when the network request actually fails
  // (offline, or the server is unreachable).
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful, same-origin GET responses.
        if (event.request.method === 'GET' && response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

const CACHE_NAME = 'stock-opname-shell-v186';
const SHELL_FILES = [
  './',
  './index.html',
  './index2.html',
  './presentasi.html',
  './over-wo.html',
  './ringkasan-memo.html',
  './ringkasan-palet.html',
  './ringkasan-overwo.html',
  './ringkasan-sob.html',
  './ringkasan-slg.html',
  './ringkasan-mlg.html',
  './ringkasan-sob2.html',
  './ringkasan-5r5s.html',
  './manifest.json',
  './analisa-memo.html',
  './analisa2.html',
  './temuan-5r5s.html',
  './data-stock.html',
  './icons/icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cache tiap file SATU-SATU supaya 1 file yang gagal tidak menggagalkan install SW.
      // cache:'reload' = paksa ambil dari server (lewati cache HTTP browser/GitHub Pages),
      // supaya cache baru tidak berisi file versi lama.
      Promise.all(
        SHELL_FILES.map((file) =>
          cache.add(new Request(file, { cache: 'reload' })).catch((err) => console.warn('SW: gagal cache', file, err))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Halaman (HTML / manifest): NETWORK-FIRST -> selalu ambil versi terbaru kalau online,
// cache hanya cadangan saat offline atau koneksi lambat (> 5 detik).
function networkFirst(request, url) {
  const key = new Request(url.origin + url.pathname); // kunci cache tanpa ?query
  const net = fetch(url.href, { cache: 'reload' }).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(key, copy));
    }
    return res;
  });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
  return Promise.race([net, timeout]).catch(() =>
    caches
      .match(key)
      .then((c) => c || caches.match(request, { ignoreSearch: true }))
      .then((c) => c || net)
  );
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Jangan cache request ke Apps Script (data harus selalu live)
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return;
  }

  // Hanya tangani request GET untuk file di origin sendiri (app shell)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Pengecekan versi dari aplikasi (?chk=...) langsung ke jaringan, jangan disentuh cache
  if (url.searchParams.has('chk')) {
    return;
  }

  const isPage =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.json');

  if (isPage) {
    event.respondWith(networkFirst(event.request, url));
    return;
  }

  // File lain (ikon, gambar, dll): cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((res) => {
            if (res && res.ok) {
              const resClone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
            }
            return res;
          })
          .catch(() => cached)
      );
    })
  );
});

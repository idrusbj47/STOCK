const CACHE_NAME = 'stock-opname-shell-v27';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cache tiap file SATU-SATU (bukan cache.addAll) supaya kalau ada 1 file
      // yang gagal/hilang (mis. 404), instalasi Service Worker tetap SUKSES.
      // Sebelumnya pakai cache.addAll(): kalau 1 saja file di SHELL_FILES gagal
      // diambil, seluruh install gagal -> SW tidak pernah aktif -> Chrome tidak
      // pernah menganggap app ini installable -> tombol "Unduh Aplikasi (PWA)"
      // tidak akan pernah muncul.
      Promise.all(
        SHELL_FILES.map((file) =>
          cache.add(file).catch((err) => console.warn('SW: gagal cache', file, err))
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

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((res) => {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
            return res;
          })
          .catch(() => cached)
      );
    })
  );
});

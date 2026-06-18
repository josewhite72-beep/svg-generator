// Service worker minimo: solo cachea el shell de la app para que sea instalable.
// Las llamadas a Groq y a los CDN de librerias siempre van a la red (necesitan internet).
const CACHE_NAME = "svgen-shell-v1";
const SHELL_FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Solo intervenimos en peticiones same-origin (el shell). Todo lo demas (CDN, Groq) pasa directo.
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});

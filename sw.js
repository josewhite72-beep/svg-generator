// Service worker minimo: solo cachea el shell de la app para que sea instalable.
// Estrategia "network-first": siempre intenta traer la version mas nueva de la red;
// solo usa la copia guardada si no hay internet. Asi una actualizacion nunca se queda
// atascada sirviendo HTML/JS viejo (que fue justo el bug que rompio la subida de archivos).
const CACHE_NAME = "svgen-shell-v2";
const SHELL_FILES = ["./", "./index.html", "./app.js", "./manifest.json", "./icon-192.png", "./icon-512.png"];

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
  // Solo intervenimos en peticiones same-origin (el shell). Todo lo demas (CDN, Groq, Puter) pasa directo.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((fresh) => {
        // Si la red funciono, guarda copia fresca y usa esa (nunca sirve algo viejo si hay internet)
        caches.open(CACHE_NAME).then((cache) => cache.put(req, fresh.clone())).catch(() => {});
        return fresh;
      })
      .catch(() => caches.match(req)) // sin internet: usa la ultima copia guardada
  );
});

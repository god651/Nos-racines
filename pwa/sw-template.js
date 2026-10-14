// Service worker de NOS RACINES (version iPhone). Fichier généré à la fabrication.
// Toute l'application est gardée dans le téléphone : elle s'ouvre même sans Internet.
// Les données de la famille ne passent jamais par ici (elles restent dans IndexedDB).
const VERSION = "__VERSION__";
const FILES = __FILES__;
const CACHE = "nos-racines-" + VERSION;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(FILES.map((f) => c.add(new Request(f, { cache: "reload" })).catch(() => undefined))),
    ),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("nos-racines-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// La nouvelle version s'installe quand la personne touche « Mettre à jour ».
self.addEventListener("message", (e) => {
  if (e.data === "nr-activer") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, traductions : toujours en direct
  if (req.mode === "navigate" && (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html"))) {
    // La page de l'application : celle gardée dans le téléphone (la version installée).
    e.respondWith(
      caches.match("./index.html", { ignoreSearch: true }).then((hit) => hit || fetch(req)),
    );
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.includes("/assets/")) {
            const copy = res.clone();
            void caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

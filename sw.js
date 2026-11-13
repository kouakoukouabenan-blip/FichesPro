/* Change VERSION à chaque mise à jour (base ou code) pour que les appareils récupèrent la nouvelle version */
const VERSION = "fiches-v32";
const FICHIERS = ["./", "index.html", "css/style.css", "js/api.js", "js/regles.js", "js/profil.js", "js/app.js", "js/eleves.js", "js/lecture.js", "js/voile.js", "js/export.js", "js/plan.js", "js/stockage.js", "js/devoir.js", "js/annee.js", "js/semaine.js", "js/scanner.js", "js/mesdocs.js", "js/drive.js", "manifest.json",
  "base/_registre.js", "base/francais-config.js", "base/francais-progressions.js", "base/francais-guides.js",
  "base/francais-fiches-3e.js", "base/francais-fiches-6e.js", "base/francais-fiches-5e.js", "base/francais-fiches-4e.js", "base/francais-programmes.js", "base/francais-exercices.js", "base/francais-modeles.js",
  "base/edhc-config.js", "base/edhc-progressions.js", "base/edhc-fiches.js", "base/edhc-guides.js", "base/edhc-supports.js", "base/edhc-manuels.js", "base/mes-documents.js", "base/calendrier.js",
  "icons/favicon.svg", "icons/favicon.png", "icons/apple-touch-icon.png",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-192.png", "icons/icon-maskable-512.png",
  "vendor/docx.min.js", "vendor/docx-math.min.js", "vendor/docx-html.min.js",
  "vendor/pdfmake.min.js", "vendor/pdfmake-vfs-fonts.js", "vendor/html-to-pdfmake.min.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSION).map(x => caches.delete(x)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Polices Google : cache au premier passage
  if (url.hostname.endsWith("gstatic.com") || url.hostname === "fonts.googleapis.com") {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const c = res.clone(); caches.open(VERSION).then(x => x.put(req, c)); return res; })));
    return;
  }
  if (url.origin !== location.origin) return;           // appels API : jamais en cache
  // Réseau d'abord (mises à jour), cache si hors ligne ; navigation hors ligne → index.html
  e.respondWith(fetch(req, { cache: "no-cache" }).then(res => {
    const c = res.clone(); caches.open(VERSION).then(x => x.put(req, c)); return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : undefined))));
});

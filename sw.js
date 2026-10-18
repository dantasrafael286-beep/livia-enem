// Service worker: funciona offline e recebe os lembretes.
const VERSAO = "missao-enem-v4";
const ARQUIVOS = [
  "./", "index.html", "styles.css", "config.js", "data.js", "comum.js", "app.js",
  "questoes/mt.js", "questoes/cn.js", "questoes/ch.js", "questoes/lc.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // fontes: cache primeiro
  if (url.hostname.includes("fonts.g")) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => {
      const cp = res.clone();
      caches.open(VERSAO).then((c) => c.put(req, cp));
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  // arquivos do app: rede primeiro (pega atualizações), cache se estiver offline
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const cp = res.clone(); caches.open(VERSAO).then((c) => c.put(req, cp)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Missão ENEM", {
    body: d.body || "",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: d.tag || "missao-enem",
    data: { url: d.url || "./#hoje" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const alvo = new URL(e.notification.data && e.notification.data.url || "./#hoje", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) {
      if (c.url.startsWith(self.registration.scope)) { c.navigate(alvo); return c.focus(); }
    }
    return self.clients.openWindow(alvo);
  }));
});

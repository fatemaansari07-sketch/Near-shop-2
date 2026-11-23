const CACHE = "shopnear-v1";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(["/", "/manifest.webmanifest"])));
  self.skipWaiting();
});
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(r => r || caches.match("/"))));
});

// ---- Campaign push (FCM data messages) ----
self.addEventListener("push", event => {
  let d = {};
  try { const j = event.data ? event.data.json() : {}; d = j.data || j; } catch {}
  if (!d.title) return;
  event.waitUntil(self.registration.showNotification(d.title, {
    body: d.body || "", icon: "/shopnear-icon.svg", badge: "/shopnear-icon.svg",
    image: d.image || undefined, data: { url: d.url || "/", campaign_id: d.campaign_id || "" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const same = list.find(c => "focus" in c);
    if (same && url === "/") return same.focus();
    return self.clients.openWindow(url);
  }));
});

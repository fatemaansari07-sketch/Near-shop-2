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

// FCM data messages are rendered here so the same handler works for campaign and order pushes.
self.addEventListener("push", event => {
  let d = {};
  try {
    const payload = event.data ? event.data.json() : {};
    d = payload.data || payload;
  } catch {}
  if (!d.title) return;
  event.waitUntil(self.registration.showNotification(d.title, {
    body: d.body || "",
    icon: "/shopnear-icon.svg",
    badge: "/shopnear-icon.svg",
    image: d.image || undefined,
    data: { url: d.url || "/", campaign_id: d.campaign_id || "", order_id: d.order_id || "" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/";
  let target;
  try { target = new URL(raw, self.location.origin); } catch { target = new URL("/", self.location.origin); }
  if (!["https:", "http:"].includes(target.protocol)) target = new URL("/", self.location.origin);
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async list => {
    const sameOrigin = target.origin === self.location.origin;
    const client = sameOrigin ? list.find(c => "focus" in c) : null;
    if (client) {
      if (target.pathname !== "/" || target.search) await client.navigate(target.href);
      return client.focus();
    }
    return self.clients.openWindow(target.href);
  }));
});

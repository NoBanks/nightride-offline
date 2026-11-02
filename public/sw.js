// Keeps the whole app available with no signal. Same-origin GETs only; Gemini calls pass through.
const CACHE = "nightride-offline-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()),
));

self.addEventListener("message", (e) => {
  if (e.data?.type === "cache") e.waitUntil(caches.open(CACHE).then((c) => c.addAll(e.data.urls)));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(async () => {
        // ignoreVary: module scripts send an Origin header the precached copies were stored without.
        const hit = await caches.match(e.request, { ignoreVary: true });
        if (hit) return hit;
        if (e.request.mode === "navigate") return caches.match("/", { ignoreVary: true });
        return Response.error();
      }),
  );
});

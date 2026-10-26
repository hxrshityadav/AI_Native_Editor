const PREFIX = "rf-editor-";
const NAME = PREFIX + "__BUILD_ID__";
self.addEventListener("install", event => event.waitUntil((async () => {
  const response = await fetch("/editor/precache.json", { cache: "no-store" });
  const assets = await response.json();
  if (!Array.isArray(assets) || assets.some(path => !path.startsWith("/editor/") && !path.startsWith("/fonts/"))) throw new Error("Invalid editor cache manifest");
  await (await caches.open(NAME)).addAll(assets);
  await self.skipWaiting();
})()));
self.addEventListener("activate", event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== NAME) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !(url.pathname.startsWith("/editor/") || url.pathname.startsWith("/fonts/"))) return;
  event.respondWith((async () => {
    const cache = await caches.open(NAME);
    if (event.request.mode === "navigate") {
      try { return await fetch(event.request); } catch { return (await cache.match("/editor/index.html")) || new Response("Editor assets are not installed. Connect once and reopen the editor.", { status: 503 }); }
    }
    const cached = await cache.match(event.request); if (cached) return cached;
    const response = await fetch(event.request); if (response.ok) await cache.put(event.request, response.clone()); return response;
  })());
});
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
  if (event.data?.type === "GET_CACHE_STATUS") event.waitUntil((async () => { const entries = await (await caches.open(NAME)).keys(); event.ports[0]?.postMessage({ payload: { cacheNames: [NAME], totalEntries: entries.length, version: NAME } }); })());
  if (event.data?.type === "CLEAR_CACHE") event.waitUntil((async () => { for (const key of await caches.keys()) if (key.startsWith(PREFIX)) await caches.delete(key); event.ports[0]?.postMessage({ payload: true }); })());
});

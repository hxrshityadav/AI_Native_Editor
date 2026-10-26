// Only the editor shell has an offline fallback; this worker never caches or clears website data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.mode !== "navigate" || url.origin !== self.location.origin || url.pathname !== "/studio") return;
  event.respondWith(fetch(event.request).catch(() => new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reel Finisher</title><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;background:#151515}</style></head><body><iframe title="Reel Finisher video editor" allow="cross-origin-isolated; fullscreen" src="/editor/index.html"></iframe></body></html>`, { headers: { "Content-Type": "text/html", "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" } })));
});

/** Fail closed: editing never uploads media, metadata, transcripts or credentials. */
export function installLocalNetwork(): void {
  const originalFetch = globalThis.fetch.bind(globalThis);
  const origin = globalThis.location.origin;
  const allowed = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), globalThis.location.href);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (!["GET", "HEAD"].includes(method)) return false;
    if (["blob:", "data:"].includes(url.protocol)) return true;
    if (url.origin === origin) return !url.pathname.startsWith("/api/");
    return false;
  };
  globalThis.fetch = (input, init) => allowed(input, init) ? originalFetch(input, init) : Promise.reject(new Error("External processing is disabled. Import a local file or use an installed local model."));
  if (typeof window !== "undefined") {
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(this: XMLHttpRequest, method: string, url: string | URL, ...args: unknown[]) {
      if (!allowed(String(url), { method })) throw new Error("External requests are disabled in the local editor.");
      return Reflect.apply(open, this, [method, url, ...args]);
    } as typeof open;
    navigator.sendBeacon = () => false;
    if (import.meta.env.PROD) {
      const disabled = class { constructor() { throw new Error("Connected services are disabled in the local editor."); } };
      window.WebSocket = disabled as unknown as typeof WebSocket;
      window.EventSource = disabled as unknown as typeof EventSource;
    }
    // Upstream error objects can contain user content. Retain only stable diagnostic codes.
    const info = console.info.bind(console);
    console.log = console.info = console.debug = () => {};
    console.error = () => info("[ReelFinisher] EDITOR_ERROR");
    console.warn = () => info("[ReelFinisher] EDITOR_WARNING");
  }
}
installLocalNetwork();

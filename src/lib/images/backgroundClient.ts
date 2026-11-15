import type { BackgroundRequest, BackgroundResult } from "./background";

/** One removal per worker; aborting terminates the worker and frees the model's memory. Status messages report each real step. */
export function runBackgroundTask(request: BackgroundRequest, signal: AbortSignal, onStatus: (status: string) => void): Promise<BackgroundResult> {
  if (signal.aborted) return Promise.reject(new DOMException("Operation cancelled", "AbortError"));
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || typeof WebAssembly === "undefined") return Promise.reject(new Error("This browser cannot run background removal (it needs Web Workers, WebAssembly and OffscreenCanvas). Try a current Chrome, Edge, Firefox or Safari."));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./background.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => { worker.terminate(); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new DOMException("Operation cancelled", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.status) { onStatus(data.status); return; }
      cleanup(); if (data.error || !data.result) reject(new Error(data.error || "Background removal failed. Try another image.")); else resolve(data.result);
    };
    worker.onerror = event => { event.preventDefault(); cleanup(); reject(new Error("Background removal could not start. Reload the page, or try a smaller image or another browser.")); };
    worker.postMessage(request);
  });
}

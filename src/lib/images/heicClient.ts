import type { HeicRequest, HeicResult } from "./heic";

/** Runs one conversion in a fresh worker; aborting terminates it, which also frees libheif's memory. */
export function runHeicTask(request: HeicRequest, signal: AbortSignal): Promise<HeicResult> {
  if (signal.aborted) return Promise.reject(new DOMException("Operation cancelled", "AbortError"));
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || typeof WebAssembly === "undefined") return Promise.reject(new Error("This browser cannot run the HEIC converter (it needs Web Workers, WebAssembly and OffscreenCanvas). Try a current Chrome, Edge, Firefox or Safari."));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./heic.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => { worker.terminate(); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new DOMException("Operation cancelled", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) => { cleanup(); if (data.error || !data.result) reject(new Error(data.error || "HEIC conversion failed. Try another photo.")); else resolve(data.result); };
    worker.onerror = event => { event.preventDefault(); cleanup(); reject(new Error("The HEIC converter could not start. Reload the page, or try a smaller photo or another browser.")); };
    worker.postMessage(request);
  });
}

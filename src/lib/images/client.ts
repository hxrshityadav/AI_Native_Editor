import type { ImageInfo, ImageOutput, ImageRequest } from "./engine";
export async function runImageTask(request: ImageRequest, signal: AbortSignal): Promise<ImageInfo | ImageOutput> {
  if (signal.aborted) throw new DOMException("Operation cancelled", "AbortError");
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") {
    const { processImage } = await import("./engine"); return processImage(request, signal);
  }
  const result = await new Promise<{ result?: ImageInfo | ImageOutput; error?: string; unsupported?: boolean }>((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("./image.worker.ts", import.meta.url), { type: "module" }); }
    catch { resolve({ unsupported: true }); return; }
    const cleanup = () => { worker.terminate(); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new DOMException("Operation cancelled", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) => { cleanup(); resolve(data); };
    worker.onerror = event => { event.preventDefault(); cleanup(); reject(new Error("The image worker could not run. Reload and try a smaller image or another browser.")); };
    worker.postMessage(request);
  });
  if (result.unsupported) { const { processImage } = await import("./engine"); return processImage(request, signal); }
  if (result.error || !result.result) throw new Error(result.error || "Image processing failed. Try another image.");
  return result.result;
}

import type { VideoRequest, VideoResponse } from "./engine";
export function runVideoTask<T extends VideoResponse>(request: VideoRequest, signal: AbortSignal, onProgress?: (value: number) => void, onPhase?: (value: string) => void): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
  if (typeof Worker === "undefined") return Promise.reject(new Error("Video compression needs browser workers. Use a current desktop browser; no server upload fallback is used."));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("./video.worker.ts", import.meta.url), { type: "module" }); }
    catch { reject(new Error("The video worker could not start. Reload or try another browser.")); return; }
    let watchdog: ReturnType<typeof setTimeout>;
    const cleanup = () => { clearTimeout(watchdog); worker.terminate(); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => { cleanup(); reject(new Error("The video encoder stopped responding. Retry at 720p or lower quality, or choose another output format/browser.")); }, 90000); };
    signal.addEventListener("abort", abort, { once: true }); arm();
    worker.onmessage = ({ data }) => {
      arm();
      if (data.type === "progress") { onProgress?.(Math.max(0, Math.min(1, data.value))); return; }
      if (data.type === "phase") { onPhase?.(data.value); return; }
      cleanup(); if (data.type === "done") resolve(data.result); else reject(new Error(data.message));
    };
    worker.onerror = event => { event.preventDefault(); cleanup(); reject(new Error("The media worker failed. Choose a smaller file or try another browser.")); };
    worker.postMessage(request);
  });
}

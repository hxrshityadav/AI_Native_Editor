import type { MediaInfo, MediaRequest, MediaResult, Peaks } from "./engine";
import type { GifResult } from "./gif";
import type { AudioVideoResult } from "./audiovideo";

/** Runs one media task in a fresh worker. Aborting, a crash or 90 s without progress terminates it. Nothing is uploaded. */
export function runMediaTask(request: MediaRequest & { kind: "inspect" }, signal: AbortSignal): Promise<MediaInfo>;
export function runMediaTask(request: MediaRequest & { kind: "peaks" }, signal: AbortSignal): Promise<Peaks>;
export function runMediaTask(request: MediaRequest & { kind: "process" }, signal: AbortSignal, onProgress?: (value: number) => void, onPhase?: (value: string) => void): Promise<MediaResult>;
export function runMediaTask(request: MediaRequest & { kind: "audiovideo" }, signal: AbortSignal, onProgress?: (value: number) => void, onPhase?: (value: string) => void): Promise<AudioVideoResult>;
export function runMediaTask(request: MediaRequest & { kind: "gif" }, signal: AbortSignal, onProgress?: (value: number) => void, onPhase?: (value: string) => void): Promise<GifResult>;
export function runMediaTask(request: MediaRequest, signal: AbortSignal, onProgress?: (value: number) => void, onPhase?: (value: string) => void): Promise<unknown> {
  if (signal.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
  if (typeof Worker === "undefined") return Promise.reject(new Error("This tool needs browser workers. Use a current Chrome, Edge, Firefox or Safari; no server fallback is used."));
  return new Promise((resolve, reject) => {
    let settled = false, watchdog: ReturnType<typeof setTimeout>;
    let worker: Worker;
    try { worker = new Worker(new URL("./media.worker.ts", import.meta.url), { type: "module" }); }
    catch { reject(new Error("The media worker could not start. Reload or try another browser.")); return; }
    const cleanup = () => { settled = true; clearTimeout(watchdog); worker.terminate(); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => { cleanup(); reject(new Error("Processing stopped responding. Try a shorter range or another browser.")); }, 90000); };
    signal.addEventListener("abort", abort, { once: true }); arm();
    worker.onmessage = ({ data }) => {
      if (settled) return;
      arm();
      if (data.type === "progress") { onProgress?.(Math.max(0, Math.min(1, data.value))); return; }
      if (data.type === "phase") { onPhase?.(data.value); return; }
      cleanup(); if (data.type === "done") resolve(data.result); else reject(new Error(data.message));
    };
    worker.onerror = event => { event.preventDefault(); if (settled) return; cleanup(); reject(new Error("The media worker failed. Choose a smaller file or try another browser.")); };
    try { worker.postMessage(request); } catch { cleanup(); reject(new Error("The selected file could not be read. Reselect it and try again.")); }
  });
}

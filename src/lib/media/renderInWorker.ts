import type { CaptionLine, CaptionStyle } from "@/lib/captions/types";
import { RenderError } from "./render";

export type RenderRequest = { file: Blob; lines: CaptionLine[]; style: CaptionStyle };
/** "disk": streamed to the origin private file system. "memory": fallback when OPFS is unavailable. */
export type RenderStorage = "disk" | "memory";
export type RenderMessage =
  | { type: "progress"; value: number }
  | { type: "done"; blob: Blob; storage: RenderStorage }
  /** `name` keeps the DOMException type (e.g. QuotaExceededError), which postMessage would otherwise drop. */
  | { type: "error"; name: string; message: string };

export class RenderCanceledError extends Error {
  name = "RenderCanceledError";
}

export type RenderHandle = {
  result: Promise<{ blob: Blob; storage: RenderStorage }>;
  cancel: () => void;
};

/**
 * Renders in a dedicated worker so decoding, caption drawing and encoding stay
 * off the main thread. One worker per render; cancel terminates it outright.
 */
export function renderInWorker(request: RenderRequest, onProgress: (fraction: number) => void): RenderHandle {
  const worker = new Worker(new URL("./render.worker.ts", import.meta.url), { type: "module" });
  let rejectResult: (err: Error) => void = () => {};

  const result = new Promise<{ blob: Blob; storage: RenderStorage }>((resolve, reject) => {
    rejectResult = reject;
    worker.onmessage = ({ data }: MessageEvent<RenderMessage>) => {
      if (data.type === "progress") return onProgress(data.value);
      worker.terminate();
      if (data.type === "done") resolve({ blob: data.blob, storage: data.storage });
      else reject(Object.assign(new RenderError(data.message), { name: data.name }));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new RenderError(event.message || "The render worker stopped unexpectedly."));
    };
  });
  worker.postMessage(request satisfies RenderRequest);

  return {
    result,
    cancel: () => {
      worker.terminate();
      rejectResult(new RenderCanceledError("Render canceled."));
    },
  };
}

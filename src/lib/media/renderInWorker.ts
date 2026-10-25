import type { CaptionLine, CaptionStyle } from "@/lib/captions/types";
import type { ExportPlan } from "./exportPresets";
import { RenderError } from "./render";

export type RenderRequest = { file: Blob; lines: CaptionLine[]; style: CaptionStyle; plan: ExportPlan };
/** "disk": streamed to the origin private file system. "memory": fallback when OPFS is unavailable. */
export type RenderStorage = "disk" | "memory";
export type RenderMessage =
  | { type: "progress"; value: number }
  | { type: "done"; blob: Blob; storage: RenderStorage; fastStart: boolean; audioCodec: string | null }
  /** `name` keeps the DOMException type (e.g. QuotaExceededError), which postMessage would otherwise drop. */
  | { type: "error"; name: string; message: string };

export class RenderCanceledError extends Error {
  name = "RenderCanceledError";
}

export type RenderResult = { blob: Blob; storage: RenderStorage; fastStart: boolean; audioCodec: string | null };

export type RenderHandle = {
  result: Promise<RenderResult>;
  cancel: () => void;
};

/**
 * Renders in a dedicated worker so decoding, caption drawing and encoding stay
 * off the main thread. One worker per render; cancel terminates it outright.
 */
export function renderInWorker(request: RenderRequest, onProgress: (fraction: number) => void): RenderHandle {
  const worker = new Worker(new URL("./render.worker.ts", import.meta.url), { type: "module" });
  let rejectResult: (err: Error) => void = () => {};

  const result = new Promise<RenderResult>((resolve, reject) => {
    rejectResult = reject;
    worker.onmessage = ({ data }: MessageEvent<RenderMessage>) => {
      if (data.type === "progress") return onProgress(data.value);
      worker.terminate();
      if (data.type === "done") resolve({ blob: data.blob, storage: data.storage, fastStart: data.fastStart, audioCodec: data.audioCodec });
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

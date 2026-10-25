export type LevelsMessage =
  | { type: "progress"; value: number }
  | { type: "done"; levels: Float32Array }
  | { type: "error"; message: string };

export class AnalysisCanceledError extends Error {
  name = "AnalysisCanceledError";
}

/** Measures audio levels in a worker so a 10-minute clip never blocks the page. Cancel terminates it. */
export function analyzeInWorker(audio: Blob, onProgress: (fraction: number) => void) {
  const worker = new Worker(new URL("./audioLevels.worker.ts", import.meta.url), { type: "module" });
  let rejectResult: (err: Error) => void = () => {};
  const result = new Promise<Float32Array>((resolve, reject) => {
    rejectResult = reject;
    worker.onmessage = ({ data }: MessageEvent<LevelsMessage>) => {
      if (data.type === "progress") return onProgress(data.value);
      worker.terminate();
      if (data.type === "done") resolve(data.levels);
      else reject(new Error(data.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "The analysis worker stopped unexpectedly."));
    };
  });
  worker.postMessage({ audio });
  return {
    result,
    cancel: () => {
      worker.terminate();
      rejectResult(new AnalysisCanceledError("Analysis canceled."));
    },
  };
}

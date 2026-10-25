import { measureLevels } from "./audioLevels";
import type { LevelsMessage } from "./analyzeInWorker";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<{ audio: Blob }>) => void) | null;
  postMessage: (message: LevelsMessage, transfer?: Transferable[]) => void;
};

scope.onmessage = async ({ data: { audio } }) => {
  try {
    const levels = await measureLevels(audio, (value) => scope.postMessage({ type: "progress", value }));
    scope.postMessage({ type: "done", levels }, [levels.buffer]);
  } catch (err) {
    scope.postMessage({ type: "error", message: err instanceof Error ? err.message : "Audio analysis failed." });
  }
};

import { BufferTarget, StreamTarget } from "mediabunny";
import { renderCaptionedMp4 } from "./render";
import type { RenderMessage, RenderRequest } from "./renderInWorker";

// The project's TS lib is "dom"; type only the worker globals we use instead of adding "webworker".
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RenderRequest>) => void) | null;
  postMessage: (message: RenderMessage) => void;
};

scope.onmessage = async ({ data: { file, lines, style } }) => {
  let lastPercent = -1;
  const onProgress = (p: number) => {
    const percent = Math.floor(p * 100);
    if (percent === lastPercent) return;
    lastPercent = percent;
    scope.postMessage({ type: "progress", value: p });
  };

  try {
    const disk = await openDiskTarget();
    if (disk) {
      await renderCaptionedMp4(file, lines, style, disk.target, onProgress);
      const blob = await disk.handle.getFile();
      if (blob.size === 0) throw new Error("Render produced no data.");
      scope.postMessage({ type: "done", blob, storage: "disk" });
    } else {
      const target = new BufferTarget();
      await renderCaptionedMp4(file, lines, style, target, onProgress);
      if (!target.buffer?.byteLength) throw new Error("Render produced no data.");
      scope.postMessage({ type: "done", blob: new Blob([target.buffer], { type: "video/mp4" }), storage: "memory" });
    }
  } catch (err) {
    scope.postMessage({ type: "error", message: err instanceof Error ? err.message : "Render failed." });
  }
};

/**
 * Streams the MP4 into the origin private file system so a long or 4K render
 * never sits in memory. Returns null where OPFS writes are unavailable.
 * shortcut: each render first deletes all earlier render files, so a second tab
 * rendering at the same time can lose its output; give renders per-tab folders
 * if that ever matters.
 */
async function openDiskTarget() {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry("renders", { recursive: true }).catch(() => {});
    const dir = await root.getDirectoryHandle("renders", { create: true });
    const handle = await dir.getFileHandle(`render-${Date.now()}.mp4`, { create: true });
    return { handle, target: new StreamTarget(await handle.createWritable(), { chunked: true }) };
  } catch {
    return null;
  }
}

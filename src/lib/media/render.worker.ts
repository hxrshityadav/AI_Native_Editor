import { BufferTarget, StreamTarget } from "mediabunny";
import { loadCaptionFont } from "@/lib/captions/fonts";
import { moveMoovToFront } from "./faststart";
import { renderCaptionedMp4 } from "./render";
import { renderEditedMp4 } from "./renderEdited";
import type { RenderMessage, RenderRequest } from "./renderInWorker";

// The project's TS lib is "dom"; type only the worker globals we use instead of adding "webworker".
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RenderRequest>) => void) | null;
  postMessage: (message: RenderMessage) => void;
  fonts: FontFaceSet;
};

scope.onmessage = async ({ data: { file, lines, style, plan, segments } }) => {
  let lastPercent = -1;
  const onProgress = (p: number) => {
    const percent = Math.floor(p * 100);
    if (percent === lastPercent) return;
    lastPercent = percent;
    scope.postMessage({ type: "progress", value: p });
  };

  // With cuts, only the kept segments are decoded and re-timed; without, one proven Conversion pass.
  const render = (target: BufferTarget | StreamTarget) =>
    segments
      ? renderEditedMp4(file, segments, lines, style, plan, target, onProgress)
      : renderCaptionedMp4(file, lines, style, plan, target, onProgress);

  try {
    // Workers don't see the page's fonts; without this the captions would silently use a system font.
    await loadCaptionFont(style.font, scope.fonts).catch(() => {
      throw new Error("Couldn't load the caption font. Check your connection and try again.");
    });
    const disk = await openDiskTarget();
    if (disk) {
      const { audioCodec } = await render(disk.target);
      const raw = await disk.handle.getFile();
      if (raw.size === 0) throw new Error("Render produced no data.");
      // Streaming leaves moov at the end; move it to the front. If that fails, the original still plays.
      const fast = await fastStartCopy(disk.dir, raw).catch(() => null);
      if (fast) await disk.dir.removeEntry(disk.handle.name).catch(() => {});
      scope.postMessage({ type: "done", blob: fast ?? raw, storage: "disk", fastStart: !!fast, audioCodec });
    } else {
      const target = new BufferTarget();
      const { audioCodec } = await render(target);
      if (!target.buffer?.byteLength) throw new Error("Render produced no data.");
      // BufferTarget renders use fastStart: 'in-memory', so moov is already at the front.
      const blob = new Blob([target.buffer], { type: "video/mp4" });
      scope.postMessage({ type: "done", blob, storage: "memory", fastStart: true, audioCodec });
    }
  } catch (err) {
    const e = err instanceof Error || err instanceof DOMException ? err : new Error(String(err));
    scope.postMessage({ type: "error", name: e.name, message: e.message || "Render failed." });
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
    return { dir, handle, target: new StreamTarget(await handle.createWritable(), { chunked: true }) };
  } catch {
    return null;
  }
}

/** Writes a fast-start copy of `raw` next to it. Null when `raw` is already fast-start. */
async function fastStartCopy(dir: FileSystemDirectoryHandle, raw: File): Promise<File | null> {
  const handle = await dir.getFileHandle(`render-${Date.now()}-faststart.mp4`, { create: true });
  const writable = await handle.createWritable();
  try {
    const moved = await moveMoovToFront(raw, { write: (d) => writable.write(d as Uint8Array<ArrayBuffer>) });
    await writable.close();
    if (!moved) {
      await dir.removeEntry(handle.name);
      return null;
    }
    return await handle.getFile();
  } catch (err) {
    await writable.abort().catch(() => {});
    await dir.removeEntry(handle.name).catch(() => {});
    throw err;
  }
}

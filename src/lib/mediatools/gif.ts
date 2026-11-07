import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { inspectMedia } from "./engine";

/*
 * Video to GIF. Frames are decoded at exact timestamps with Mediabunny (WebCodecs) and encoded with gifenc (MIT) in the
 * media worker. GIF is an inefficient format, so clip length, frame rate, width and output size are capped up front.
 */

export const GIF_LIMITS = { maxSeconds: 15, maxFps: 20, minFps: 5, maxWidth: 640, minWidth: 120, maxFrames: 300, maxBytes: 40 * 1024 * 1024 } as const;
export type GifOptions = { start: number; end: number; fps: number; width: number; colors: 64 | 128 | 256 };
export type GifResult = { blob: Blob; width: number; height: number; frames: number; duration: number; fps: number };

export function validateGifOptions(options: GifOptions, duration: number) {
  const length = options.end - options.start;
  if (!(options.start >= 0 && length >= 0.2 && options.end <= duration + 0.01)) throw new Error("Choose a start before the end, inside the video.");
  if (length > GIF_LIMITS.maxSeconds) throw new Error(`GIFs are limited to ${GIF_LIMITS.maxSeconds} seconds. Choose a shorter range.`);
  if (!(options.fps >= GIF_LIMITS.minFps && options.fps <= GIF_LIMITS.maxFps)) throw new Error(`Choose ${GIF_LIMITS.minFps} to ${GIF_LIMITS.maxFps} frames per second.`);
  if (!(options.width >= GIF_LIMITS.minWidth && options.width <= GIF_LIMITS.maxWidth)) throw new Error(`Choose a width from ${GIF_LIMITS.minWidth} to ${GIF_LIMITS.maxWidth} pixels.`);
  if (![64, 128, 256].includes(options.colors)) throw new Error("Choose 64, 128 or 256 colours.");
  const frames = Math.max(1, Math.round(length * options.fps));
  if (frames > GIF_LIMITS.maxFrames) throw new Error(`That would be ${frames} frames; the limit is ${GIF_LIMITS.maxFrames}. Lower the frame rate or shorten the clip.`);
  return frames;
}

export async function videoToGif(file: File, options: GifOptions, progress: (value: number) => void, phase: (value: string) => void, signal?: AbortSignal): Promise<GifResult> {
  const info = await inspectMedia(file, "video");
  const frames = validateGifOptions(options, info.duration);
  const width = Math.min(options.width, info.video!.width) & ~1, height = Math.max(2, Math.round(width * info.video!.height / info.video!.width) & ~1);
  const input = new Input({ source: new BlobSource(file, { maxCacheSize: 8 * 1024 * 1024 }), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) throw new Error("The video picture could not be decoded in this browser.");
    const sink = new CanvasSink(track, { width, height, fit: "contain", poolSize: 1 });
    const step = 1 / options.fps, delay = Math.round(1000 / options.fps), times = Array.from({ length: frames }, (_, i) => options.start + i * step);
    const gif = GIFEncoder({ initialCapacity: 1024 * 1024 });
    phase(`Encoding ${frames} frames at ${width} × ${height}`);
    let index = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(times)) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      if (!wrapped) continue;
      const context = (wrapped.canvas as OffscreenCanvas).getContext("2d") as OffscreenCanvasRenderingContext2D;
      const rgba = context.getImageData(0, 0, width, height).data;
      const palette = quantize(rgba, options.colors);
      gif.writeFrame(applyPalette(rgba, palette), width, height, { palette, delay, repeat: 0 });
      index++;
      if (gif.bytesView().byteLength > GIF_LIMITS.maxBytes) throw new Error("The GIF is getting larger than 40 MB. Use a smaller width, fewer frames per second or a shorter clip.");
      progress(index / frames);
    }
    if (!index) throw new Error("No frames could be decoded from this range.");
    gif.finish();
    const bytes = gif.bytes();
    if (String.fromCharCode(...bytes.subarray(0, 6)) !== "GIF89a") throw new Error("The GIF encoder produced an invalid file.");
    return { blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "image/gif" }), width, height, frames: index, duration: index / options.fps, fps: options.fps };
  } finally { input.dispose(); }
}

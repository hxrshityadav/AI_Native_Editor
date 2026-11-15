import { ALL_FORMATS, BlobSource, Conversion, Input, Mp4OutputFormat, Output, Quality, StreamTarget, canEncodeAudio, canEncodeVideo } from "mediabunny";
import { inspectMedia, type MediaInfo } from "../mediatools/engine";
import { BoundedVideoBytes } from "../videos/bounded-target";
import { VIDEO_LIMITS } from "../videos/policy";
import { drawCaption, fontById, registerCustomFont, validate, type Caption, type CaptionStyle, type Script } from "./captions";
import { outputSize, paintFrame, type Composition } from "./compose";

/*
 * Burns captions into the picture. Each decoded frame is composed into the output frame (aspect ratio, contain/cover/
 * crop) and the active caption is drawn on top, with the same `paintFrame` and `drawCaption` the preview uses. The
 * canvas is encoded as H.264. Audio is copied when it is already AAC, otherwise encoded to AAC. Runs in the media
 * worker; nothing is uploaded, and a user font travels to the worker as bytes.
 */

export type CustomFontPayload = { id: string; label: string; scripts: Script[]; data: ArrayBuffer };
export type BurnOptions = { captions: Caption[]; style: CaptionStyle; composition: Composition; customFont?: CustomFontPayload };
export type BurnResult = { blob: Blob; info: MediaInfo; width: number; height: number };

/** Upright source size (rotation applied). */
export const uprightSize = (info: MediaInfo) => { const rotated = info.video!.rotation % 180 !== 0; return { width: rotated ? info.video!.height : info.video!.width, height: rotated ? info.video!.width : info.video!.height }; };
export function burnSize(info: MediaInfo, composition: Pick<Composition, "aspect" | "scale">) { const { width, height } = uprightSize(info); return outputSize(width, height, composition); }
const bitrateFor = (width: number, height: number) => Math.round(Math.min(12_000_000, Math.max(1_500_000, width * height * 30 * 0.08)));

type FontScope = { fonts: FontFaceSet; location: Location };
/** Loads the caption font. Export stops with a reason instead of drawing in a substitute font. */
export async function loadCaptionFont(id: string, scope: FontScope = self as unknown as FontScope, custom?: CustomFontPayload) {
  if (custom && custom.id === id) {
    const entry = registerCustomFont(custom), face = new FontFace(entry.family, custom.data);
    try { await face.load(); } catch { throw new Error(`The font ${custom.label} could not be read. Choose another font.`); }
    scope.fonts.add(face); return;
  }
  const font = fontById(id);
  if (font.custom) throw new Error(`The font ${font.label} is not available. Upload it again or choose another font.`);
  for (const file of font.files) {
    const face = new FontFace(font.family, `url(${scope.location.origin}${file.url})`, { weight: font.weights ? `${font.weights[0]} ${font.weights[1]}` : String(font.weight), ...(file.range ? { unicodeRange: file.range } : {}) });
    try { await face.load(); } catch { throw new Error(`The caption font ${font.label} could not be loaded. Reload the page and try again.`); }
    scope.fonts.add(face);
  }
  if (!scope.fonts.check(`${font.weight} 24px "${font.family}"`, "Ag")) throw new Error(`The caption font ${font.label} is not available for export. Reload the page and try again.`);
}

export async function burnCaptions(file: File, options: BurnOptions, progress: (value: number) => void, phase: (value: string) => void, signal?: AbortSignal): Promise<BurnResult> {
  const info = await inspectMedia(file, "video");
  if (!info.video) throw new Error("This file has no video track. Choose a video.");
  if (options.customFont) registerCustomFont(options.customFont);
  if (!options.captions.length) throw new Error("Add at least one caption before exporting a video.");
  const problems = validate(options.captions, info.duration, options.style).filter(issue => issue.level === "error");
  if (problems.length) throw new Error(`Caption ${problems[0].index + 1}: ${problems[0].message}`);
  const { width, height } = burnSize(info, options.composition), bitrate = bitrateFor(width, height);
  if (width * height > VIDEO_LIMITS.pixels) throw new Error("The output is larger than 4K. Choose a smaller output size.");
  if (!await canEncodeVideo("avc", { width, height, bitrate })) throw new Error("This browser cannot encode H.264 video at this size. Choose a smaller output size, or try Chrome or Edge.");
  if (info.audio && info.audio.codec !== "aac" && !await canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: 48000 })) throw new Error("This browser cannot encode AAC audio for the MP4. Try Chrome or Edge.");

  phase("Loading the caption font");
  await loadCaptionFont(options.style.font, undefined, options.customFont);
  const canvas = new OffscreenCanvas(width, height), context = canvas.getContext("2d")!;
  const input = new Input({ source: new BlobSource(file, { maxCacheSize: 16 * 1024 * 1024 }), formats: ALL_FORMATS });
  const bytes = new BoundedVideoBytes(VIDEO_LIMITS.outputBytes);
  const target = new StreamTarget(new WritableStream({ write: chunk => bytes.write(chunk.data, chunk.position) }), { chunked: true, chunkSize: 1024 * 1024 });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: false }), target });
  let conversion: Conversion | undefined;
  const cancel = () => { void conversion?.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    conversion = await Conversion.init({ input, output, tracks: "primary", showWarnings: false, tags: {},
      video: { codec: "avc", allowTransformationMetadata: false, forceTranscode: true, quality: new Quality({ bitrate }), processedWidth: width, processedHeight: height,
        process: sample => {
          paintFrame(context, width, height, sample.displayWidth, sample.displayHeight, options.composition, (x, y, w, h) => sample.draw(context, x, y, w, h));
          drawCaption(context, options.captions, sample.timestamp, options.style, width, height);
          return canvas;
        } },
      audio: info.audio ? { codec: "aac", bitrate: new Quality({ bitrate: 160000 }) } : { discard: true } });
    if (!conversion.isValid) throw new Error("This video cannot be re-encoded in this browser. Convert it to MP4 first, then add captions.");
    phase("Drawing captions and encoding");
    conversion.onProgress = fraction => progress(fraction * 0.97);
    await conversion.execute();
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    phase("Checking the output file");
    const blob = bytes.blob("video/mp4");
    if (!blob.size) throw new Error("No output was produced. Try another browser.");
    const result = await inspectMedia(blob, "video");
    if (result.video?.codec !== "avc" || result.video.width !== width || result.video.height !== height) throw new Error("The exported video did not match the expected H.264 size. No download was created.");
    if (Math.abs(result.duration - info.duration) > 0.25) throw new Error("The exported video's length does not match the original. No download was created.");
    if (!!info.audio !== !!result.audio) throw new Error("The exported video lost its audio track. No download was created.");
    progress(1);
    return { blob, info: result, width, height };
  } finally { signal?.removeEventListener("abort", cancel); await output.cancel().catch(() => {}); input.dispose(); bytes.clear(); canvas.width = canvas.height = 1; }
}

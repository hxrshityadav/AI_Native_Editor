import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  type StreamTarget,
} from "mediabunny";
import { drawCaption } from "@/lib/captions/draw";
import { lineAt } from "@/lib/captions/group";
import type { CaptionLine, CaptionStyle } from "@/lib/captions/types";
import type { ExportPlan } from "./exportPresets";

export class RenderError extends Error {}

/**
 * Burns captions into the video as H.264 MP4, written into `target`. The
 * original audio packets are copied without re-encoding when MP4 can hold
 * them, otherwise transcoded. A StreamTarget gets the metadata at the end of
 * the file, so nothing is held in memory; a BufferTarget gets fast start.
 */
export async function renderCaptionedMp4(
  file: Blob,
  lines: readonly CaptionLine[],
  style: CaptionStyle,
  plan: ExportPlan,
  target: BufferTarget | StreamTarget,
  onProgress?: (fraction: number) => void,
): Promise<{ audioCodec: string | null }> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: target instanceof BufferTarget ? "in-memory" : false }),
    target,
  });
  let canvas: OffscreenCanvas | null = null;
  let ctx: OffscreenCanvasRenderingContext2D | null = null;
  let audioCodec: string | null = null;

  try {
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: {
        codec: "avc",
        forceTranscode: true,
        allowTransformationMetadata: false,
        quality: new Quality(plan.quality),
        // Mediabunny resizes, crops or letterboxes each frame before `process`, so captions are
        // drawn on the output frame at its final size.
        ...(plan.resize ? { width: plan.width, height: plan.height, fit: plan.fit } : {}),
        process: (sample) => {
          const w = sample.displayWidth;
          const h = sample.displayHeight;
          if (!canvas || canvas.width !== w || canvas.height !== h) {
            canvas = new OffscreenCanvas(w, h);
            ctx = canvas.getContext("2d");
          }
          if (!ctx) throw new RenderError("Could not create a 2D canvas.");
          sample.drawWithFit(ctx, { fit: "fill" });
          const line = lineAt(lines, sample.timestamp);
          if (line) drawCaption(ctx, line, sample.timestamp, style, w, h);
          return canvas;
        },
      },
      // Instagram, Facebook and WhatsApp document AAC audio only. AAC sources (most phone footage)
      // are copied untouched; anything else becomes AAC where this browser can encode it.
      audio: async (track) => {
        const source = await track.getCodec();
        if (source === "aac") {
          audioCodec = "aac";
          return {};
        }
        const aac = await canEncodeAudio("aac", {
          numberOfChannels: await track.getNumberOfChannels(),
          sampleRate: await track.getSampleRate(),
        }).catch(() => false);
        audioCodec = aac ? "aac" : source;
        return aac ? { codec: "aac" } : {};
      },
      showWarnings: false,
    });

    const hasVideo = conversion.utilizedTracks.some((t) => t.type === "video");
    if (!conversion.isValid || !hasVideo) {
      const reasons = conversion.discardedTracks.map((d) => `${d.track.type}: ${d.reason}`).join(", ");
      throw new RenderError(`This device can't render this video (${reasons || "unknown reason"}).`);
    }
    if (onProgress) conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    const audioKept = conversion.utilizedTracks.some((t) => t.type === "audio");
    return { audioCodec: audioKept ? audioCodec : null };
  } finally {
    input.dispose();
  }
}

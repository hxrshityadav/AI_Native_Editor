import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, Quality } from "mediabunny";
import { drawCaption } from "@/lib/captions/draw";
import { lineAt } from "@/lib/captions/group";
import type { CaptionLine, CaptionStyle } from "@/lib/captions/types";

export class RenderError extends Error {}

export type RenderHandle = {
  result: Promise<Blob>;
  cancel: () => Promise<void>;
};

/**
 * Burns captions into the video as H.264 MP4. The original audio packets are
 * copied without re-encoding when MP4 can hold them, otherwise transcoded.
 */
export function renderCaptionedMp4(
  file: Blob,
  lines: readonly CaptionLine[],
  style: CaptionStyle,
  onProgress?: (fraction: number) => void,
): RenderHandle {
  let conversion: Conversion | null = null;
  let canceled = false;

  const result = (async () => {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });
    let canvas: OffscreenCanvas | null = null;
    let ctx: OffscreenCanvasRenderingContext2D | null = null;

    try {
      conversion = await Conversion.init({
        input,
        output,
        tracks: "primary",
        video: {
          codec: "avc",
          forceTranscode: true,
          allowTransformationMetadata: false,
          quality: new Quality("high"),
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
        audio: {},
        showWarnings: false,
      });
      if (canceled) throw new RenderError("Render canceled.");

      const hasVideo = conversion.utilizedTracks.some((t) => t.type === "video");
      if (!conversion.isValid || !hasVideo) {
        const reasons = conversion.discardedTracks.map((d) => `${d.track.type}: ${d.reason}`).join(", ");
        throw new RenderError(`This device can't render this video (${reasons || "unknown reason"}).`);
      }
      if (onProgress) conversion.onProgress = (p) => onProgress(p);
      await conversion.execute();

      const buffer = output.target.buffer;
      if (!buffer || buffer.byteLength === 0) throw new RenderError("Render produced no data.");
      return new Blob([buffer], { type: "video/mp4" });
    } finally {
      input.dispose();
    }
  })();

  return {
    result,
    cancel: async () => {
      canceled = true;
      await conversion?.cancel();
    },
  };
}

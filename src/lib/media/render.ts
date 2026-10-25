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
  VideoSample,
  AudioSample,
  type StreamTarget,
} from "mediabunny";
import { drawCaption } from "@/lib/captions/draw";
import { lineAt } from "@/lib/captions/group";
import type { CaptionLine, CaptionStyle } from "@/lib/captions/types";
import type { ExportPlan } from "./exportPresets";
import { assertVideoDuration } from "./duration";
import { drawComposition } from "./composition";
import { inInterval, normalizeCuts, remapCaptionLines, retainedPieces, sourceToEdited } from "../editor/timeline";
import { drawOverlays } from "../captions/overlays";

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
    const duration = await input.computeDuration();
    assertVideoDuration(duration);
    const cuts = normalizeCuts(plan.cuts ?? [], duration);
    const gaps = normalizeCuts(plan.gaps ?? [], duration);
    const captionLines = remapCaptionLines(lines, cuts);
    if (sourceToEdited(duration, cuts) < 0.1) throw new RenderError("Keep at least 0.1 seconds of video. Undo or adjust the cuts and try again.");
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
        ...(plan.composition ? { processedWidth: plan.width, processedHeight: plan.height } :
          plan.resize ? { width: plan.width, height: plan.height, fit: plan.fit } : {}),
        process: (sample) => {
          const pieces = retainedPieces(sample.timestamp, sample.timestamp + sample.duration, cuts);
          if (!pieces.length) return null;
          const w = plan.composition ? plan.width : sample.displayWidth;
          const h = plan.composition ? plan.height : sample.displayHeight;
          if (!canvas || canvas.width !== w || canvas.height !== h) {
            canvas = new OffscreenCanvas(w, h);
            ctx = canvas.getContext("2d");
          }
          if (!ctx) throw new RenderError("Could not create a 2D canvas.");
          const drawAt = (time: number) => {
            if (inInterval(time, gaps)) { ctx!.fillStyle = "#000000"; ctx!.fillRect(0, 0, w, h); }
            else if (plan.composition) drawComposition(ctx!, sample.displayWidth, sample.displayHeight, plan,
              (x, y, width, height) => sample.draw(ctx!, x, y, width, height));
            else sample.drawWithFit(ctx!, { fit: "fill" });
            const editedTime = sourceToEdited(time, cuts);
            const line = lineAt(captionLines, editedTime);
            if (line) drawCaption(ctx!, line, editedTime, style, w, h);
            drawOverlays(ctx!, plan.overlays ?? [], time, style, w, h, undefined, cuts);
          };
          if (cuts.length) return pieces.map((piece) => {
            drawAt(piece.start);
            return new VideoSample(canvas!, { timestamp: sourceToEdited(piece.start, cuts), duration: piece.end - piece.start });
          });
          drawAt(sample.timestamp);
          return canvas;
        },
      },
      // Instagram, Facebook and WhatsApp document AAC audio only. AAC sources (most phone footage)
      // are copied untouched; anything else becomes AAC where this browser can encode it.
      audio: async (track) => {
        if (plan.audio?.muted) { audioCodec = null; return { discard: true }; }
        const source = await track.getCodec();
        const gain = plan.audio?.volume ?? 1;
        if (source === "aac" && !cuts.length && !gaps.length && gain === 1) {
          audioCodec = "aac";
          return {};
        }
        const aac = await canEncodeAudio("aac", {
          numberOfChannels: await track.getNumberOfChannels(),
          sampleRate: await track.getSampleRate(),
        }).catch(() => false);
        audioCodec = aac ? "aac" : source;
        if (cuts.length || gaps.length || gain !== 1) {
          audioCodec = aac ? "aac" : "opus";
          return { codec: aac ? "aac" : "opus", forceTranscode: true, quality: new Quality({ bitrate: 128_000 }),
            process: (sample: AudioSample) => retainedPieces(sample.timestamp, sample.timestamp + sample.duration, cuts).flatMap((piece) => {
              const first = Math.max(0, Math.round((piece.start - sample.timestamp) * sample.sampleRate));
              const last = Math.min(sample.numberOfFrames, Math.round((piece.end - sample.timestamp) * sample.sampleRate));
              if (last <= first) return [];
              let kept = sample.trim(first, last);
              if (gain !== 1 || gaps.length) {
                const pcm = new Float32Array(kept.numberOfFrames * kept.numberOfChannels);
                kept.copyTo(pcm, { planeIndex: 0, format: "f32" });
                if (gain !== 1) for (let i = 0; i < pcm.length; i++) pcm[i] *= gain;
                const frameAt = (time: number) => Math.max(0, Math.min(kept.numberOfFrames, Math.ceil((time - sample.timestamp) * sample.sampleRate - first)));
                for (const gap of gaps) pcm.fill(0, frameAt(gap.start) * kept.numberOfChannels, frameAt(gap.end) * kept.numberOfChannels);
                const changed = new AudioSample({ data: pcm, format: "f32", numberOfChannels: kept.numberOfChannels, sampleRate: kept.sampleRate, timestamp: kept.timestamp });
                kept.close(); kept = changed;
              }
              kept.setTimestamp(sourceToEdited(sample.timestamp + first / sample.sampleRate, cuts));
              return [kept];
            }) };
        }
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

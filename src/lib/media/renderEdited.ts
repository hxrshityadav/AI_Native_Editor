import {
  ALL_FORMATS,
  AudioSample,
  AudioSampleSink,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  canEncodeAudio,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  VideoSampleSink,
  type StreamTarget,
} from "mediabunny";
import { drawCaption } from "@/lib/captions/draw";
import { lineAt } from "@/lib/captions/group";
import type { CaptionLine, CaptionStyle } from "@/lib/captions/types";
import type { KeptSegment } from "@/lib/edit/timeline";
import type { ExportPlan } from "./exportPresets";
import { RenderError } from "./render";
import { LIMITS } from "./validate";

/** Fade at each join so a cut doesn't click: 5 ms is inaudible as a fade but removes the step. */
const JOIN_FADE_SEC = 0.005;

/**
 * Renders only the kept segments of the source, back to back: the cuts are real, not hidden.
 * Video frames and audio samples are re-timed onto the output timeline (`lines` are already in
 * output time), so captions, word highlights and audio stay in sync after every cut.
 *
 * Both tracks are decoded and re-encoded: cutting compressed audio at packet edges would drift and
 * click. Audio is cut sample-accurately and its output clock counts samples, so it can't drift from
 * the video by more than a sample per cut. Memory is one frame and one audio chunk at a time.
 */
export async function renderEditedMp4(
  file: Blob,
  segments: readonly KeptSegment[],
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
  try {
    if ((await input.computeDuration()) > LIMITS.maxDurationSec) throw new RenderError("This video is longer than the limit.");
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack || !(await videoTrack.canDecode())) throw new RenderError("This device can't decode this video for export.");
    const audioTrack = await input.getPrimaryAudioTrack();
    const withAudio = !!audioTrack && (await audioTrack.canDecode());

    const canvas = new OffscreenCanvas(plan.width, plan.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new RenderError("Could not create a 2D canvas.");
    const video = new CanvasSource(canvas, { codec: "avc", quality: new Quality(plan.quality) });
    output.addVideoTrack(video);

    let audio: AudioSampleSource | null = null;
    let audioCodec: string | null = null;
    if (withAudio) {
      const channels = await audioTrack.getNumberOfChannels();
      const sampleRate = await audioTrack.getSampleRate();
      // AAC is what Instagram, Facebook and WhatsApp document; Opus where this browser has no AAC encoder.
      const aac = await canEncodeAudio("aac", { numberOfChannels: channels, sampleRate }).catch(() => false);
      const codec = aac ? "aac" : "opus";
      audioCodec = codec;
      audio = new AudioSampleSource({ codec, quality: new Quality({ bitrate: channels > 1 ? 160_000 : 96_000 }) });
      output.addAudioTrack(audio);
    }
    await output.start();

    const outputDuration = segments.reduce((n, s) => n + (s.sourceEnd - s.sourceStart), 0);
    const renderVideo = async () => {
      const sink = new VideoSampleSink(videoTrack);
      for (const seg of segments) {
        for await (const sample of sink.samples(seg.sourceStart, seg.sourceEnd)) {
          try {
            const start = Math.max(sample.timestamp, seg.sourceStart);
            const end = Math.min(sample.timestamp + sample.duration, seg.sourceEnd);
            if (end - start <= 0) continue;
            const t = seg.outputStart + (start - seg.sourceStart);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, plan.width, plan.height);
            sample.drawWithFit(ctx, { fit: plan.fit });
            const line = lineAt(lines, t);
            if (line) drawCaption(ctx, line, t, style, plan.width, plan.height);
            await video.add(t, end - start);
            onProgress?.(Math.min(1, (t + end - start) / outputDuration));
          } finally {
            sample.close();
          }
        }
      }
      video.close();
    };

    const renderAudio = async () => {
      if (!audio || !audioTrack) return;
      const sink = new AudioSampleSink(audioTrack);
      let written = 0; // output samples so far: the audio clock
      for (const seg of segments) {
        // Hold one chunk back so the segment's last chunk can fade out before it is encoded.
        let held: { planes: Float32Array[]; rate: number } | null = null;
        let first = true;
        const flush = async (chunk: { planes: Float32Array[]; rate: number }) => {
          const n = chunk.planes[0].length;
          const data = new Float32Array(n * chunk.planes.length);
          chunk.planes.forEach((p, c) => data.set(p, c * n));
          const sample = new AudioSample({
            data,
            format: "f32-planar",
            numberOfChannels: chunk.planes.length,
            sampleRate: chunk.rate,
            timestamp: written / chunk.rate,
          });
          written += n;
          await audio.add(sample);
          sample.close();
        };
        for await (const sample of sink.samples(seg.sourceStart, seg.sourceEnd)) {
          try {
            const r = sample.sampleRate;
            const from = Math.max(0, Math.round((seg.sourceStart - sample.timestamp) * r));
            const to = Math.min(sample.numberOfFrames, Math.round((seg.sourceEnd - sample.timestamp) * r));
            if (to <= from) continue;
            const planes = Array.from({ length: sample.numberOfChannels }, (_, c) => {
              const plane = new Float32Array(to - from);
              sample.copyTo(plane, { planeIndex: c, format: "f32-planar", frameOffset: from, frameCount: to - from });
              return plane;
            });
            if (first) fade(planes, r, "in");
            first = false;
            if (held) await flush(held);
            held = { planes, rate: r };
          } finally {
            sample.close();
          }
        }
        if (held) {
          fade(held.planes, held.rate, "out");
          await flush(held);
        }
      }
      audio.close();
    };

    await Promise.all([renderVideo(), renderAudio()]);
    await output.finalize();
    return { audioCodec };
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  } finally {
    input.dispose();
  }
}

function fade(planes: Float32Array[], rate: number, direction: "in" | "out") {
  const n = Math.min(planes[0].length, Math.round(JOIN_FADE_SEC * rate));
  for (const p of planes) {
    for (let i = 0; i < n; i++) {
      const gain = i / n;
      if (direction === "in") p[i] *= gain;
      else p[p.length - 1 - i] *= gain;
    }
  }
}

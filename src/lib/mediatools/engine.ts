import { ALL_FORMATS, AudioSample, AudioSampleSink, BlobSource, Conversion, Input, MkvOutputFormat, Mp4OutputFormat, OggOutputFormat, Output, Quality, StreamTarget, WavOutputFormat, WebMOutputFormat, canEncodeAudio, canEncodeVideo, type OutputFormat } from "mediabunny";
import { probeFile } from "../media/probe";
import { assertVideoDuration } from "../media/duration";
import { BoundedVideoBytes } from "../videos/bounded-target";

/*
 * Local video/audio operations for the standalone tools (trim, remove audio, convert to MP4, extract/convert/cut/boost
 * audio). Built on Mediabunny's Conversion API, the same engine as the Video Compressor. Runs in a worker; nothing is
 * uploaded. Every output is re-probed before it is offered for download.
 */

export const MEDIA_LIMITS = { inputBytes: 512 * 1024 * 1024, outputBytes: 512 * 1024 * 1024, peaks: 800 } as const;
const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"];
const AUDIO_MIMES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/flac", "audio/aac", "audio/mp4", "audio/webm"];

export type MediaInfo = {
  mime: string; duration: number; size: number;
  video: { width: number; height: number; codec: string; rotation: number } | null;
  audio: { codec: string; channels: number; sampleRate: number } | null;
};
export type AudioFormat = "m4a" | "wav" | "ogg";
export type AudioEdit = { start?: number; end?: number; fadeIn?: number; fadeOut?: number; gainDb?: number; normalize?: boolean };
export type MediaOperation =
  | { kind: "trim"; start: number; end: number; mode: "fast" | "precise" }
  | { kind: "mute" }
  | { kind: "mp4" }
  | { kind: "audio"; format: AudioFormat; bitrate?: number; edit?: AudioEdit };
export type MediaRequest = { kind: "inspect"; file: File; expect: "video" | "audio" | "any" } | { kind: "peaks"; file: File } | { kind: "process"; file: File; operation: MediaOperation } | { kind: "gif"; file: File; options: import("./gif").GifOptions } | { kind: "audiovideo"; file: File; options: import("./audiovideo").AudioVideoOptions };
export type MediaResult = { blob: Blob; info: MediaInfo; copied: boolean; clipped?: number; appliedGainDb?: number };
export type Peaks = { peaks: number[]; duration: number; peak: number };

const AUDIO_OUTPUT: Record<AudioFormat, { codec: "aac" | "pcm-s16" | "opus"; mime: string; make: () => OutputFormat }> = {
  m4a: { codec: "aac", mime: "audio/mp4", make: () => new Mp4OutputFormat({ fastStart: false }) },
  wav: { codec: "pcm-s16", mime: "audio/wav", make: () => new WavOutputFormat() },
  ogg: { codec: "opus", mime: "audio/ogg", make: () => new OggOutputFormat() },
};
export const audioExtension = (format: AudioFormat) => ({ m4a: "m4a", wav: "wav", ogg: "ogg" }[format]);
const videoContainer = (mime: string) => mime.startsWith("video/webm") ? { mime: "video/webm", ext: "webm", make: () => new WebMOutputFormat() }
  : mime.startsWith("video/x-matroska") ? { mime: "video/x-matroska", ext: "mkv", make: () => new MkvOutputFormat() }
  : { mime: "video/mp4", ext: "mp4", make: () => new Mp4OutputFormat({ fastStart: false }) };
export const outputExtension = (info: MediaInfo, operation: MediaOperation) => operation.kind === "audio" ? audioExtension(operation.format) : operation.kind === "mp4" ? "mp4" : videoContainer(info.mime).ext;

const abortIfNeeded = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException("Cancelled", "AbortError"); };
const dbToGain = (db: number) => 10 ** (db / 20);

export async function inspectMedia(file: Blob, expect: "video" | "audio" | "any" = "any"): Promise<MediaInfo> {
  if (!file.size || file.size > MEDIA_LIMITS.inputBytes) throw new Error("Choose a non-empty file up to 512 MiB.");
  let probe: Awaited<ReturnType<typeof probeFile>>;
  try { probe = await probeFile(file); } catch { throw new Error("This file could not be read as audio or video. It may be damaged or in an unsupported format."); }
  const mime = probe.mimeType.split(";")[0];
  if (!VIDEO_MIMES.includes(mime) && !AUDIO_MIMES.includes(mime)) throw new Error("This container is not supported. Use MP4, MOV, WebM or MKV video, or MP3, WAV, M4A, Ogg, FLAC or AAC audio.");
  if (expect === "video" && !probe.video) throw new Error("This file has no video track. Choose a video file.");
  if (expect === "audio" && !probe.audio) throw new Error("This file has no audio track, so there is nothing to work with.");
  assertVideoDuration(probe.durationSec);
  if (probe.video && !probe.video.canDecode && expect === "video") throw new Error(`This browser cannot decode ${String(probe.video.codec ?? "this").toUpperCase()} video. Try Chrome or Edge, or re-export as H.264 MP4.`);
  if (probe.audio && !probe.audio.canDecode && expect === "audio") throw new Error(`This browser cannot decode ${String(probe.audio.codec ?? "this").toUpperCase()} audio. Try Chrome or Edge, or another file.`);
  return {
    mime, duration: probe.durationSec, size: file.size,
    video: probe.video ? { width: probe.video.width, height: probe.video.height, codec: String(probe.video.codec ?? "unknown"), rotation: probe.video.rotation ?? 0 } : null,
    audio: probe.audio ? { codec: String(probe.audio.codec ?? "unknown"), channels: probe.audio.channels, sampleRate: probe.audio.sampleRate } : null,
  };
}

/** Real waveform data: the peak level of evenly spaced slices of the decoded audio. */
export async function audioPeaks(file: File, signal?: AbortSignal): Promise<Peaks> {
  const input = new Input({ source: new BlobSource(file, { maxCacheSize: 8 * 1024 * 1024 }), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) throw new Error("The audio could not be decoded in this browser.");
    const duration = await input.computeDuration(), buckets = new Array<number>(MEDIA_LIMITS.peaks).fill(0);
    let peak = 0;
    for await (const sample of new AudioSampleSink(track).samples()) {
      abortIfNeeded(signal);
      const frames = sample.numberOfFrames, plane = new Float32Array(frames);
      for (let channel = 0; channel < sample.numberOfChannels; channel++) {
        sample.copyTo(plane, { planeIndex: channel, format: "f32-planar" });
        for (let i = 0; i < frames; i++) {
          const value = Math.abs(plane[i]), index = Math.min(buckets.length - 1, Math.floor((sample.timestamp + i / sample.sampleRate) / duration * buckets.length));
          if (value > buckets[index]) buckets[index] = value; if (value > peak) peak = value;
        }
      }
      sample.close();
    }
    return { peaks: buckets.map(value => Math.round(value * 1000) / 1000), duration, peak };
  } finally { input.dispose(); }
}

async function measurePeak(input: Input, start: number, end: number, signal?: AbortSignal) {
  const track = await input.getPrimaryAudioTrack();
  if (!track) return 0;
  let peak = 0;
  for await (const sample of new AudioSampleSink(track).samples(start, end)) {
    abortIfNeeded(signal);
    const plane = new Float32Array(sample.numberOfFrames);
    for (let channel = 0; channel < sample.numberOfChannels; channel++) { sample.copyTo(plane, { planeIndex: channel, format: "f32-planar" }); for (const value of plane) if (Math.abs(value) > peak) peak = Math.abs(value); }
    sample.close();
  }
  return peak;
}

/** Gain, fades and a soft limiter applied to each decoded sample. Counts samples that had to be limited. */
function audioProcessor(gain: number, fadeIn: number, fadeOut: number, length: number, stats: { limited: number }) {
  const knee = 0.95;
  return (sample: AudioSample) => {
    const frames = sample.numberOfFrames, channels = sample.numberOfChannels, data = new Float32Array(frames * channels), plane = new Float32Array(frames);
    for (let channel = 0; channel < channels; channel++) {
      sample.copyTo(plane, { planeIndex: channel, format: "f32-planar" });
      for (let i = 0; i < frames; i++) {
        const t = sample.timestamp + i / sample.sampleRate;
        let factor = gain;
        if (fadeIn > 0 && t < fadeIn) factor *= Math.max(0, t / fadeIn);
        if (fadeOut > 0 && t > length - fadeOut) factor *= Math.max(0, (length - t) / fadeOut);
        let value = plane[i] * factor;
        const magnitude = Math.abs(value);
        if (magnitude > knee) { value = Math.sign(value) * (knee + (1 - knee) * Math.tanh((magnitude - knee) / (1 - knee))); stats.limited++; }
        data[channel * frames + i] = value;
      }
    }
    const processed = new AudioSample({ data, format: "f32-planar", numberOfChannels: channels, sampleRate: sample.sampleRate, timestamp: sample.timestamp });
    sample.close();
    return processed;
  };
}

export async function processMedia(file: File, operation: MediaOperation, progress: (value: number) => void, phase: (value: string) => void, signal?: AbortSignal): Promise<MediaResult> {
  const expect = operation.kind === "audio" ? "audio" : "video";
  const info = await inspectMedia(file, expect);
  const input = new Input({ source: new BlobSource(file, { maxCacheSize: 8 * 1024 * 1024 }), formats: ALL_FORMATS });
  const bytes = new BoundedVideoBytes(MEDIA_LIMITS.outputBytes);
  const target = new StreamTarget(new WritableStream({ write: chunk => bytes.write(chunk.data, chunk.position) }), { chunked: true, chunkSize: 1024 * 1024 });
  const container = videoContainer(info.mime);
  const audioOut = operation.kind === "audio" ? AUDIO_OUTPUT[operation.format] : null;
  const output = new Output({ format: audioOut ? audioOut.make() : operation.kind === "mp4" ? new Mp4OutputFormat({ fastStart: false }) : container.make(), target });
  let conversion: Conversion | undefined;
  const cancel = () => { void conversion?.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  const stats = { limited: 0 };
  let appliedGainDb: number | undefined;
  try {
    if (operation.kind === "trim") {
      if (!(operation.start >= 0 && operation.end > operation.start + 0.05 && operation.end <= info.duration + 0.01)) throw new Error("Choose a start before the end, inside the video.");
      conversion = await Conversion.init({ input, output, tracks: "primary", trim: { start: operation.start, end: operation.end }, showWarnings: false, tags: {},
        copy: operation.mode === "fast" ? { mode: "forced", shiftTolerance: Infinity } : {} });
    } else if (operation.kind === "mute") {
      if (!info.audio) throw new Error("This video has no audio track to remove.");
      conversion = await Conversion.init({ input, output, tracks: "primary", audio: { discard: true }, copy: { mode: "forced" }, showWarnings: false, tags: {} });
    } else if (operation.kind === "mp4") {
      const video = info.video!;
      if (!await canEncodeVideo("avc", { width: video.width, height: video.height }) && video.codec !== "avc") throw new Error("This browser has no H.264 encoder, so the video cannot be converted to a widely playable MP4. Try Chrome or Edge.");
      if (info.audio && info.audio.codec !== "aac" && !await canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: 48000 })) throw new Error("This browser has no AAC encoder for MP4 audio. Try Chrome or Edge.");
      conversion = await Conversion.init({ input, output, tracks: "primary", showWarnings: false, tags: {},
        video: { codec: "avc", allowTransformationMetadata: true }, audio: info.audio ? { codec: "aac", bitrate: new Quality({ bitrate: 160000 }) } : { discard: true } });
    } else {
      const edit = operation.edit ?? {}, start = edit.start ?? 0, end = edit.end ?? info.duration;
      if (!(start >= 0 && end > start + 0.05 && end <= info.duration + 0.01)) throw new Error("Choose a start before the end, inside the audio.");
      if (edit.gainDb !== undefined && !(edit.gainDb >= -24 && edit.gainDb <= 24)) throw new Error("Choose a volume change between -24 dB and +24 dB.");
      if (audioOut!.codec !== "pcm-s16" && !await canEncodeAudio(audioOut!.codec, { numberOfChannels: Math.min(2, info.audio!.channels), sampleRate: 48000 })) throw new Error(`This browser cannot encode ${operation.format === "m4a" ? "AAC (M4A)" : "Opus (Ogg)"} audio. Choose WAV, or try Chrome or Edge.`);
      let gain = dbToGain(edit.gainDb ?? 0);
      if (edit.normalize) {
        phase("Measuring the loudest peak");
        const peak = await measurePeak(input, start, end, signal);
        if (peak <= 0.0001) throw new Error("The selected audio is silent, so it cannot be normalized.");
        gain = dbToGain(-1) / peak; // peak normalization to -1 dBFS
      }
      appliedGainDb = Math.round(20 * Math.log10(gain) * 10) / 10;
      const processing = gain !== 1 || (edit.fadeIn ?? 0) > 0 || (edit.fadeOut ?? 0) > 0;
      conversion = await Conversion.init({ input, output, tracks: "primary", video: { discard: true }, trim: { start, end }, showWarnings: false, tags: {},
        audio: { codec: audioOut!.codec, numberOfChannels: Math.min(2, info.audio!.channels), ...(audioOut!.codec === "opus" ? { sampleRate: 48000 } : {}), ...(audioOut!.codec !== "pcm-s16" ? { bitrate: new Quality({ bitrate: operation.bitrate ?? 160000 }) } : {}),
          ...(processing ? { forceTranscode: true, process: audioProcessor(gain, edit.fadeIn ?? 0, edit.fadeOut ?? 0, end - start, stats) } : {}) } });
    }
    if (!conversion.isValid) throw new Error(operation.kind === "trim" && operation.mode === "precise" ? "This browser cannot re-encode this video's codec for a precise cut. Use Fast mode, or try Chrome or Edge." : "This file's tracks cannot be written to the chosen output in this browser. Try another format or browser.");
    abortIfNeeded(signal);
    phase(operation.kind === "audio" ? "Encoding audio" : operation.kind === "mp4" ? "Converting to MP4" : operation.kind === "mute" ? "Removing the audio track" : "Cutting the video");
    conversion.onProgress = fraction => progress(fraction);
    await conversion.execute();
    abortIfNeeded(signal);
    phase("Checking the output file");
    const mime = audioOut ? audioOut.mime : operation.kind === "mp4" ? "video/mp4" : container.mime;
    const blob = bytes.blob(mime);
    if (!blob.size) throw new Error("No output was produced. Try another file or browser.");
    const result = await inspectMedia(blob, audioOut ? "audio" : "video");
    if (audioOut && result.video) throw new Error("The audio output unexpectedly contains video. Please report this file.");
    if (operation.kind === "mute" && result.audio) throw new Error("The audio track could not be removed from this file.");
    // Stream copy (no re-encoding) is used for fast trims, audio removal, and MP4 conversion of H.264/AAC sources.
    const copied = operation.kind === "mute" || (operation.kind === "trim" && operation.mode === "fast") || (operation.kind === "mp4" && info.video?.codec === "avc" && (!info.audio || info.audio.codec === "aac"));
    return { blob, info: result, copied, clipped: stats.limited, appliedGainDb };
  } finally { signal?.removeEventListener("abort", cancel); await output.cancel().catch(() => {}); input.dispose(); bytes.clear(); }
}

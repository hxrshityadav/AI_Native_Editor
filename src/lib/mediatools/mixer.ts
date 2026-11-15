import { ALL_FORMATS, AudioSample, AudioSampleSink, BlobSource, Conversion, Input, MkvOutputFormat, Mp4OutputFormat, Output, Quality, StreamTarget, WavOutputFormat, WebMOutputFormat, canEncodeAudio } from "mediabunny";
import { inspectMedia, MEDIA_LIMITS, type MediaInfo } from "./engine";
import { BoundedVideoBytes } from "../videos/bounded-target";

/*
 * Music Mixer: lays a music track under a voice recording or a video's own audio, with automatic ducking. The voice is
 * analysed first; wherever speech is detected the music gain follows a smoothed, time-dependent curve down by the chosen
 * depth and back up after the speech ends. Everything runs in a worker on decoded samples; nothing is uploaded.
 * For video input the picture is copied without re-encoding and only the audio track is rewritten.
 */

export const MIX_RATE = 48000;
export const MIX_WINDOW = 0.02; // 20 ms analysis windows
export type MixFormat = "m4a" | "wav";
export type MixOptions = {
  voiceGainDb: number; musicGainDb: number;
  duck: boolean; duckDepthDb: number;
  musicOffset: number; loop: boolean;
  fadeIn: number; fadeOut: number;
  /** Audio-only sources only. Video sources keep their container and get AAC (MP4/MKV) or Opus (WebM) audio. */
  format: MixFormat;
};
export type MixResult = { blob: Blob; info: MediaInfo; clipped: number; speechSeconds: number; duckedSeconds: number; musicSeconds: number; video: boolean };
export const DEFAULT_MIX: MixOptions = { voiceGainDb: 0, musicGainDb: -14, duck: true, duckDepthDb: 12, musicOffset: 0, loop: true, fadeIn: 2, fadeOut: 3, format: "m4a" };

const dbToGain = (db: number) => 10 ** (db / 20);
const abortIfNeeded = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException("Cancelled", "AbortError"); };

export function validateMixOptions(o: MixOptions) {
  if (!(o.voiceGainDb >= -12 && o.voiceGainDb <= 12)) throw new Error("Choose a voice level between -12 dB and +12 dB.");
  if (!(o.musicGainDb >= -36 && o.musicGainDb <= 0)) throw new Error("Choose a music level between -36 dB and 0 dB.");
  if (!(o.duckDepthDb >= 3 && o.duckDepthDb <= 30)) throw new Error("Choose a ducking depth between 3 dB and 30 dB.");
  if (!(o.musicOffset >= 0)) throw new Error("The music start must be zero or later.");
  if (!(o.fadeIn >= 0 && o.fadeIn <= 15 && o.fadeOut >= 0 && o.fadeOut <= 15)) throw new Error("Choose music fades between 0 and 15 seconds.");
}

/**
 * Speech detection on RMS levels (dBFS, one value per analysis window). The threshold sits 10 dB above the recording's
 * noise floor (its 10th-percentile level), clamped to -50…-20 dBFS, so quiet and loud recordings are both handled.
 */
export function detectSpeech(levelsDb: Float32Array, window = MIX_WINDOW, preRoll = 0.12, hold = 0.35): Uint8Array {
  const speech = new Uint8Array(levelsDb.length);
  if (!levelsDb.length) return speech;
  const sorted = Float32Array.from(levelsDb).sort();
  const floor = Math.max(-90, sorted[Math.floor(sorted.length * 0.1)]);
  const threshold = Math.min(-20, Math.max(-50, floor + 10));
  const before = Math.round(preRoll / window), after = Math.round(hold / window);
  for (let i = 0; i < levelsDb.length; i++) {
    if (levelsDb[i] <= threshold) continue;
    for (let j = Math.max(0, i - before); j <= Math.min(levelsDb.length - 1, i + after); j++) speech[j] = 1;
  }
  return speech;
}

/** Music gain per window (linear): `depth` below unity during speech, smoothed with separate attack and release times. */
export function duckingCurve(speech: Uint8Array, depthDb: number, window = MIX_WINDOW, attack = 0.06, release = 0.4): Float32Array {
  const gains = new Float32Array(speech.length), down = 1 - Math.exp(-window / attack), up = 1 - Math.exp(-window / release);
  let current = 0; // dB
  for (let i = 0; i < speech.length; i++) {
    const target = speech[i] ? -depthDb : 0;
    current += (target - current) * (target < current ? down : up);
    gains[i] = dbToGain(current);
  }
  return gains;
}

/** Streaming linear resampler into a fixed-size interleaved stereo Int16 buffer. Mono input is copied to both sides. */
export class StereoResampler {
  readonly out: Int16Array; written = 0;
  private readonly step: number; private position = 0; private prev: [number, number] | null = null;
  constructor(inRate: number, maxFrames: number, readonly outRate = MIX_RATE) { this.step = inRate / outRate; this.out = new Int16Array(maxFrames * 2); }
  get full() { return this.written * 2 >= this.out.length; }
  /** `left`/`right` are planar float frames at the input rate. Returns false once the buffer is full. */
  push(left: Float32Array, right: Float32Array) {
    const frames = left.length; if (!frames) return !this.full;
    const at = (i: number, side: 0 | 1) => i < 0 ? this.prev![side] : (side ? right : left)[i];
    // `position` is measured in input frames relative to this chunk; -1 refers to the previous chunk's last frame.
    while (!this.full) {
      const base = Math.floor(this.position), frac = this.position - base;
      if (base + 1 >= frames) break;
      if (base < 0 && !this.prev) { this.position = 0; continue; }
      for (const side of [0, 1] as const) {
        const value = at(base, side) + (at(base + 1, side) - at(base, side)) * frac;
        this.out[this.written * 2 + side] = Math.max(-32768, Math.min(32767, Math.round(value * 32767)));
      }
      this.written++; this.position += this.step;
    }
    this.prev = [left[frames - 1], right[frames - 1]];
    this.position -= frames;
    return !this.full;
  }
}

/** Short cosine edges so a looped music segment has no click at its seam. */
export function fadeEdges(buffer: Int16Array, frames: number, edgeFrames: number) {
  const n = Math.min(edgeFrames, Math.floor(frames / 2));
  for (let i = 0; i < n; i++) {
    const g = 0.5 - 0.5 * Math.cos(Math.PI * i / n);
    for (const c of [0, 1]) { buffer[i * 2 + c] = Math.round(buffer[i * 2 + c] * g); buffer[(frames - 1 - i) * 2 + c] = Math.round(buffer[(frames - 1 - i) * 2 + c] * g); }
  }
}

async function speechLevels(file: File, duration: number, signal?: AbortSignal, progress?: (value: number) => void) {
  const input = new Input({ source: new BlobSource(file, { maxCacheSize: 8 * 1024 * 1024 }), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) throw new Error("The voice audio could not be decoded in this browser.");
    const windows = Math.max(1, Math.ceil(duration / MIX_WINDOW)), sums = new Float64Array(windows), counts = new Uint32Array(windows);
    for await (const sample of new AudioSampleSink(track).samples()) {
      abortIfNeeded(signal);
      const frames = sample.numberOfFrames, channels = sample.numberOfChannels, plane = new Float32Array(frames), mono = new Float32Array(frames);
      for (let c = 0; c < channels; c++) { sample.copyTo(plane, { planeIndex: c, format: "f32-planar" }); for (let i = 0; i < frames; i++) mono[i] += plane[i] / channels; }
      for (let i = 0; i < frames; i++) { const w = Math.min(windows - 1, Math.floor((sample.timestamp + i / sample.sampleRate) / MIX_WINDOW)); if (w >= 0) { sums[w] += mono[i] * mono[i]; counts[w]++; } }
      progress?.(Math.min(1, (sample.timestamp + sample.duration) / duration));
      sample.close();
    }
    const levels = new Float32Array(windows);
    for (let w = 0; w < windows; w++) levels[w] = counts[w] ? 10 * Math.log10(Math.max(1e-9, sums[w] / counts[w])) : -90;
    return levels;
  } finally { input.dispose(); }
}

async function decodeMusic(file: File, offset: number, needSeconds: number, signal?: AbortSignal, progress?: (value: number) => void) {
  const input = new Input({ source: new BlobSource(file, { maxCacheSize: 8 * 1024 * 1024 }), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) throw new Error("The music file has no audio this browser can decode. Use MP3, WAV, M4A, Ogg or FLAC.");
    const duration = await input.computeDuration();
    if (!(duration > offset + 0.5)) throw new Error("The music start is at or after the end of the music. Choose an earlier start.");
    const length = Math.min(duration - offset, needSeconds);
    const resampler = new StereoResampler(track.sampleRate, Math.ceil(length * MIX_RATE));
    for await (const sample of new AudioSampleSink(track).samples(offset, offset + length)) {
      abortIfNeeded(signal);
      const frames = sample.numberOfFrames, left = new Float32Array(frames), right = new Float32Array(frames);
      sample.copyTo(left, { planeIndex: 0, format: "f32-planar" });
      if (sample.numberOfChannels > 1) sample.copyTo(right, { planeIndex: 1, format: "f32-planar" }); else right.set(left);
      const more = resampler.push(left, right);
      progress?.(Math.min(1, (sample.timestamp - offset + sample.duration) / length));
      sample.close();
      if (!more) break;
    }
    return { buffer: resampler.out, frames: resampler.written };
  } finally { input.dispose(); }
}

export async function mixMusic(file: File, music: File, options: MixOptions, progress: (value: number) => void, phase: (value: string) => void, signal?: AbortSignal): Promise<MixResult> {
  validateMixOptions(options);
  const info = await inspectMedia(file, "audio");
  if (!music.size || music.size > MEDIA_LIMITS.inputBytes) throw new Error("Choose a non-empty music file up to 512 MiB.");
  const video = !!info.video;
  const duration = info.duration;

  phase(options.duck ? "Finding the speech" : "Reading the voice");
  const levels = options.duck ? await speechLevels(file, duration, signal, value => progress(value * 0.2)) : new Float32Array(0);
  const speech = options.duck ? detectSpeech(levels) : new Uint8Array(0);
  const gains = options.duck ? duckingCurve(speech, options.duckDepthDb) : new Float32Array(0);
  abortIfNeeded(signal);

  phase("Preparing the music");
  const musicData = await decodeMusic(music, options.musicOffset, duration, signal, value => progress(0.2 + value * 0.15));
  if (!musicData.frames) throw new Error("No audio could be read from the music file.");
  const loopNeeded = options.loop && musicData.frames < duration * MIX_RATE;
  if (loopNeeded) fadeEdges(musicData.buffer, musicData.frames, Math.round(0.015 * MIX_RATE));
  abortIfNeeded(signal);

  const container = video
    ? info.mime.startsWith("video/webm") ? { make: () => new WebMOutputFormat(), mime: "video/webm", codec: "opus" as const }
      : info.mime.startsWith("video/x-matroska") ? { make: () => new MkvOutputFormat(), mime: "video/x-matroska", codec: "aac" as const }
        : { make: () => new Mp4OutputFormat({ fastStart: false }), mime: "video/mp4", codec: "aac" as const }
    : options.format === "wav" ? { make: () => new WavOutputFormat(), mime: "audio/wav", codec: "pcm-s16" as const }
      : { make: () => new Mp4OutputFormat({ fastStart: false }), mime: "audio/mp4", codec: "aac" as const };
  if (container.codec !== "pcm-s16" && !await canEncodeAudio(container.codec, { numberOfChannels: 2, sampleRate: MIX_RATE })) throw new Error(`This browser cannot encode ${container.codec === "aac" ? "AAC" : "Opus"} audio. Try Chrome or Edge, or choose WAV.`);

  const voiceGain = dbToGain(options.voiceGainDb), musicGain = dbToGain(options.musicGainDb);
  const stats = { limited: 0 };
  const knee = 0.95, buf = musicData.buffer, musicFrames = musicData.frames, windows = gains.length;
  const process = (sample: AudioSample) => {
    const frames = sample.numberOfFrames, channels = sample.numberOfChannels, data = new Float32Array(frames * 2), plane = new Float32Array(frames);
    const voice = [new Float32Array(frames), new Float32Array(frames)];
    for (let c = 0; c < Math.min(2, channels); c++) { sample.copyTo(plane, { planeIndex: c, format: "f32-planar" }); voice[c].set(plane); }
    if (channels === 1) voice[1].set(voice[0]);
    for (let i = 0; i < frames; i++) {
      const t = sample.timestamp + i / sample.sampleRate;
      let m = Math.round(t * MIX_RATE);
      if (loopNeeded) m %= musicFrames;
      let duck = 1;
      if (windows) { const w = t / MIX_WINDOW, a = Math.min(windows - 1, Math.max(0, Math.floor(w))), b = Math.min(windows - 1, a + 1), f = Math.min(1, Math.max(0, w - a)); duck = gains[a] + (gains[b] - gains[a]) * f; }
      let fade = 1;
      if (options.fadeIn > 0 && t < options.fadeIn) fade *= t / options.fadeIn;
      if (options.fadeOut > 0 && t > duration - options.fadeOut) fade *= Math.max(0, (duration - t) / options.fadeOut);
      const level = musicGain * duck * fade;
      for (const c of [0, 1]) {
        const musicValue = m >= 0 && m < musicFrames ? buf[m * 2 + c] / 32767 : 0;
        let value = voice[c][i] * voiceGain + musicValue * level;
        const magnitude = Math.abs(value);
        if (magnitude > knee) { value = Math.sign(value) * (knee + (1 - knee) * Math.tanh((magnitude - knee) / (1 - knee))); stats.limited++; }
        data[c * frames + i] = value;
      }
    }
    const processed = new AudioSample({ data, format: "f32-planar", numberOfChannels: 2, sampleRate: sample.sampleRate, timestamp: sample.timestamp });
    sample.close();
    return processed;
  };

  const input = new Input({ source: new BlobSource(file, { maxCacheSize: 8 * 1024 * 1024 }), formats: ALL_FORMATS });
  const bytes = new BoundedVideoBytes(MEDIA_LIMITS.outputBytes);
  const target = new StreamTarget(new WritableStream({ write: chunk => bytes.write(chunk.data, chunk.position) }), { chunked: true, chunkSize: 1024 * 1024 });
  const output = new Output({ format: container.make(), target });
  let conversion: Conversion | undefined;
  const cancel = () => { void conversion?.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    conversion = await Conversion.init({ input, output, tracks: "primary", showWarnings: false, tags: {},
      ...(video ? {} : { video: { discard: true } }),
      audio: { codec: container.codec, numberOfChannels: 2, sampleRate: MIX_RATE, forceTranscode: true, process, processedNumberOfChannels: 2, processedSampleRate: MIX_RATE,
        ...(container.codec !== "pcm-s16" ? { bitrate: new Quality({ bitrate: 192000 }) } : {}) } });
    if (!conversion.isValid) throw new Error(video ? "This video's picture cannot be copied into a new file in this browser. Convert it to MP4 first, then mix." : "This audio cannot be written in the chosen format in this browser.");
    abortIfNeeded(signal);
    phase("Mixing and encoding");
    conversion.onProgress = fraction => progress(0.35 + fraction * 0.6);
    await conversion.execute();
    abortIfNeeded(signal);
    phase("Checking the output file");
    const blob = bytes.blob(container.mime);
    if (!blob.size) throw new Error("No output was produced. Try another file or browser.");
    const result = await inspectMedia(blob, video ? "video" : "audio");
    if (!result.audio) throw new Error("The mixed file has no audio track. Please try again.");
    if (Math.abs(result.duration - duration) > 0.5) throw new Error("The mixed file's length does not match the original. Please try again.");
    progress(1);
    const speechSeconds = speech.reduce((sum, value) => sum + value, 0) * MIX_WINDOW;
    const duckedSeconds = gains.reduce((sum, value) => sum + (value < dbToGain(-3) ? 1 : 0), 0) * MIX_WINDOW;
    return { blob, info: result, clipped: stats.limited, speechSeconds, duckedSeconds, musicSeconds: musicFrames / MIX_RATE, video };
  } finally { signal?.removeEventListener("abort", cancel); await output.cancel().catch(() => {}); input.dispose(); bytes.clear(); }
}

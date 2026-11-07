import { ALL_FORMATS, AudioSampleSink, AudioSampleSource, BlobSource, CanvasSource, Input, Mp4OutputFormat, Output, StreamTarget, canEncodeAudio, canEncodeVideo } from "mediabunny";
import { inspectMedia, MEDIA_LIMITS } from "./engine";
import { BoundedVideoBytes } from "../videos/bounded-target";

/*
 * Audio to Video: turns an audio file (or a video's soundtrack) into an MP4 with a background colour or image and a
 * level visualiser drawn from the audio's measured loudness. Encoded with WebCodecs through Mediabunny in the media worker.
 */

export const FRAME_RATE = 24;
export const SHAPES = { square: [1080, 1080], landscape: [1280, 720], portrait: [720, 1280] } as const;
export type AudioVideoOptions = { shape: keyof typeof SHAPES; background: string; accent: string; image?: Blob };
export type AudioVideoResult = { blob: Blob; width: number; height: number; duration: number };
const BARS = 48;

/** Pass 1: the RMS level of the audio during each video frame (0 to 1). */
async function frameLevels(input: Input, duration: number, signal?: AbortSignal) {
  const track = await input.getPrimaryAudioTrack();
  if (!track || !(await track.canDecode())) throw new Error("The audio could not be decoded in this browser.");
  const count = Math.max(1, Math.ceil(duration * FRAME_RATE)), sums = new Float64Array(count), counts = new Uint32Array(count);
  for await (const sample of new AudioSampleSink(track).samples()) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const plane = new Float32Array(sample.numberOfFrames);
    sample.copyTo(plane, { planeIndex: 0, format: "f32-planar" });
    for (let i = 0; i < plane.length; i++) { const frame = Math.min(count - 1, Math.floor((sample.timestamp + i / sample.sampleRate) * FRAME_RATE)); sums[frame] += plane[i] * plane[i]; counts[frame]++; }
    sample.close();
  }
  const levels = Array.from(sums, (sum, i) => Math.sqrt(sum / Math.max(1, counts[i])));
  const loudest = Math.max(0.0001, ...levels);
  return levels.map(level => level / loudest);
}

export async function audioToVideo(file: File, options: AudioVideoOptions, progress: (value: number) => void, phase: (value: string) => void, signal?: AbortSignal): Promise<AudioVideoResult> {
  const info = await inspectMedia(file, "audio");
  if (!/^#[0-9a-f]{6}$/i.test(options.background) || !/^#[0-9a-f]{6}$/i.test(options.accent)) throw new Error("Choose valid colours.");
  const [width, height] = SHAPES[options.shape];
  if (!await canEncodeVideo("avc", { width, height })) throw new Error("This browser has no H.264 encoder at this size. Try Chrome or Edge, or another shape.");
  if (!await canEncodeAudio("aac", { numberOfChannels: Math.min(2, info.audio!.channels), sampleRate: info.audio!.sampleRate })) throw new Error("This browser has no AAC encoder for MP4 audio. Try Chrome or Edge.");
  const background = options.image ? await createImageBitmap(options.image).catch(() => { throw new Error("The background image could not be read. Choose a JPEG, PNG or WebP."); }) : undefined;
  const input = new Input({ source: new BlobSource(file, { maxCacheSize: 8 * 1024 * 1024 }), formats: ALL_FORMATS });
  const bytes = new BoundedVideoBytes(MEDIA_LIMITS.outputBytes);
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: false }), target: new StreamTarget(new WritableStream({ write: chunk => bytes.write(chunk.data, chunk.position) }), { chunked: true, chunkSize: 1024 * 1024 }) });
  const canvas = new OffscreenCanvas(width, height), context = canvas.getContext("2d")!;
  try {
    phase("Measuring the audio levels");
    const levels = await frameLevels(input, info.duration, signal);
    const video = new CanvasSource(canvas, { codec: "avc", bitrate: 2_000_000, keyFrameInterval: 2 });
    const audio = new AudioSampleSource({ codec: "aac", bitrate: 160_000 });
    output.addVideoTrack(video, { frameRate: FRAME_RATE }); output.addAudioTrack(audio);
    await output.start();
    const barWidth = width * 0.8 / BARS, baseline = height * 0.78, maxBar = height * 0.32;
    const draw = (frame: number) => {
      if (background) { const scale = Math.max(width / background.width, height / background.height), w = background.width * scale, h = background.height * scale; context.drawImage(background, (width - w) / 2, (height - h) / 2, w, h); }
      else { context.fillStyle = options.background; context.fillRect(0, 0, width, height); }
      context.fillStyle = options.accent;
      // The newest level is on the right; older levels scroll left.
      for (let bar = 0; bar < BARS; bar++) {
        const level = levels[frame - (BARS - 1 - bar)] ?? 0, h = Math.max(4, level * maxBar);
        context.fillRect(width * 0.1 + bar * barWidth + barWidth * 0.15, baseline - h, barWidth * 0.7, h);
      }
    };
    phase("Encoding the video");
    const frames = levels.length;
    let next = 0;
    const track = await input.getPrimaryAudioTrack();
    for await (const sample of new AudioSampleSink(track!).samples()) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      // Keep the picture slightly ahead of the sound so the muxer can interleave the two tracks.
      while (next < frames && next / FRAME_RATE <= sample.timestamp + sample.duration) { draw(next); await video.add(next / FRAME_RATE, 1 / FRAME_RATE); next++; progress(next / frames); }
      await audio.add(sample); sample.close();
    }
    while (next < frames) { draw(next); await video.add(next / FRAME_RATE, 1 / FRAME_RATE); next++; }
    await output.finalize();
    phase("Checking the output file");
    const blob = bytes.blob("video/mp4"), result = await inspectMedia(blob, "video");
    if (!result.audio || !result.video || Math.abs(result.duration - info.duration) > 0.25) throw new Error("The generated video failed its length or track check. Try another file or browser.");
    return { blob, width, height, duration: result.duration };
  } finally { background?.close(); await output.cancel().catch(() => {}); input.dispose(); bytes.clear(); canvas.width = canvas.height = 1; }
}

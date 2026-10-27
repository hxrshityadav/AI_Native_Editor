import { ALL_FORMATS, BlobSource, Input, Conversion, Output, Mp4OutputFormat, WebMOutputFormat, StreamTarget, Quality, canEncodeVideo, canEncodeAudio, VideoSampleSink } from "mediabunny";
import { probeFile } from "../media/probe";
import { BoundedVideoBytes } from "./bounded-target";
import { VIDEO_LIMITS, validateVideoFile, validateVideoSource, videoPlan, videoSignature, type VideoContainer, type VideoSettings, type VideoSource } from "./policy";

export type VideoInfo = VideoSource & { format: string; videoCodec: string; audioCodec: string | null; notes: string[] };
export type VideoSupport = { mp4: string | null; webm: string | null };
export type VideoResult = { blob: Blob; info: VideoInfo; container: VideoContainer; targetMet: boolean; videoBitrate: number };
export type VideoRequest = { kind: "inspect"; file: File } | { kind: "support"; info: VideoInfo; settings: VideoSettings } | { kind: "compress"; file: File; settings: VideoSettings };
export type VideoResponse = VideoInfo | VideoSupport | VideoResult;
const mime = { mp4: "video/mp4", webm: "video/webm" };
const codecs = { mp4: { video: "avc", audio: "aac" }, webm: { video: "vp9", audio: "opus" } } as const;

export async function inspectVideo(file: File | Blob, declaredType = file.type, checkBasics = true): Promise<VideoInfo> {
  if (checkBasics) validateVideoFile({ size: file.size, type: declaredType });
  videoSignature(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
  let probe: Awaited<ReturnType<typeof probeFile>>;
  try { probe = await probeFile(file); } catch { throw new Error("This video could not be read. It may be corrupted; choose the original file or re-export as H.264 MP4."); }
  if (!probe.video) throw new Error("This file has no video track. Choose the video, not an audio-only file.");
  const actualMime = probe.mimeType.split(";")[0];
  if (!["video/mp4", "video/quicktime", "video/webm"].includes(actualMime)) throw new Error("This container is not supported. Re-export as MP4, MOV or WebM.");
  const declaration = declaredType === "video/x-m4v" ? "video/mp4" : declaredType;
  if (checkBasics && declaration && declaration !== "application/octet-stream" && declaration !== actualMime) throw new Error("The declared video type does not match the actual container. Use the original file or correct its extension and try again.");
  const info: VideoInfo = { width: probe.video.width, height: probe.video.height, duration: probe.durationSec, frameRate: 30, hasAudio: !!probe.audio, audioDecodable: probe.audio?.canDecode ?? true, format: actualMime, videoCodec: probe.video.codec ?? "unknown", audioCodec: probe.audio?.codec ?? null, notes: [] };
  validateVideoSource(info);
  if (!probe.video.canDecode) throw new Error(`This browser cannot decode the ${info.videoCodec.toUpperCase()} video codec. Re-export locally as H.264 MP4 or try another browser.`);
  const input = new Input({ source: new BlobSource(file, { maxCacheSize: 8 * 1024 * 1024 }), formats: ALL_FORMATS });
  try {
    const video = await input.getPrimaryVideoTrack(), videos = await input.getVideoTracks(), audios = await input.getAudioTracks();
    if (!video) throw new Error("No readable video track. Choose another file.");
    if (videos.length !== 1 || audios.length > 1) throw new Error("Use a file with one video and at most one audio track. Mix multiple recorded streams in the studio first.");
    const stats = await video.computePacketStats(100);
    info.frameRate = Number.isFinite(stats.averageFrameRate) && stats.averageFrameRate > 0 ? stats.averageFrameRate : 30;
    const sink = new VideoSampleSink(video);
    for (const time of [0, Math.max(0, info.duration - 0.1)]) {
      const sample = await sink.getSample(time);
      if (!sample) throw new Error("The video picture could not be decoded. Re-export the file or try another browser.");
      sample.close();
    }
    if ((await input.getTracks()).length > videos.length + audios.length) info.notes.push("Subtitle and data tracks are not copied. Burn captions into the picture first if needed.");
    if (probe.video.hdr) info.notes.push("HDR is converted through the browser's standard-range pipeline; colours may change. Prefer an SDR source.");
    if (!info.audioDecodable) info.notes.push("The audio cannot be decoded here. Enable Mute explicitly, or use a browser that supports this audio.");
    if (probe.video.rotation) info.notes.push("Rotation is baked into output pixels. Check the upright preview before downloading.");
    return info;
  } finally { input.dispose(); }
}

export async function videoSupport(info: VideoInfo, settings: VideoSettings): Promise<VideoSupport> {
  const plan = videoPlan(info, settings);
  const result: VideoSupport = { mp4: null, webm: null };
  for (const container of ["mp4", "webm"] as const) {
    try {
      if (!await canEncodeVideo(codecs[container].video, { width: plan.width, height: plan.height, quality: new Quality({ bitrate: plan.videoBitrate }), frameRate: plan.frameRate, hardwareAcceleration: "no-preference" })) result[container] = `No ${container === "mp4" ? "H.264" : "VP9"} encoder at ${plan.width} × ${plan.height}. Try a smaller resolution or another format/browser.`;
      else if (plan.audioBitrate && (!info.audioDecodable || !await canEncodeAudio(codecs[container].audio, { numberOfChannels: 2, sampleRate: 48000, quality: new Quality({ bitrate: plan.audioBitrate }) }))) result[container] = "Audio cannot be preserved with this output here. Choose another format/browser or explicitly enable Mute.";
    } catch { result[container] = "The browser could not verify this encoder. Try a smaller resolution or another browser."; }
  }
  return result;
}

export async function compressVideo(file: File, settings: VideoSettings, progress: (value: number) => void, phase: (value: string) => void, signal?: AbortSignal): Promise<VideoResult> {
  const info = await inspectVideo(file), plan = videoPlan(info, settings);
  if (plan.estimatedBytes > VIDEO_LIMITS.outputBytes) throw new Error("The bitrate estimate exceeds the 128 MiB output budget. Lower resolution/quality or choose a smaller target.");
  const support = await videoSupport(info, settings);
  if (support[settings.container]) throw new Error(support[settings.container]!);
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const input = new Input({ source: new BlobSource(file, { maxCacheSize: 8 * 1024 * 1024 }), formats: ALL_FORMATS });
  const bytes = new BoundedVideoBytes();
  const target = new StreamTarget(new WritableStream({ write: chunk => bytes.write(chunk.data, chunk.position) }), { chunked: true, chunkSize: 1024 * 1024 });
  const output = new Output({ format: settings.container === "mp4" ? new Mp4OutputFormat({ fastStart: false }) : new WebMOutputFormat(), target });
  let conversion: Conversion | undefined;
  const cancel = () => { void conversion?.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    conversion = await Conversion.init({ input, output, tracks: "primary", copy: false, tags: {}, showWarnings: false,
      video: { codec: codecs[settings.container].video, width: plan.width, height: plan.height, fit: "contain", frameRate: plan.frameRate, allowTransformationMetadata: false, forceTranscode: true, quality: new Quality({ bitrate: plan.videoBitrate }), hardwareAcceleration: "no-preference", keyFrameInterval: 2 },
      audio: plan.audioBitrate ? { codec: codecs[settings.container].audio, quality: new Quality({ bitrate: plan.audioBitrate }), sampleRate: 48000, numberOfChannels: 2, forceTranscode: true } : { discard: true },
    });
    if (!conversion.isValid || !conversion.utilizedTracks.some(track => track.type === "video") || !!plan.audioBitrate !== conversion.utilizedTracks.some(track => track.type === "audio")) throw new Error("The browser could not preserve the requested video/audio tracks. Try another output format or explicitly mute audio.");
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    phase("Encoding video"); conversion.onProgress = fraction => progress(fraction);
    await conversion.execute();
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    phase("Validating the encoded file");
    const blob = bytes.blob(mime[settings.container]);
    if (!blob.size) throw new Error("The encoder produced no data. Try a smaller resolution or another format.");
    const encoded = await inspectVideo(blob, mime[settings.container], false);
    if (encoded.videoCodec !== codecs[settings.container].video || encoded.audioCodec !== (plan.audioBitrate ? codecs[settings.container].audio : null) || encoded.width !== plan.width || encoded.height !== plan.height || Math.abs(encoded.duration - info.duration) > 0.15) throw new Error("The output failed codec, dimensions or timing validation. No download was created. Try another output format or browser.");
    return { blob, info: encoded, container: settings.container, targetMet: !settings.targetBytes || blob.size <= settings.targetBytes, videoBitrate: plan.videoBitrate };
  } finally { signal?.removeEventListener("abort", cancel); await output.cancel().catch(() => {}); input.dispose(); bytes.clear(); }
}

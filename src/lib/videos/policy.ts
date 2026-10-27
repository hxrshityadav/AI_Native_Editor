import { assertVideoDuration } from "../media/duration";
export const VIDEO_LIMITS = { inputBytes: 512 * 1024 * 1024, outputBytes: 128 * 1024 * 1024, longEdge: 3840, pixels: 3840 * 2160, frameRate: 30 } as const;
export type VideoResolution = "original" | "1080" | "720" | "480" | "360";
export type VideoQuality = "high" | "balanced" | "small";
export type VideoContainer = "mp4" | "webm";
export type VideoSettings = { resolution: VideoResolution; quality: VideoQuality; bitrateKbps?: number; targetBytes?: number; mute: boolean; container: VideoContainer };
export type VideoSource = { width: number; height: number; duration: number; frameRate: number; hasAudio: boolean; audioDecodable: boolean };
export type VideoPlan = { width: number; height: number; frameRate: number; videoBitrate: number; audioBitrate: number; estimatedBytes: number; targetWithinBudget: boolean };

export function validateVideoFile(file: { size: number; type: string }): void {
  if (!file.size || file.size > VIDEO_LIMITS.inputBytes) throw new Error("Choose a non-empty video up to 512 MiB. Export a smaller copy and try again.");
  if (file.type && !["video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "application/octet-stream"].includes(file.type)) throw new Error("Choose an MP4, MOV or WebM video. This file type is unsupported.");
}
export function videoSignature(bytes: Uint8Array): "bmff" | "webm" {
  const box = String.fromCharCode(...bytes.subarray(4, 8));
  if (bytes.length >= 12 && ["ftyp", "moov", "mdat", "wide", "free"].includes(box)) return "bmff";
  if (bytes.length >= 4 && [0x1a, 0x45, 0xdf, 0xa3].every((value, i) => bytes[i] === value)) return "webm";
  throw new Error("The contents are not a supported MP4, MOV or WebM container. Choose the original video or re-export it.");
}
export function validateVideoSource(source: VideoSource): void {
  assertVideoDuration(source.duration);
  if (![source.width, source.height].every(value => Number.isInteger(value) && value >= 2 && value <= VIDEO_LIMITS.longEdge) || source.width * source.height > VIDEO_LIMITS.pixels) throw new Error("Use video up to 4K (3840 px on the longest side and 8.3 megapixels). Export a smaller copy first.");
}
export function videoPlan(source: VideoSource, settings: VideoSettings): VideoPlan {
  validateVideoSource(source);
  if (!["original", "1080", "720", "480", "360"].includes(settings.resolution) || !["high", "balanced", "small"].includes(settings.quality) || !["mp4", "webm"].includes(settings.container)) throw new Error("Choose a supported resolution, quality and output format.");
  const edge = { original: Math.max(source.width, source.height), "1080": 1920, "720": 1280, "480": 854, "360": 640 }[settings.resolution];
  const scale = Math.min(1, edge / Math.max(source.width, source.height));
  const width = Math.max(2, Math.floor(source.width * scale / 2) * 2), height = Math.max(2, Math.floor(source.height * scale / 2) * 2);
  const frameRate = Math.min(VIDEO_LIMITS.frameRate, Math.max(1, Number.isFinite(source.frameRate) ? source.frameRate : 30));
  const audioBitrate = source.hasAudio && !settings.mute ? 128000 : 0;
  const defaultRate = Math.max(100000, Math.round(width * height * frameRate * { high: 0.12, balanced: 0.075, small: 0.04 }[settings.quality]));
  if (settings.bitrateKbps !== undefined && (!Number.isFinite(settings.bitrateKbps) || settings.bitrateKbps < 100 || settings.bitrateKbps > 50000)) throw new Error("Enter a video bitrate from 100 to 50,000 kbps, or leave it empty.");
  if (settings.targetBytes !== undefined && (!Number.isFinite(settings.targetBytes) || settings.targetBytes < 1 || settings.targetBytes > VIDEO_LIMITS.outputBytes)) throw new Error("Enter a positive target up to 128 MiB, or leave it empty.");
  let videoBitrate = settings.bitrateKbps !== undefined ? Math.round(settings.bitrateKbps * 1000) : defaultRate;
  if (settings.targetBytes) videoBitrate = Math.max(100000, Math.min(videoBitrate, Math.floor(settings.targetBytes * 8 / source.duration / 1.04 - audioBitrate)));
  const estimatedBytes = Math.ceil((videoBitrate + audioBitrate) / 8 * source.duration * 1.04);
  return { width, height, frameRate, videoBitrate, audioBitrate, estimatedBytes, targetWithinBudget: !settings.targetBytes || estimatedBytes <= settings.targetBytes };
}
export function videoOutputName(name: string, container: VideoContainer): string {
  return `${name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0,100) || "video"}-compressed.${container}`;
}

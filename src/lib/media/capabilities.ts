import { canEncodeAudio, canEncodeVideo, Quality } from "mediabunny";
import { SPEECH_AUDIO } from "./extractAudio";

export type DeviceReport = {
  webCodecs: boolean;
  offscreenCanvas: boolean;
  canEncodeH264: boolean;
  canEncodeOpus: boolean;
  deviceMemoryGb: number | null;
  cpuCores: number | null;
  blockers: string[];
  warnings: string[];
};

/**
 * Checks whether this browser can run the local pipeline for a video of the
 * given display size. Every blocker is phrased with a recovery action.
 */
export async function checkDevice(size: { width: number; height: number }): Promise<DeviceReport> {
  const webCodecs = typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined";
  const offscreenCanvas = typeof OffscreenCanvas !== "undefined";
  const nav = navigator as Navigator & { deviceMemory?: number };

  const [canEncodeH264, canEncodeOpus] = webCodecs
    ? await Promise.all([
        canEncodeVideo("avc", { width: even(size.width), height: even(size.height) }).catch(() => false),
        canEncodeAudio(SPEECH_AUDIO.codec, {
          numberOfChannels: SPEECH_AUDIO.channels,
          sampleRate: SPEECH_AUDIO.sampleRate,
          quality: new Quality({ bitrate: SPEECH_AUDIO.bitrate }),
        }).catch(() => false),
      ])
    : [false, false];

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!webCodecs) blockers.push("This browser has no WebCodecs support. Use the latest Chrome, Edge or Samsung Internet.");
  if (!offscreenCanvas) blockers.push("This browser has no OffscreenCanvas support. Update your browser and try again.");
  if (webCodecs && !canEncodeH264)
    blockers.push(`This device can't encode H.264 at ${size.width}×${size.height}. Try a 1080p version of the video.`);
  if (webCodecs && !canEncodeOpus)
    blockers.push("This browser can't encode Opus audio for transcription. Use the latest Chrome or Edge.");

  const deviceMemoryGb = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
  if (deviceMemoryGb !== null && deviceMemoryGb < 4)
    warnings.push("This device reports less than 4 GB of memory. Long or 4K videos may fail; close other apps first.");

  return {
    webCodecs,
    offscreenCanvas,
    canEncodeH264,
    canEncodeOpus,
    deviceMemoryGb,
    cpuCores: navigator.hardwareConcurrency || null,
    blockers,
    warnings,
  };
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

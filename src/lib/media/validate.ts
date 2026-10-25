import type { Issue, IssueCode, ProbeResult, ValidationResult } from "./types";

export const LIMITS = {
  maxBytes: 1024 * 1024 * 1024,
  minDurationSec: 1,
  /** Reels and Shorts both cap at 3 minutes; allow a little slack for container rounding. */
  maxDurationSec: 181,
  /** Longest edge. Above 4K, phone encoders commonly refuse to configure. */
  maxLongEdge: 3840,
} as const;

const MESSAGES: Record<IssueCode, Omit<Issue, "code">> = {
  FILE_EMPTY: {
    reason: "This file is empty.",
    action: "Pick the original video again. If it came from a chat app, save it to your device first.",
  },
  FILE_TOO_LARGE: {
    reason: "This file is larger than 1 GB.",
    action: "Trim it to under 3 minutes or export it at 1080p from your camera or editor, then try again.",
  },
  UNSUPPORTED_FORMAT: {
    reason: "We couldn't read this file as a video.",
    action: "Use an MP4, MOV or WebM file. If it is a screen recording or download, re-save it as MP4.",
  },
  NO_VIDEO_TRACK: {
    reason: "This file has no video picture, only audio.",
    action: "Pick the video file itself, not an audio export.",
  },
  VIDEO_UNDECODABLE: {
    reason: "This browser can't decode the video codec in this file.",
    action: "Try Chrome or Edge, or re-export the video as H.264 MP4.",
  },
  HEVC_UNDECODABLE: {
    reason: "This video is in HEVC (H.265), which this browser can't decode on this device.",
    action:
      "Record in H.264 instead: in your camera settings, turn off \"High efficiency video\" (Samsung) or set the video codec to H.264 (Pixel and others). Or re-export the clip as H.264 MP4.",
  },
  NO_AUDIO_TRACK: {
    reason: "This video has no sound, so there is no speech to caption.",
    action: "Pick a version of the video with its original audio.",
  },
  AUDIO_UNDECODABLE: {
    reason: "This browser can't decode the audio in this file.",
    action: "Re-export the video with AAC audio, or try Chrome or Edge.",
  },
  TOO_SHORT: {
    reason: "This video is shorter than 1 second.",
    action: "Pick a longer clip.",
  },
  TOO_LONG: {
    reason: "This video is longer than 3 minutes, the limit for Reels and Shorts.",
    action: "Trim it to 3 minutes or less in your gallery or editor, then try again.",
  },
  RESOLUTION_TOO_HIGH: {
    reason: "This video is larger than 4K, which most devices can't re-encode.",
    action: "Export it at 1080p or 4K and try again.",
  },
  HDR_VIDEO: {
    reason: "This is an HDR video. The export is standard-range, so colours may look washed out or dull.",
    action: "If the colours look wrong, record with HDR turned off in your camera settings, then try again.",
  },
  NOT_VERTICAL: {
    reason: "This video is not vertical. Reels and Shorts look best at 9:16.",
    action: "You can continue. When you export, choose Fill (crop to 9:16), Fit (bars above and below) or Original size.",
  },
};

export function issue(code: IssueCode): Issue {
  return { code, ...MESSAGES[code] };
}

/** Rejects files that are obviously unusable before any parsing. */
export function validateFileBasics(file: { size: number }): ValidationResult {
  if (file.size === 0) return { ok: false, error: issue("FILE_EMPTY"), warnings: [] };
  if (file.size > LIMITS.maxBytes) return { ok: false, error: issue("FILE_TOO_LARGE"), warnings: [] };
  return { ok: true, warnings: [] };
}

export function validateProbe(probe: ProbeResult): ValidationResult {
  const basics = validateFileBasics({ size: probe.fileSizeBytes });
  if (!basics.ok) return basics;

  const warnings: Issue[] = [];
  const fail = (code: IssueCode): ValidationResult => ({ ok: false, error: issue(code), warnings });

  if (!probe.video) return fail("NO_VIDEO_TRACK");
  if (!probe.video.canDecode) return fail(probe.video.codec === "hevc" ? "HEVC_UNDECODABLE" : "VIDEO_UNDECODABLE");
  if (!probe.audio) return fail("NO_AUDIO_TRACK");
  if (!probe.audio.canDecode) return fail("AUDIO_UNDECODABLE");
  if (probe.durationSec < LIMITS.minDurationSec) return fail("TOO_SHORT");
  if (probe.durationSec > LIMITS.maxDurationSec) return fail("TOO_LONG");
  if (Math.max(probe.video.width, probe.video.height) > LIMITS.maxLongEdge) return fail("RESOLUTION_TOO_HIGH");

  if (probe.video.height <= probe.video.width) warnings.push(issue("NOT_VERTICAL"));
  if (probe.video.hdr) warnings.push(issue("HDR_VIDEO"));
  return { ok: true, warnings };
}

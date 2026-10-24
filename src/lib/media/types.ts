export type ProbeResult = {
  fileSizeBytes: number;
  /** Full MIME type including codecs, e.g. video/mp4; codecs="avc1.64001f, mp4a.40.2". */
  mimeType: string;
  durationSec: number;
  video: {
    codec: string | null;
    /** Display dimensions, after rotation. */
    width: number;
    height: number;
    rotation: number;
    canDecode: boolean;
  } | null;
  audio: {
    codec: string | null;
    channels: number;
    sampleRate: number;
    canDecode: boolean;
  } | null;
};

export type IssueCode =
  | "FILE_EMPTY"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FORMAT"
  | "NO_VIDEO_TRACK"
  | "VIDEO_UNDECODABLE"
  | "NO_AUDIO_TRACK"
  | "AUDIO_UNDECODABLE"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "RESOLUTION_TOO_HIGH"
  | "NOT_VERTICAL";

/** Every rejection carries a human reason and a concrete recovery action. */
export type Issue = { code: IssueCode; reason: string; action: string };

export type ValidationResult =
  | { ok: true; warnings: Issue[] }
  | { ok: false; error: Issue; warnings: Issue[] };

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
    /** HDR transfer (PQ/HLG). Converting to an SDR H.264 export can wash out colours. */
    hdr: boolean;
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
  | "HEVC_UNDECODABLE"
  | "NO_AUDIO_TRACK"
  | "AUDIO_UNDECODABLE"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "RESOLUTION_TOO_HIGH"
  | "NOT_VERTICAL"
  | "HDR_VIDEO";

/** Every rejection carries a human reason and a concrete recovery action. */
export type Issue = { code: IssueCode; reason: string; action: string };

export type ValidationResult =
  | { ok: true; warnings: Issue[] }
  | { ok: false; error: Issue; warnings: Issue[] };

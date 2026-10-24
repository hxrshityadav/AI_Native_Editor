import type { Word } from "@/lib/captions/types";

export const TRANSCRIPTION_LANGUAGES = ["auto", "hi", "en"] as const;
export type TranscriptionLanguage = (typeof TRANSCRIPTION_LANGUAGES)[number];

export type TranscribeInput = {
  /** Audio-only Ogg Opus, already validated by the route. */
  audio: Blob;
  language: TranscriptionLanguage;
  signal?: AbortSignal;
};

export interface TranscriptionProvider {
  readonly id: string;
  readonly displayName: string;
  transcribe(input: TranscribeInput): Promise<Word[]>;
}

export type ProviderErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_REJECTED"
  | "PROVIDER_BAD_RESPONSE"
  | "PROVIDER_TIMEOUT";

/** Provider failures. Messages must never contain audio or transcript content. */
export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** The JSON body of a successful POST /api/transcribe. */
export type TranscribeResponse = {
  provider: { id: string; displayName: string };
  words: Word[];
};

/** The JSON body of a failed POST /api/transcribe. */
export type TranscribeErrorResponse = {
  error: { code: string; message: string; action: string };
};

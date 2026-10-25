import type { Word } from "@/lib/captions/types";

/**
 * What the user picks: the language and script the captions come out in.
 * "hinglish" is Hindi/English speech written in Roman script, as creators write it.
 */
export const CAPTION_LANGUAGES = ["hinglish", "hi", "en"] as const;
export type CaptionLanguage = (typeof CAPTION_LANGUAGES)[number];

/** What the speech model is asked for. */
export type SpeechLanguage = "auto" | "hi" | "en";

export type TranscribeInput = {
  /** Audio-only Ogg Opus, already validated by the route. */
  audio: Blob;
  language: SpeechLanguage;
  /** Captions are wanted in Roman script; a provider that can output it directly should. */
  preferRoman?: boolean;
  signal?: AbortSignal;
};

export interface TranscriptionProvider {
  readonly id: string;
  readonly displayName: string;
  /** Who receives the audio, for the disclosure shown before upload. */
  readonly privacy: { name: string; url: string };
  /** Longest audio the provider accepts, if it has a limit. */
  readonly maxSeconds?: number;
  transcribe(input: TranscribeInput): Promise<Word[]>;
}

/** Rewrites words into Roman script, one output per input, same order. */
export interface Romanizer {
  romanize(words: string[], signal?: AbortSignal): Promise<string[]>;
}

export type ProviderErrorCode =
  | "PROVIDER_AUTH_FAILED"
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
  /** Set when the result is usable but not what was asked for (e.g. Hinglish fell back to Hindi script). */
  warning: { message: string; action: string } | null;
};

/** The JSON body of a failed POST /api/transcribe. */
export type TranscribeErrorResponse = {
  error: { code: string; message: string; action: string };
};

/** Request header carrying the Turnstile token, so it is checked before the audio body is read. */
export const HUMAN_CHECK_HEADER = "x-turnstile-token";

/** The JSON body of GET /api/transcribe: what the browser needs before it can transcribe. */
export type TranscribeConfigResponse = {
  setupError?: string | null;
  /** Turnstile site key when the server checks for bots; null when it doesn't. */
  humanCheckSiteKey: string | null;
  /** Where the speech audio goes (null when transcription isn't configured). */
  provider: { name: string; privacyUrl: string } | null;
  /** Who romanizes Hindi-script words for Hinglish, if anyone. */
  romanizerName: string | null;
};

import { z } from "zod";
import { getClientIp, hashClientKey, type RateLimiter } from "./rateLimit";
import { hasDevanagari } from "./groqRomanize";
import type { HumanVerifier } from "./humanCheck";
import { isAudioOnlyOggOpus, oggOpusDurationSec } from "./sniff";
import {
  ProviderError,
  CAPTION_LANGUAGES,
  HUMAN_CHECK_HEADER,
  type CaptionLanguage,
  type Romanizer,
  type SpeechLanguage,
  type TranscribeErrorResponse,
  type TranscribeResponse,
  type TranscriptionProvider,
} from "./types";

/**
 * Vercel caps function request bodies at 4.5 MB, so an app cap above that never
 * applies. 3 minutes of 32 kbps mono Opus is ~0.7 MB.
 */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export const transcribeFormSchema = z.object({
  audio: z.instanceof(Blob, { message: "audio must be a file" }),
  language: z.enum(CAPTION_LANGUAGES).default("hinglish"),
});

type ErrorSpec = { status: number; message: string; action: string };

const ERRORS = {
  UNSUPPORTED_REQUEST: {
    status: 415,
    message: "Expected a multipart/form-data upload.",
    action: "Send the audio as a form field named 'audio'.",
  },
  INVALID_REQUEST: {
    status: 400,
    message: "The upload is missing the audio file or has an invalid language.",
    action: "Re-extract the audio and try again.",
  },
  AUDIO_EMPTY: { status: 400, message: "The audio file is empty.", action: "Re-extract the audio and try again." },
  AUDIO_TOO_LARGE: {
    status: 413,
    message: "The audio is larger than 4 MB.",
    action: "Use a clip of 3 minutes or less.",
  },
  UNSUPPORTED_AUDIO: {
    status: 415,
    message: "Only audio-only Ogg Opus is accepted.",
    action: "Use the app's audio extraction step; don't upload other files.",
  },
  AUDIO_TOO_LONG_FOR_PROVIDER: {
    status: 413,
    message: "The transcription service on this server takes shorter clips.",
    action: "Use a shorter clip.",
  },
  RATE_LIMITED: {
    status: 429,
    message: "Too many transcriptions from this network.",
    action: "Wait a few minutes and try again.",
  },
  HUMAN_CHECK_REQUIRED: {
    status: 403,
    message: "The anti-bot check hasn't finished.",
    action: "Wait for the check next to the button to finish, then try again.",
  },
  HUMAN_CHECK_FAILED: {
    status: 403,
    message: "The anti-bot check didn't pass or has expired.",
    action: "Try again. The check reloads by itself.",
  },
  HUMAN_CHECK_UNAVAILABLE: {
    status: 503,
    message: "The anti-bot check couldn't be completed on our side.",
    action: "Try again in a minute.",
  },
  RATE_LIMIT_UNAVAILABLE: {
    status: 503,
    message: "Usage limits couldn't be checked, so transcription is paused.",
    action: "Try again in a minute.",
  },
  ABUSE_CONTROLS_MISSING: {
    status: 503,
    message: "Transcription is off on this deployment until abuse protection is set up.",
    action: "Set DATABASE_URL, TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, then redeploy.",
  },
  NOT_CONFIGURED: {
    status: 503,
    message: "Transcription is not configured on this server.",
    action: "Set the transcription provider's API key (see .env.example) and restart the server.",
  },
  PROVIDER_UNAVAILABLE: {
    status: 502,
    message: "The transcription provider is unavailable.",
    action: "Try again in a minute.",
  },
  PROVIDER_RATE_LIMITED: {
    status: 503,
    message: "The transcription provider is busy.",
    action: "Try again in a minute.",
  },
  PROVIDER_REJECTED: {
    status: 422,
    message: "The transcription provider could not process this audio.",
    action: "Check the clip has clear speech and try again.",
  },
  PROVIDER_BAD_RESPONSE: {
    status: 502,
    message: "The transcription provider returned an unexpected response.",
    action: "Try again. If it keeps happening, report it.",
  },
  PROVIDER_TIMEOUT: {
    status: 504,
    message: "Transcription took too long.",
    action: "Try again, or use a shorter clip.",
  },
  INTERNAL: { status: 500, message: "Something went wrong while transcribing.", action: "Try again." },
} satisfies Record<string, ErrorSpec>;

export type TranscribeErrorCode = keyof typeof ERRORS;

/** Hinglish is transcribed as Hindi (Whisper's most accurate mode for this speech), then romanized. */
const SPEECH_LANGUAGE: Record<CaptionLanguage, SpeechLanguage> = { hinglish: "hi", hi: "hi", en: "en" };

const ROMANIZE_WARNING = {
  message: "Couldn't convert the captions to Roman script, so they are in Hindi script.",
  action: "Transcribe again to retry, or fix the words in the editor.",
};

export type TranscribeHandlerDeps = {
  getProvider: () => TranscriptionProvider | null;
  /** Needed for Hinglish; without it Hinglish falls back to Hindi script with a warning. */
  getRomanizer?: () => Romanizer | null;
  limiter: RateLimiter;
  /** Turnstile check; when set, every request needs a token in the HUMAN_CHECK_HEADER. */
  humanCheck?: HumanVerifier | null;
  /** True on a public deployment without a shared limiter and bot check: refuse instead of risking spend. */
  abuseControlsMissing?: boolean;
  salt: string;
  now?: () => Date;
  /** Receives error codes only. Never pass audio, transcripts or file names here. */
  logError?: (code: TranscribeErrorCode | "ROMANIZE_FAILED") => void;
};

export function createTranscribeHandler(deps: TranscribeHandlerDeps) {
  const now = deps.now ?? (() => new Date());
  const logError = deps.logError ?? ((code) => console.warn(`[transcribe] ${code}`));

  const fail = (code: TranscribeErrorCode, headers?: HeadersInit, action?: string): Response => {
    const spec: ErrorSpec = ERRORS[code];
    if (spec.status >= 500) logError(code);
    const body: TranscribeErrorResponse = { error: { code, message: spec.message, action: action ?? spec.action } };
    return Response.json(body, { status: spec.status, headers: { "Cache-Control": "no-store", ...headers } });
  };

  return async function POST(request: Request): Promise<Response> {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
      return fail("UNSUPPORTED_REQUEST");
    }
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_AUDIO_BYTES + MULTIPART_OVERHEAD_BYTES) {
      return fail("AUDIO_TOO_LARGE");
    }

    const provider = deps.getProvider();
    if (!provider) return fail("NOT_CONFIGURED");
    if (deps.abuseControlsMissing) return fail("ABUSE_CONTROLS_MISSING");

    // A missing token costs nothing; only requests that carry one count against the limit.
    const token = request.headers.get(HUMAN_CHECK_HEADER);
    if (deps.humanCheck && !token) return fail("HUMAN_CHECK_REQUIRED");

    const key = hashClientKey(getClientIp(request.headers), deps.salt, now());
    let limit;
    try {
      limit = await deps.limiter.consume(key);
    } catch {
      return fail("RATE_LIMIT_UNAVAILABLE");
    }
    if (!limit.allowed) return fail("RATE_LIMITED", { "Retry-After": String(limit.retryAfterSec) });

    if (deps.humanCheck && token) {
      const check = await deps.humanCheck.verify(token, request.signal);
      if (check === "failed") return fail("HUMAN_CHECK_FAILED");
      if (check === "unavailable") return fail("HUMAN_CHECK_UNAVAILABLE");
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail("INVALID_REQUEST");
    }
    const parsed = transcribeFormSchema.safeParse({
      audio: form.get("audio") ?? undefined,
      language: form.get("language") ?? undefined,
    });
    if (!parsed.success) return fail("INVALID_REQUEST");
    const { audio, language } = parsed.data;

    if (audio.size === 0) return fail("AUDIO_EMPTY");
    if (audio.size > MAX_AUDIO_BYTES) return fail("AUDIO_TOO_LARGE");

    // Sniff the real bytes; the client-declared type is ignored.
    const bytes = new Uint8Array(await audio.arrayBuffer());
    if (!isAudioOnlyOggOpus(bytes)) return fail("UNSUPPORTED_AUDIO");
    if (provider.maxSeconds !== undefined) {
      const seconds = oggOpusDurationSec(bytes);
      if (seconds !== null && seconds > provider.maxSeconds + 0.5) {
        return fail("AUDIO_TOO_LONG_FOR_PROVIDER", undefined, `Use a clip of ${provider.maxSeconds} seconds or less.`);
      }
    }

    try {
      // The audio exists only in memory for the duration of this request.
      let words = await provider.transcribe({
        audio: new Blob([bytes], { type: "audio/ogg" }),
        language: SPEECH_LANGUAGE[language],
        preferRoman: language === "hinglish",
        signal: request.signal,
      });
      let warning: TranscribeResponse["warning"] = null;
      if (language === "hinglish" && words.some((w) => hasDevanagari(w.text))) {
        // Only the words go to the romanizer; timings stay as transcribed.
        try {
          const romanizer = deps.getRomanizer?.();
          if (!romanizer) throw new Error("no romanizer configured");
          const texts = await romanizer.romanize(
            words.map((w) => w.text),
            request.signal,
          );
          words = words.map((w, i) => ({ ...w, text: texts[i] }));
        } catch {
          logError("ROMANIZE_FAILED");
          warning = ROMANIZE_WARNING;
        }
      }
      const body: TranscribeResponse = {
        provider: { id: provider.id, displayName: provider.displayName },
        words,
        warning,
      };
      return Response.json(body, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      if (err instanceof ProviderError) return fail(err.code);
      return fail("INTERNAL");
    }
  };
}

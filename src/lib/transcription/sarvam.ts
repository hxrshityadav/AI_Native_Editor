import { z } from "zod";
import type { Word } from "@/lib/captions/types";
import { ProviderError, type SpeechLanguage, type TranscriptionProvider } from "./types";

// Checked 2026-10-25: https://docs.sarvam.ai/api-reference/speech-to-text/transcribe
const SARVAM_URL = "https://api.sarvam.ai/speech-to-text";
/** `mode` (translit for Roman script) is documented as applying to saaras:v3 only. */
export const SARVAM_DEFAULT_MODEL = "saaras:v3";
/** The REST endpoint is for audio under 30 s; longer audio needs Sarvam's batch API. */
export const SARVAM_MAX_SECONDS = 30;
const TIMEOUT_MS = 60_000;

const LANGUAGE_CODE: Record<SpeechLanguage, string> = { auto: "unknown", hi: "hi-IN", en: "en-IN" };

/** Sarvam's timestamps are per chunk (phrase), not per word: `words` holds phrases. */
export const sarvamResponseSchema = z.object({
  transcript: z.string(),
  timestamps: z
    .object({
      words: z.array(z.string()),
      start_time_seconds: z.array(z.number()),
      end_time_seconds: z.array(z.number()),
    })
    .nullish(),
});
export type SarvamResponse = z.infer<typeof sarvamResponseSchema>;

/**
 * Splits each timed phrase into words and estimates word times by sharing the phrase's span in
 * proportion to each word's length. Phrase starts and ends are Sarvam's; word times inside are not.
 */
export function estimateWordTimings(response: SarvamResponse): Word[] {
  const ts = response.timestamps;
  if (!ts) {
    if (response.transcript.trim()) throw new ProviderError("PROVIDER_BAD_RESPONSE", "Sarvam returned no timestamps.");
    return [];
  }
  const words: Word[] = [];
  ts.words.forEach((phrase, i) => {
    const start = ts.start_time_seconds[i];
    const end = ts.end_time_seconds[i];
    const parts = phrase.split(/\s+/).filter(Boolean);
    if (!parts.length || !Number.isFinite(start) || !Number.isFinite(end)) return;
    const span = Math.max(0, end - start);
    const total = parts.reduce((n, p) => n + [...p].length, 0);
    let used = 0;
    for (const text of parts) {
      const wordStart = start + (span * used) / total;
      used += [...text].length;
      words.push({ text, start: roundMs(Math.max(0, wordStart)), end: roundMs(Math.max(0, start + (span * used) / total)) });
    }
  });
  return words.sort((a, b) => a.start - b.start);
}

function roundMs(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export type SarvamOptions = {
  apiKey: string;
  model?: string;
  fetch?: typeof fetch;
};

export function createSarvamProvider(options: SarvamOptions): TranscriptionProvider {
  const model = options.model ?? SARVAM_DEFAULT_MODEL;
  const doFetch = options.fetch ?? fetch;

  return {
    id: "sarvam",
    displayName: `Sarvam (${model})`,
    privacy: { name: "Sarvam AI", url: "https://www.sarvam.ai/privacy-policy" },
    maxSeconds: SARVAM_MAX_SECONDS,
    async transcribe({ audio, language, preferRoman, signal }) {
      const form = new FormData();
      form.append("file", audio, "speech.ogg");
      form.append("model", model);
      form.append("language_code", LANGUAGE_CODE[language]);
      // translit returns Roman script directly, so Hinglish needs no romanizing step.
      form.append("mode", preferRoman && language !== "en" ? "translit" : "transcribe");
      form.append("with_timestamps", "true");

      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      let res: Response;
      try {
        res = await doFetch(SARVAM_URL, {
          method: "POST",
          headers: { "api-subscription-key": options.apiKey },
          body: form,
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (err) {
        if (timeout.aborted) throw new ProviderError("PROVIDER_TIMEOUT", "Sarvam did not respond in time.");
        throw new ProviderError("PROVIDER_UNAVAILABLE", `Sarvam request failed: ${err instanceof Error ? err.name : "unknown"}`);
      }

      if (!res.ok) {
        // The body may echo request details; we read only the status.
        if (res.status === 429) throw new ProviderError("PROVIDER_RATE_LIMITED", "Sarvam rate limit or quota reached.");
        if (res.status === 401 || res.status === 403)
          throw new ProviderError("PROVIDER_AUTH_FAILED", "Sarvam rejected the server API key.");
        if (res.status >= 500) throw new ProviderError("PROVIDER_UNAVAILABLE", `Sarvam error ${res.status}.`);
        throw new ProviderError("PROVIDER_REJECTED", `Sarvam rejected the audio (${res.status}).`);
      }

      const parsed = sarvamResponseSchema.safeParse(await res.json().catch(() => null));
      if (!parsed.success) throw new ProviderError("PROVIDER_BAD_RESPONSE", "Sarvam response had an unexpected shape.");
      return estimateWordTimings(parsed.data);
    },
  };
}

import { z } from "zod";
import type { Word } from "@/lib/captions/types";
import { ProviderError, type TranscriptionProvider } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
export const GROQ_DEFAULT_MODEL = "whisper-large-v3";
const TIMEOUT_MS = 60_000;

/** The subset of Groq's verbose_json response we rely on. */
export const groqResponseSchema = z.object({
  words: z
    .array(z.object({ word: z.string(), start: z.number(), end: z.number() }))
    .optional(),
});
export type GroqResponse = z.infer<typeof groqResponseSchema>;

/**
 * Maps Groq word timestamps to our Word type: trims text, drops empty or
 * non-finite entries, repairs end < start, rounds to milliseconds and sorts.
 */
export function mapGroqWords(response: GroqResponse): Word[] {
  const words: Word[] = [];
  for (const w of response.words ?? []) {
    const text = w.word.trim();
    if (!text || !Number.isFinite(w.start) || !Number.isFinite(w.end)) continue;
    const start = roundMs(Math.max(0, w.start));
    const end = roundMs(Math.max(start, w.end));
    words.push({ text, start, end });
  }
  return words.sort((a, b) => a.start - b.start);
}

function roundMs(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export type GroqOptions = {
  apiKey: string;
  model?: string;
  fetch?: typeof fetch;
};

export function createGroqProvider(options: GroqOptions): TranscriptionProvider {
  const model = options.model ?? GROQ_DEFAULT_MODEL;
  const doFetch = options.fetch ?? fetch;

  return {
    id: "groq",
    displayName: `Groq (${model})`,
    privacy: { name: "Groq", url: "https://groq.com/privacy-policy/" },
    async transcribe({ audio, language, signal }) {
      const form = new FormData();
      form.append("file", audio, "speech.ogg");
      form.append("model", model);
      form.append("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "word");
      form.append("temperature", "0");
      if (language !== "auto") form.append("language", language);

      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      let res: Response;
      try {
        res = await doFetch(GROQ_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${options.apiKey}` },
          body: form,
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (err) {
        if (timeout.aborted) throw new ProviderError("PROVIDER_TIMEOUT", "Groq did not respond in time.");
        throw new ProviderError("PROVIDER_UNAVAILABLE", `Groq request failed: ${errorName(err)}`);
      }

      if (!res.ok) {
        // The body may echo request details; we read only the status.
        if (res.status === 429) throw new ProviderError("PROVIDER_RATE_LIMITED", "Groq rate limit reached.");
        if (res.status === 401 || res.status === 403)
          throw new ProviderError("PROVIDER_UNAVAILABLE", `Groq rejected the API key (${res.status}).`);
        if (res.status >= 500) throw new ProviderError("PROVIDER_UNAVAILABLE", `Groq error ${res.status}.`);
        throw new ProviderError("PROVIDER_REJECTED", `Groq rejected the audio (${res.status}).`);
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new ProviderError("PROVIDER_BAD_RESPONSE", "Groq returned invalid JSON.");
      }
      const parsed = groqResponseSchema.safeParse(json);
      if (!parsed.success) throw new ProviderError("PROVIDER_BAD_RESPONSE", "Groq response had an unexpected shape.");
      return mapGroqWords(parsed.data);
    },
  };
}

function errorName(err: unknown): string {
  return err instanceof Error ? err.name : "unknown";
}

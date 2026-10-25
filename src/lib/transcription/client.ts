import type { Word } from "@/lib/captions/types";
import { z } from "zod";
import {
  HUMAN_CHECK_HEADER,
  type CaptionLanguage,
  type TranscribeConfigResponse,
  type TranscribeErrorResponse,
  type TranscribeResponse,
} from "./types";

/** The bot check named in the disclosure. The provider itself comes from the server's config. */
export const TRANSCRIPTION_DISCLOSURE = {
  humanCheckName: "Cloudflare Turnstile",
  humanCheckPrivacyUrl: "https://www.cloudflare.com/turnstile-privacy-policy/",
} as const;

/** What the server needs before a transcription; null when the server can't be reached. */
export async function fetchTranscribeConfig(): Promise<TranscribeConfigResponse | null> {
  try {
    const res = await fetch("/api/transcribe", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as TranscribeConfigResponse;
    const ok =
      (typeof json.humanCheckSiteKey === "string" || json.humanCheckSiteKey === null) &&
      (json.provider === null || (typeof json.provider?.name === "string" && typeof json.provider.privacyUrl === "string"));
    return ok ? json : null;
  } catch {
    return null;
  }
}

export type TranscribeResult =
  | { ok: true; words: Word[]; providerName: string; warning: TranscribeResponse["warning"] }
  | { ok: false; code: string; message: string; action: string };

const responseSchema = z.object({
  provider: z.object({ displayName: z.string() }),
  words: z.array(z.object({ text: z.string(), start: z.number().nonnegative(), end: z.number().nonnegative() })
    .refine((word) => word.end >= word.start)),
  warning: z.object({ message: z.string(), action: z.string() }).nullish(),
});
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), action: z.string() }) });

export async function requestTranscription(
  audio: Blob,
  language: CaptionLanguage,
  signal?: AbortSignal,
  humanCheckToken?: string | null,
): Promise<TranscribeResult> {
  const form = new FormData();
  form.append("audio", audio, "speech.ogg");
  form.append("language", language);

  let res: Response;
  try {
    res = await fetch("/api/transcribe", {
      method: "POST",
      body: form,
      signal,
      headers: humanCheckToken ? { [HUMAN_CHECK_HEADER]: humanCheckToken } : undefined,
    });
  } catch {
    return {
      ok: false,
      code: "NETWORK",
      message: "Couldn't reach the server.",
      action: "Check your connection and try again.",
    };
  }

  const json = (await res.json().catch(() => null)) as TranscribeResponse | TranscribeErrorResponse | null;
  const parsed = responseSchema.safeParse(json);
  if (res.ok && parsed.success) {
    return { ok: true, words: parsed.data.words, providerName: parsed.data.provider.displayName, warning: parsed.data.warning ?? null };
  }
  const error = errorSchema.safeParse(json);
  if (error.success) return { ok: false, ...error.data.error };
  return {
    ok: false,
    code: `HTTP_${res.status}`,
    message: "The server returned an unexpected response.",
    action: "Try again.",
  };
}

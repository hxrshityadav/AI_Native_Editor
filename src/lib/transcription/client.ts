import type { Word } from "@/lib/captions/types";
import {
  HUMAN_CHECK_HEADER,
  type CaptionLanguage,
  type TranscribeConfigResponse,
  type TranscribeErrorResponse,
  type TranscribeResponse,
} from "./types";

/** Shown before any upload. Must stay accurate if the provider changes. */
export const TRANSCRIPTION_DISCLOSURE = {
  providerName: "Groq",
  privacyUrl: "https://groq.com/privacy-policy/",
  humanCheckName: "Cloudflare Turnstile",
  humanCheckPrivacyUrl: "https://www.cloudflare.com/turnstile-privacy-policy/",
} as const;

/** What the server needs before a transcription; null when the server can't be reached. */
export async function fetchTranscribeConfig(): Promise<TranscribeConfigResponse | null> {
  try {
    const res = await fetch("/api/transcribe", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as TranscribeConfigResponse;
    return typeof json.humanCheckSiteKey === "string" || json.humanCheckSiteKey === null ? json : null;
  } catch {
    return null;
  }
}

export type TranscribeResult =
  | { ok: true; words: Word[]; providerName: string; warning: TranscribeResponse["warning"] }
  | { ok: false; code: string; message: string; action: string };

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
  if (res.ok && json && "words" in json) {
    return { ok: true, words: json.words, providerName: json.provider.displayName, warning: json.warning ?? null };
  }
  if (json && "error" in json) return { ok: false, ...json.error };
  return {
    ok: false,
    code: `HTTP_${res.status}`,
    message: "The server returned an unexpected response.",
    action: "Try again.",
  };
}

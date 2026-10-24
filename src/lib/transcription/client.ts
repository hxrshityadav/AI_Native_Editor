import type { Word } from "@/lib/captions/types";
import type { TranscribeErrorResponse, TranscribeResponse, TranscriptionLanguage } from "./types";

/** Shown before any upload. Must stay accurate if the provider changes. */
export const TRANSCRIPTION_DISCLOSURE = {
  providerName: "Groq",
  privacyUrl: "https://groq.com/privacy-policy/",
} as const;

export type TranscribeResult =
  | { ok: true; words: Word[]; providerName: string }
  | { ok: false; code: string; message: string; action: string };

export async function requestTranscription(
  audio: Blob,
  language: TranscriptionLanguage,
  signal?: AbortSignal,
): Promise<TranscribeResult> {
  const form = new FormData();
  form.append("audio", audio, "speech.ogg");
  form.append("language", language);

  let res: Response;
  try {
    res = await fetch("/api/transcribe", { method: "POST", body: form, signal });
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
    return { ok: true, words: json.words, providerName: json.provider.displayName };
  }
  if (json && "error" in json) return { ok: false, ...json.error };
  return {
    ok: false,
    code: `HTTP_${res.status}`,
    message: "The server returned an unexpected response.",
    action: "Try again.",
  };
}

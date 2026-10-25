import { createGroqProvider } from "./groq";
import { createGroqRomanizer } from "./groqRomanize";
import { createTurnstileVerifier, type HumanVerifier } from "./humanCheck";
import type { Romanizer, TranscriptionProvider } from "./types";

/**
 * Returns the configured provider, or null when no key is set. Keys are read
 * from server environment variables only and never reach the client bundle.
 */
export function getConfiguredProvider(
  env: Record<string, string | undefined> = process.env,
): TranscriptionProvider | null {
  if (env.GROQ_API_KEY) return createGroqProvider({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL || undefined });
  return null;
}

/** Romanizer for Hinglish captions; uses the same Groq key. */
export function getConfiguredRomanizer(env: Record<string, string | undefined> = process.env): Romanizer | null {
  if (env.GROQ_API_KEY) {
    return createGroqRomanizer({ apiKey: env.GROQ_API_KEY, model: env.GROQ_ROMANIZE_MODEL || undefined });
  }
  return null;
}

/** Turnstile needs both keys; with only one set the check is off, so the widget never shows without enforcement. */
export function getConfiguredHumanCheck(
  env: Record<string, string | undefined> = process.env,
): { siteKey: string; verifier: HumanVerifier } | null {
  if (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) return null;
  return { siteKey: env.TURNSTILE_SITE_KEY, verifier: createTurnstileVerifier({ secret: env.TURNSTILE_SECRET_KEY }) };
}

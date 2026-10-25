import { createGroqProvider } from "./groq";
import { createGroqRomanizer } from "./groqRomanize";
import { createSarvamProvider } from "./sarvam";
import { createTurnstileVerifier, type HumanVerifier } from "./humanCheck";
import type { Romanizer, TranscriptionProvider } from "./types";

/** Safe to show in the browser: names and setup instructions, never environment values. */
export function getTranscriptionSetupError(env: Record<string, string | undefined> = process.env): string | null {
  const provider = env.TRANSCRIBE_PROVIDER?.trim() || "groq";
  if (provider !== "groq" && provider !== "sarvam") {
    return "Set TRANSCRIBE_PROVIDER to groq or sarvam in .env.local (project root), or in your hosting environment, then restart or redeploy.";
  }
  const key = provider === "groq" ? "GROQ_API_KEY" : "SARVAM_API_KEY";
  const value = env[key]?.trim();
  if (!value || /\s|^(?:your[-_]|replace[-_]|changeme|placeholder)/i.test(value)) {
    return `Set ${key} to a real API key in .env.local (project root), or in your hosting environment, then restart or redeploy. See .env.example.`;
  }
  if (provider === "sarvam" && env.SARVAM_TRAINING_OPT_OUT !== "confirmed") {
    return "Opt out of Sarvam training in your account, then set SARVAM_TRAINING_OPT_OUT=confirmed in .env.local or your hosting environment and restart or redeploy.";
  }
  return null;
}

/**
 * Returns the configured provider (TRANSCRIBE_PROVIDER: groq by default, or sarvam), or null when
 * it isn't fully configured. Keys are read from server environment variables only and never reach
 * the client bundle.
 *
 * Sarvam trains on API inputs unless the account opts out (privacy policy, checked 2026-10-25), so
 * it stays off until SARVAM_TRAINING_OPT_OUT=confirmed records that the opt-out is done.
 */
export function getConfiguredProvider(
  env: Record<string, string | undefined> = process.env,
): TranscriptionProvider | null {
  if (getTranscriptionSetupError(env)) return null;
  if (env.TRANSCRIBE_PROVIDER?.trim() === "sarvam") {
    if (!env.SARVAM_API_KEY || env.SARVAM_TRAINING_OPT_OUT !== "confirmed") return null;
    return createSarvamProvider({ apiKey: env.SARVAM_API_KEY.trim(), model: env.SARVAM_MODEL || undefined });
  }
  if (env.GROQ_API_KEY) return createGroqProvider({ apiKey: env.GROQ_API_KEY.trim(), model: env.GROQ_MODEL || undefined });
  return null;
}

/** Romanizer for Hinglish captions; uses the same Groq key. */
export function getConfiguredRomanizer(env: Record<string, string | undefined> = process.env): Romanizer | null {
  if (!getTranscriptionSetupError({ ...env, TRANSCRIBE_PROVIDER: "groq" }) && env.GROQ_API_KEY) {
    return createGroqRomanizer({ apiKey: env.GROQ_API_KEY.trim(), model: env.GROQ_ROMANIZE_MODEL || undefined });
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

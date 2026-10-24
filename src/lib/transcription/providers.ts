import { createGroqProvider } from "./groq";
import type { TranscriptionProvider } from "./types";

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

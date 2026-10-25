import { connection } from "next/server";
import { createTranscribeHandler } from "@/lib/transcription/handler";
import { createPostgresRateLimiter } from "@/lib/transcription/pgRateLimit";
import { getConfiguredHumanCheck, getConfiguredProvider, getConfiguredRomanizer, getTranscriptionSetupError } from "@/lib/transcription/providers";
import { createMemoryRateLimiter, getRateLimitSalt } from "@/lib/transcription/rateLimit";
import type { TranscribeConfigResponse } from "@/lib/transcription/types";

// 20 transcriptions per hour per network; each upload is limited to ten minutes.
const LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 };

// Shared across instances when DATABASE_URL is set; the in-memory limiter is for local development.
const limiter = process.env.DATABASE_URL
  ? createPostgresRateLimiter({ url: process.env.DATABASE_URL, ...LIMIT })
  : createMemoryRateLimiter(LIMIT);
const humanCheck = getConfiguredHumanCheck();
export const maxDuration = 180;

export const POST = createTranscribeHandler({
  getProvider: () => getConfiguredProvider(),
  getSetupError: () => getTranscriptionSetupError(),
  getRomanizer: () => getConfiguredRomanizer(),
  limiter,
  humanCheck: humanCheck?.verifier,
  // Any Vercel deployment (preview or production) is a public URL.
  abuseControlsMissing: Boolean(process.env.VERCEL) && (!process.env.DATABASE_URL || !humanCheck),
  salt: getRateLimitSalt(),
});

export async function GET() {
  await connection(); // read the environment per request, not once at build time
  const provider = getConfiguredProvider();
  const body: TranscribeConfigResponse = {
    setupError: getTranscriptionSetupError() ?? (Boolean(process.env.VERCEL) && (!process.env.DATABASE_URL || !humanCheck)
      ? "Set DATABASE_URL, TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY in your hosting environment, then redeploy."
      : null),
    humanCheckSiteKey: getConfiguredHumanCheck()?.siteKey ?? null,
    provider: provider && { name: provider.privacy.name, privacyUrl: provider.privacy.url },
    romanizerName: getConfiguredRomanizer() ? "Groq" : null,
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}

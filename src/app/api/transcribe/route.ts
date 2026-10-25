import { connection } from "next/server";
import { createTranscribeHandler } from "@/lib/transcription/handler";
import { createPostgresRateLimiter } from "@/lib/transcription/pgRateLimit";
import { getConfiguredHumanCheck, getConfiguredProvider, getConfiguredRomanizer } from "@/lib/transcription/providers";
import { createMemoryRateLimiter, getRateLimitSalt } from "@/lib/transcription/rateLimit";
import type { TranscribeConfigResponse } from "@/lib/transcription/types";

// 20 transcriptions per hour per network. At Groq's whisper-large-v3 list price
// ($0.111/hour of audio) that caps spend at about $0.11 per IP per hour.
const LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 };

// Shared across instances when DATABASE_URL is set; the in-memory limiter is for local development.
const limiter = process.env.DATABASE_URL
  ? createPostgresRateLimiter({ url: process.env.DATABASE_URL, ...LIMIT })
  : createMemoryRateLimiter(LIMIT);
const humanCheck = getConfiguredHumanCheck();

export const POST = createTranscribeHandler({
  getProvider: () => getConfiguredProvider(),
  getRomanizer: () => getConfiguredRomanizer(),
  limiter,
  humanCheck: humanCheck?.verifier,
  // Any Vercel deployment (preview or production) is a public URL.
  abuseControlsMissing: Boolean(process.env.VERCEL) && (!process.env.DATABASE_URL || !humanCheck),
  salt: getRateLimitSalt(),
});

export async function GET() {
  await connection(); // read the environment per request, not once at build time
  const body: TranscribeConfigResponse = { humanCheckSiteKey: getConfiguredHumanCheck()?.siteKey ?? null };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}

import { createTranscribeHandler } from "@/lib/transcription/handler";
import { getConfiguredProvider } from "@/lib/transcription/providers";
import { createMemoryRateLimiter, getRateLimitSalt } from "@/lib/transcription/rateLimit";

// 20 transcriptions per hour per network. At Groq's whisper-large-v3 list price
// ($0.111/hour of audio) that caps spend at about $0.11 per IP per hour.
const limiter = createMemoryRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 });

export const POST = createTranscribeHandler({
  getProvider: () => getConfiguredProvider(),
  limiter,
  salt: getRateLimitSalt(),
});

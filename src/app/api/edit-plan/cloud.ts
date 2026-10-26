import { connection } from "next/server";
import { createEditPlanHandler } from "@/lib/editor/aiPlan";
import { createMemoryRateLimiter, getRateLimitSalt } from "@/lib/transcription/rateLimit";
import { createPostgresRateLimiter } from "@/lib/transcription/pgRateLimit";
import { getConfiguredHumanCheck, getTranscriptionSetupError } from "@/lib/transcription/providers";
const limit = { limit: 20, windowMs: 3600000 };
const limiter = process.env.DATABASE_URL ? createPostgresRateLimiter({ url: process.env.DATABASE_URL, ...limit }) : createMemoryRateLimiter(limit);
function setupError() { return process.env.VERCEL && (!process.env.DATABASE_URL || !getConfiguredHumanCheck()) ? "Set DATABASE_URL and Turnstile keys before enabling AI editing on a public deployment." : getTranscriptionSetupError({ ...process.env, TRANSCRIBE_PROVIDER: "groq" }) ? "AI editing needs GROQ_API_KEY on the server. Manual editing is available." : null; }
export async function GET() { await connection(); return Response.json({ setupError: setupError(), provider: "Groq" }, { headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: Request) { return createEditPlanHandler({ apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_EDIT_MODEL, setupError: setupError(), limiter, salt: getRateLimitSalt(), humanCheck: getConfiguredHumanCheck()?.verifier })(request); }

import { createHash, randomBytes } from "node:crypto";

export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

export interface RateLimiter {
  consume(key: string): Promise<RateLimitResult>;
}

/**
 * Fixed-window limiter held in process memory. Good enough for local
 * development and a single instance; serverless instances do not share it,
 * so deployments use the Postgres limiter (pgRateLimit.ts).
 */
export function createMemoryRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const now = options.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();

  return {
    async consume(key) {
      const t = now();
      if (windows.size > 10_000) {
        for (const [k, w] of windows) if (t - w.start >= options.windowMs) windows.delete(k);
      }
      let w = windows.get(key);
      if (!w || t - w.start >= options.windowMs) {
        w = { start: t, count: 0 };
        windows.set(key, w);
      }
      if (w.count >= options.limit) {
        return { allowed: false, retryAfterSec: Math.ceil((w.start + options.windowMs - t) / 1000) };
      }
      w.count += 1;
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}

/** Best-effort client IP. Only trustworthy behind a proxy that sets these headers (e.g. Vercel). */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Salted hash of the IP that rotates daily, so raw IPs are never stored. */
export function hashClientKey(ip: string, salt: string, date: Date): string {
  const day = date.toISOString().slice(0, 10);
  return createHash("sha256").update(`${salt}:${day}:${ip}`).digest("hex");
}

let processSalt: string | null = null;

/** RATE_LIMIT_SALT in production; a random per-process salt in development. */
export function getRateLimitSalt(env: Record<string, string | undefined> = process.env): string {
  if (env.RATE_LIMIT_SALT) return env.RATE_LIMIT_SALT;
  processSalt ??= randomBytes(16).toString("hex");
  return processSalt;
}

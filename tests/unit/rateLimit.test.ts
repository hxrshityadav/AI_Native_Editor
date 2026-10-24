import { describe, expect, it } from "vitest";
import { createMemoryRateLimiter, getClientIp, hashClientKey } from "@/lib/transcription/rateLimit";

describe("createMemoryRateLimiter", () => {
  it("allows up to the limit per window, then resets", async () => {
    let t = 0;
    const limiter = createMemoryRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    expect((await limiter.consume("k")).allowed).toBe(true);
    expect((await limiter.consume("k")).allowed).toBe(true);
    t = 400;
    expect(await limiter.consume("k")).toEqual({ allowed: false, retryAfterSec: 1 });
    t = 1000;
    expect((await limiter.consume("k")).allowed).toBe(true);
  });
});

describe("client key", () => {
  it("takes the first X-Forwarded-For address", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(getClientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(getClientIp(new Headers())).toBe("unknown");
  });

  it("hashes with salt and rotates daily without exposing the IP", () => {
    const day1 = hashClientKey("1.2.3.4", "s", new Date("2026-10-24T10:00:00Z"));
    expect(day1).toMatch(/^[0-9a-f]{64}$/);
    expect(day1).not.toContain("1.2.3.4");
    expect(hashClientKey("1.2.3.4", "s", new Date("2026-10-24T23:00:00Z"))).toBe(day1);
    expect(hashClientKey("1.2.3.4", "s", new Date("2026-10-25T00:00:00Z"))).not.toBe(day1);
    expect(hashClientKey("1.2.3.4", "other", new Date("2026-10-24T10:00:00Z"))).not.toBe(day1);
  });
});

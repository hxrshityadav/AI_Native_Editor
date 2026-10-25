import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresRateLimiter } from "@/lib/transcription/pgRateLimit";

// Runs against a real database: TEST_DATABASE_URL=postgres://... npm test. Skipped without one.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("Postgres rate limiter", () => {
  const admin = postgres(url ?? "", { onnotice: () => {} });
  let clock = 0;
  const limiters: { close(): Promise<void> }[] = [];
  const make = (limit = 3) => {
    const l = createPostgresRateLimiter({ url: url!, limit, windowMs: 60_000, now: () => clock });
    limiters.push(l);
    return l;
  };

  beforeAll(async () => {
    await admin`drop table if exists rate_limit_hits`;
  });
  afterAll(async () => {
    await Promise.all(limiters.map((l) => l.close()));
    await admin.end();
  });

  it("creates its table, allows up to the limit, then refuses with Retry-After", async () => {
    clock = 10 * 60_000 + 15_000;
    const limiter = make();
    for (let i = 0; i < 3; i++) expect((await limiter.consume("a")).allowed).toBe(true);
    expect(await limiter.consume("a")).toEqual({ allowed: false, retryAfterSec: 45 });
  });

  it("counts each key separately", async () => {
    expect((await make().consume("b")).allowed).toBe(true);
  });

  it("is shared between instances, as serverless functions are", async () => {
    clock = 20 * 60_000;
    const [one, two] = [make(), make()];
    await one.consume("shared");
    await two.consume("shared");
    await one.consume("shared");
    expect((await two.consume("shared")).allowed).toBe(false);
  });

  it("never lets concurrent requests exceed the limit", async () => {
    clock = 30 * 60_000;
    const limiter = make(20);
    const results = await Promise.all(Array.from({ length: 60 }, () => limiter.consume("burst")));
    expect(results.filter((r) => r.allowed)).toHaveLength(20);
  });

  it("starts a fresh window and deletes the key's old rows", async () => {
    clock = 40 * 60_000;
    const limiter = make(1);
    await limiter.consume("roll");
    expect((await limiter.consume("roll")).allowed).toBe(false);
    clock += 60_000;
    expect((await limiter.consume("roll")).allowed).toBe(true);
    const rows = await admin`select window_start from rate_limit_hits where key = 'roll'`;
    expect(rows.map((r) => Number(r.window_start))).toEqual([clock]);
  });

  it("throws when the database is unreachable, so the handler can refuse", async () => {
    const down = createPostgresRateLimiter({ url: "postgres://nobody@127.0.0.1:1/none", limit: 1, windowMs: 1000 });
    limiters.push(down);
    await expect(down.consume("x")).rejects.toThrow();
  });
});

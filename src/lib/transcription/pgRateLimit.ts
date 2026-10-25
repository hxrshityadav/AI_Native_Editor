import postgres from "postgres";
import type { RateLimiter } from "./rateLimit";

const TABLE = "rate_limit_hits";

/**
 * Fixed-window limiter shared by every server instance. One row per key and window, counted with
 * an atomic upsert-increment, so concurrent requests can't both take the last slot. Keys are the
 * daily salted IP hash: no raw IP is stored. The table is created on first use, and a key's old
 * windows are deleted when it opens a new one.
 *
 * Throws when the database is unreachable; the handler then refuses rather than allowing
 * unmetered (billable) requests.
 */
export function createPostgresRateLimiter(options: {
  url: string;
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter & { close(): Promise<void> } {
  const now = options.now ?? Date.now;
  // prepare: false works through transaction-mode poolers (Neon, Supabase, PgBouncer).
  const sql = postgres(options.url, { max: 3, prepare: false, connect_timeout: 5, idle_timeout: 20, onnotice: () => {} });

  let ready: Promise<unknown> | null = null;
  const ensureTable = () =>
    (ready ??= sql
      .unsafe(
        `create table if not exists ${TABLE} (
          key text not null,
          window_start bigint not null,
          count integer not null,
          primary key (key, window_start)
        )`,
      )
      .catch((err) => {
        ready = null; // retry on the next request
        throw err;
      }));

  return {
    async consume(key) {
      await ensureTable();
      const t = now();
      const windowStart = Math.floor(t / options.windowMs) * options.windowMs;
      const [row] = await sql<{ count: number }[]>`
        insert into ${sql(TABLE)} (key, window_start, count) values (${key}, ${windowStart}, 1)
        on conflict (key, window_start) do update set count = ${sql(TABLE)}.count + 1
        returning count`;
      if (row.count === 1) {
        await sql`delete from ${sql(TABLE)} where key = ${key} and window_start < ${windowStart}`.catch(() => {});
      }
      if (row.count > options.limit) {
        return { allowed: false, retryAfterSec: Math.ceil((windowStart + options.windowMs - t) / 1000) };
      }
      return { allowed: true, retryAfterSec: 0 };
    },
    close: () => sql.end({ timeout: 5 }),
  };
}

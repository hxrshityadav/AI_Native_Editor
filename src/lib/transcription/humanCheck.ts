import { z } from "zod";

/** Cloudflare Turnstile server-side validation (checked 2026-10-25, see docs/research/README.md). */
export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;

/** "unavailable": Cloudflare unreachable or our secret is wrong. The user can't fix it by retrying the check. */
export type HumanCheckResult = "passed" | "failed" | "unavailable";

export interface HumanVerifier {
  verify(token: string, signal?: AbortSignal): Promise<HumanCheckResult>;
}

const siteverifySchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).default([]),
});

const OUR_FAULT = ["missing-input-secret", "invalid-input-secret", "bad-request", "internal-error"];

/**
 * Tokens are single use and valid for 5 minutes. The visitor's IP isn't sent (it's optional);
 * Cloudflare already sees it when the widget runs in the browser.
 */
export function createTurnstileVerifier(options: {
  secret: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): HumanVerifier {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;

  return {
    async verify(token, signal) {
      if (!token || token.length > MAX_TOKEN_LENGTH) return "failed";
      const timeout = AbortSignal.timeout(timeoutMs);
      let res: Response;
      try {
        res = await doFetch(SITEVERIFY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: options.secret, response: token }),
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch {
        return "unavailable";
      }
      if (!res.ok) return "unavailable";
      const parsed = siteverifySchema.safeParse(await res.json().catch(() => null));
      if (!parsed.success) return "unavailable";
      if (parsed.data.success) return "passed";
      return parsed.data["error-codes"].some((c) => OUR_FAULT.includes(c)) ? "unavailable" : "failed";
    },
  };
}

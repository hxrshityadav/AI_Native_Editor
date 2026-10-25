import { describe, expect, it, vi } from "vitest";
import { createTurnstileVerifier, SITEVERIFY_URL } from "@/lib/transcription/humanCheck";
import { getConfiguredHumanCheck } from "@/lib/transcription/providers";

/** Siteverify responses as documented (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). */
function verifierReturning(body: unknown, status = 200) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  return { fetch, verifier: createTurnstileVerifier({ secret: "s3cret", fetch }) };
}

describe("Turnstile verifier", () => {
  it("passes a token Cloudflare accepts, sending only the secret and token", async () => {
    const { fetch, verifier } = verifierReturning({ success: true, "error-codes": [], hostname: "localhost" });
    expect(await verifier.verify("XXXX.DUMMY.TOKEN.XXXX")).toBe("passed");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SITEVERIFY_URL);
    expect(JSON.parse(init.body as string)).toEqual({ secret: "s3cret", response: "XXXX.DUMMY.TOKEN.XXXX" });
  });

  it("fails invalid, expired or reused tokens", async () => {
    for (const code of ["invalid-input-response", "timeout-or-duplicate", "missing-input-response"]) {
      const { verifier } = verifierReturning({ success: false, "error-codes": [code] });
      expect(await verifier.verify("t")).toBe("failed");
    }
  });

  it("reports our own misconfiguration or Cloudflare errors as unavailable, not as a failed check", async () => {
    for (const code of ["invalid-input-secret", "missing-input-secret", "internal-error", "bad-request"]) {
      const { verifier } = verifierReturning({ success: false, "error-codes": [code] });
      expect(await verifier.verify("t")).toBe("unavailable");
    }
    expect(await verifierReturning({}, 500).verifier.verify("t")).toBe("unavailable");
    expect(await verifierReturning({ unexpected: true }).verifier.verify("t")).toBe("unavailable");
  });

  it("is unavailable when Cloudflare can't be reached or is too slow", async () => {
    const down = createTurnstileVerifier({ secret: "s", fetch: async () => Promise.reject(new TypeError("fetch failed")) });
    expect(await down.verify("t")).toBe("unavailable");
    const slow = createTurnstileVerifier({
      secret: "s",
      timeoutMs: 20,
      fetch: (_url, init) =>
        new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    });
    expect(await slow.verify("t")).toBe("unavailable");
  });

  it("rejects empty or oversized tokens without calling Cloudflare", async () => {
    const { fetch, verifier } = verifierReturning({ success: true });
    expect(await verifier.verify("")).toBe("failed");
    expect(await verifier.verify("x".repeat(2049))).toBe("failed");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Turnstile configuration", () => {
  it("is on only when both keys are set", () => {
    expect(getConfiguredHumanCheck({})).toBeNull();
    expect(getConfiguredHumanCheck({ TURNSTILE_SITE_KEY: "site" })).toBeNull();
    expect(getConfiguredHumanCheck({ TURNSTILE_SECRET_KEY: "secret" })).toBeNull();
    expect(getConfiguredHumanCheck({ TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" })?.siteKey).toBe("site");
  });
});

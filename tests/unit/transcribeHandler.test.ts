import { describe, expect, it, vi } from "vitest";
import type { Word } from "@/lib/captions/types";
import { createTranscribeHandler, MAX_AUDIO_BYTES, type TranscribeErrorCode } from "@/lib/transcription/handler";
import type { HumanCheckResult, HumanVerifier } from "@/lib/transcription/humanCheck";
import { createMemoryRateLimiter, type RateLimiter } from "@/lib/transcription/rateLimit";
import { ProviderError, type Romanizer, type TranscriptionProvider } from "@/lib/transcription/types";
import { oggOpusFile } from "./oggFixtures";

const WORDS: Word[] = [{ text: "नमस्ते", start: 0, end: 0.4 }];

function mockProvider(impl?: TranscriptionProvider["transcribe"]): TranscriptionProvider {
  return { id: "mock", displayName: "Mock", transcribe: vi.fn(impl ?? (async () => WORDS)) };
}

function setup(
  opts: {
    provider?: TranscriptionProvider | null;
    limit?: number;
    romanizer?: Romanizer | null;
    limiter?: RateLimiter;
    humanCheck?: HumanVerifier;
    abuseControlsMissing?: boolean;
  } = {},
) {
  const provider = opts.provider === undefined ? mockProvider() : opts.provider;
  const logged: (TranscribeErrorCode | "ROMANIZE_FAILED")[] = [];
  const handler = createTranscribeHandler({
    getProvider: () => provider,
    getRomanizer: () => opts.romanizer ?? null,
    limiter: opts.limiter ?? createMemoryRateLimiter({ limit: opts.limit ?? 100, windowMs: 60_000 }),
    humanCheck: opts.humanCheck,
    abuseControlsMissing: opts.abuseControlsMissing,
    salt: "test-salt",
    logError: (code) => logged.push(code),
  });
  return { handler, provider, logged };
}

function upload(audio: Blob | string | null, extra: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const form = new FormData();
  if (audio !== null) form.append("audio", audio);
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return new Request("http://localhost/api/transcribe", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": "203.0.113.7", ...headers },
  });
}

const opus = () => new Blob([oggOpusFile() as BlobPart], { type: "application/octet-stream" });

async function errorCode(res: Response) {
  const body = (await res.json()) as { error: { code: string; message: string; action: string } };
  expect(body.error.message).toBeTruthy();
  expect(body.error.action).toBeTruthy();
  return body.error.code;
}

describe("POST /api/transcribe handler", () => {
  it("returns mapped words and the provider name for valid Ogg Opus", async () => {
    const { handler, provider } = setup();
    const res = await handler(upload(opus(), { language: "hi" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ provider: { id: "mock", displayName: "Mock" }, words: WORDS, warning: null });
    expect(provider!.transcribe).toHaveBeenCalledWith(expect.objectContaining({ language: "hi" }));
  });

  it("defaults to Hinglish, which asks the speech model for Hindi", async () => {
    const romanize = vi.fn(async (texts: string[]) => texts.map(() => "namaste"));
    const { handler, provider } = setup({ romanizer: { romanize } });
    await handler(upload(opus()));
    expect(provider!.transcribe).toHaveBeenCalledWith(expect.objectContaining({ language: "hi" }));
    expect(romanize).toHaveBeenCalledOnce();
  });

  it("passes English through to the speech model", async () => {
    const { handler, provider } = setup();
    await handler(upload(opus(), { language: "en" }));
    expect(provider!.transcribe).toHaveBeenCalledWith(expect.objectContaining({ language: "en" }));
  });

  describe("Hinglish", () => {
    const mixed: Word[] = [
      { text: "नमस्ते", start: 0, end: 0.4 },
      { text: "reels", start: 0.5, end: 0.9 },
      { text: "कैप्शन", start: 1, end: 1.4 },
    ];

    it("romanizes the words and keeps every timing", async () => {
      const romanize = vi.fn(async () => ["Namaste", "reels", "caption"]);
      const { handler } = setup({ provider: mockProvider(async () => mixed), romanizer: { romanize } });
      const body = await (await handler(upload(opus(), { language: "hinglish" }))).json();
      expect(romanize).toHaveBeenCalledWith(["नमस्ते", "reels", "कैप्शन"], expect.anything());
      expect(body.words).toEqual([
        { text: "Namaste", start: 0, end: 0.4 },
        { text: "reels", start: 0.5, end: 0.9 },
        { text: "caption", start: 1, end: 1.4 },
      ]);
      expect(body.warning).toBeNull();
    });

    it("skips the romanizer when the transcript is already in Roman script", async () => {
      const romanize = vi.fn(async (t: string[]) => t);
      const roman: Word[] = [{ text: "hello", start: 0, end: 0.4 }];
      const { handler } = setup({ provider: mockProvider(async () => roman), romanizer: { romanize } });
      await handler(upload(opus(), { language: "hinglish" }));
      expect(romanize).not.toHaveBeenCalled();
    });

    it("falls back to Hindi script with a warning when romanizing fails, logging only a code", async () => {
      const { handler, logged } = setup({
        provider: mockProvider(async () => mixed),
        romanizer: {
          romanize: async () => {
            throw new ProviderError("PROVIDER_BAD_RESPONSE", "count mismatch");
          },
        },
      });
      const res = await handler(upload(opus(), { language: "hinglish" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.words).toEqual(mixed);
      expect(body.warning.message).toMatch(/Hindi script/);
      expect(body.warning.action).toBeTruthy();
      expect(logged).toEqual(["ROMANIZE_FAILED"]);
    });

    it("falls back with a warning when no romanizer is configured", async () => {
      const { handler } = setup({ provider: mockProvider(async () => mixed), romanizer: null });
      const body = await (await handler(upload(opus(), { language: "hinglish" }))).json();
      expect(body.words).toEqual(mixed);
      expect(body.warning).not.toBeNull();
    });

    it("keeps Hindi script when Hindi is chosen", async () => {
      const romanize = vi.fn(async (t: string[]) => t);
      const { handler } = setup({ provider: mockProvider(async () => mixed), romanizer: { romanize } });
      const body = await (await handler(upload(opus(), { language: "hi" }))).json();
      expect(romanize).not.toHaveBeenCalled();
      expect(body.words).toEqual(mixed);
    });
  });

  it("rejects non-multipart requests with 415", async () => {
    const { handler } = setup();
    const res = await handler(
      new Request("http://localhost/api/transcribe", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }),
    );
    expect(res.status).toBe(415);
    expect(await errorCode(res)).toBe("UNSUPPORTED_REQUEST");
  });

  it("rejects a missing audio field", async () => {
    const { handler } = setup();
    const res = await handler(upload(null, { language: "hi" }));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("INVALID_REQUEST");
  });

  it("rejects audio sent as a text field", async () => {
    const { handler } = setup();
    expect(await errorCode(await handler(upload("not a file")))).toBe("INVALID_REQUEST");
  });

  it("rejects an unknown language", async () => {
    const { handler } = setup();
    const res = await handler(upload(opus(), { language: "fr" }));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("INVALID_REQUEST");
  });

  it("rejects empty audio", async () => {
    const { handler } = setup();
    expect(await errorCode(await handler(upload(new Blob([]))))).toBe("AUDIO_EMPTY");
  });

  it("rejects oversized audio with 413", async () => {
    const { handler, provider } = setup();
    const big = new Blob([oggOpusFile() as BlobPart, new Uint8Array(MAX_AUDIO_BYTES)]);
    const res = await handler(upload(big));
    expect(res.status).toBe(413);
    expect(await errorCode(res)).toBe("AUDIO_TOO_LARGE");
    expect(provider!.transcribe).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared Content-Length before parsing", async () => {
    const { handler } = setup();
    const req = upload(opus(), {}, { "content-length": String(50 * 1024 * 1024) });
    expect((await handler(req)).status).toBe(413);
  });

  it("sniffs bytes and rejects a video file labelled audio/ogg", async () => {
    const { handler, provider } = setup();
    const mp4 = new Blob([new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d])], {
      type: "audio/ogg",
    });
    const res = await handler(upload(mp4));
    expect(res.status).toBe(415);
    expect(await errorCode(res)).toBe("UNSUPPORTED_AUDIO");
    expect(provider!.transcribe).not.toHaveBeenCalled();
  });

  it("returns 503 when no provider is configured", async () => {
    const { handler } = setup({ provider: null });
    const res = await handler(upload(opus()));
    expect(res.status).toBe(503);
    expect(await errorCode(res)).toBe("NOT_CONFIGURED");
  });

  it("rate limits per client IP with Retry-After", async () => {
    const { handler } = setup({ limit: 2 });
    expect((await handler(upload(opus()))).status).toBe(200);
    expect((await handler(upload(opus()))).status).toBe(200);
    const limited = await handler(upload(opus()));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await errorCode(limited)).toBe("RATE_LIMITED");
    // A different IP is unaffected.
    expect((await handler(upload(opus(), {}, { "x-forwarded-for": "198.51.100.1" }))).status).toBe(200);
  });

  it("maps provider errors without leaking details and logs only the code", async () => {
    const { handler, logged } = setup({
      provider: mockProvider(async () => {
        throw new ProviderError("PROVIDER_UNAVAILABLE", "upstream said: secret transcript");
      }),
    });
    const res = await handler(upload(opus()));
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toContain("PROVIDER_UNAVAILABLE");
    expect(text).not.toContain("secret");
    expect(logged).toEqual(["PROVIDER_UNAVAILABLE"]);
  });

  it("maps unexpected errors to 500", async () => {
    const { handler } = setup({
      provider: mockProvider(async () => {
        throw new Error("boom");
      }),
    });
    expect((await handler(upload(opus()))).status).toBe(500);
  });

  describe("abuse controls", () => {
    const verifier = (result: HumanCheckResult) => ({ verify: vi.fn(async () => result) });
    const withToken = (token = "tok") => upload(opus(), {}, { "x-turnstile-token": token });

    it("needs a Turnstile token when the check is on, without spending the rate limit", async () => {
      const consume = vi.fn(async () => ({ allowed: true, retryAfterSec: 0 }));
      const check = verifier("passed");
      const { handler, provider } = setup({ humanCheck: check, limiter: { consume } });
      const res = await handler(upload(opus()));
      expect(res.status).toBe(403);
      expect(await errorCode(res)).toBe("HUMAN_CHECK_REQUIRED");
      expect(consume).not.toHaveBeenCalled();
      expect(check.verify).not.toHaveBeenCalled();
      expect(provider!.transcribe).not.toHaveBeenCalled();
    });

    it("transcribes once the token passes", async () => {
      const check = verifier("passed");
      const { handler } = setup({ humanCheck: check });
      expect((await handler(withToken("abc"))).status).toBe(200);
      expect(check.verify).toHaveBeenCalledWith("abc", expect.anything());
    });

    it("refuses a failed token with 403 and never calls the provider", async () => {
      const { handler, provider } = setup({ humanCheck: verifier("failed") });
      const res = await handler(withToken());
      expect(res.status).toBe(403);
      expect(await errorCode(res)).toBe("HUMAN_CHECK_FAILED");
      expect(provider!.transcribe).not.toHaveBeenCalled();
    });

    it("refuses with 503 when Cloudflare can't verify, rather than letting the request through", async () => {
      const { handler, provider, logged } = setup({ humanCheck: verifier("unavailable") });
      const res = await handler(withToken());
      expect(res.status).toBe(503);
      expect(await errorCode(res)).toBe("HUMAN_CHECK_UNAVAILABLE");
      expect(provider!.transcribe).not.toHaveBeenCalled();
      expect(logged).toEqual(["HUMAN_CHECK_UNAVAILABLE"]);
    });

    it("checks the rate limit before calling Cloudflare", async () => {
      const check = verifier("passed");
      const { handler } = setup({ humanCheck: check, limit: 1 });
      await handler(withToken());
      expect((await handler(withToken())).status).toBe(429);
      expect(check.verify).toHaveBeenCalledTimes(1);
    });

    it("refuses with 503 when the shared limiter is down", async () => {
      const { handler, provider, logged } = setup({
        limiter: { consume: async () => Promise.reject(new Error("connect ECONNREFUSED")) },
      });
      const res = await handler(upload(opus()));
      expect(res.status).toBe(503);
      expect(await errorCode(res)).toBe("RATE_LIMIT_UNAVAILABLE");
      expect(provider!.transcribe).not.toHaveBeenCalled();
      expect(logged).toEqual(["RATE_LIMIT_UNAVAILABLE"]);
    });

    it("stays off on a public deployment that lacks the controls", async () => {
      const { handler, provider } = setup({ abuseControlsMissing: true });
      const res = await handler(upload(opus()));
      expect(res.status).toBe(503);
      expect(await errorCode(res)).toBe("ABUSE_CONTROLS_MISSING");
      expect(provider!.transcribe).not.toHaveBeenCalled();
    });
  });
});

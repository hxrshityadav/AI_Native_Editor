import { describe, expect, it, vi } from "vitest";
import type { Word } from "@/lib/captions/types";
import { createTranscribeHandler, MAX_AUDIO_BYTES, type TranscribeErrorCode } from "@/lib/transcription/handler";
import { createMemoryRateLimiter } from "@/lib/transcription/rateLimit";
import { ProviderError, type TranscriptionProvider } from "@/lib/transcription/types";
import { oggOpusFile } from "./oggFixtures";

const WORDS: Word[] = [{ text: "नमस्ते", start: 0, end: 0.4 }];

function mockProvider(impl?: TranscriptionProvider["transcribe"]): TranscriptionProvider {
  return { id: "mock", displayName: "Mock", transcribe: vi.fn(impl ?? (async () => WORDS)) };
}

function setup(opts: { provider?: TranscriptionProvider | null; limit?: number } = {}) {
  const provider = opts.provider === undefined ? mockProvider() : opts.provider;
  const logged: TranscribeErrorCode[] = [];
  const handler = createTranscribeHandler({
    getProvider: () => provider,
    limiter: createMemoryRateLimiter({ limit: opts.limit ?? 100, windowMs: 60_000 }),
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
    expect(await res.json()).toEqual({ provider: { id: "mock", displayName: "Mock" }, words: WORDS });
    expect(provider!.transcribe).toHaveBeenCalledWith(expect.objectContaining({ language: "hi" }));
  });

  it("defaults language to auto", async () => {
    const { handler, provider } = setup();
    await handler(upload(opus()));
    expect(provider!.transcribe).toHaveBeenCalledWith(expect.objectContaining({ language: "auto" }));
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
});

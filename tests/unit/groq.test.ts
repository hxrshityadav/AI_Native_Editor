import { describe, expect, it, vi } from "vitest";
import { createGroqProvider, groqResponseSchema, mapGroqWords } from "@/lib/transcription/groq";
import { ProviderError } from "@/lib/transcription/types";

describe("mapGroqWords", () => {
  it("maps Groq verbose_json words to Word, trimming and sorting", () => {
    const response = groqResponseSchema.parse({
      text: "ignored",
      words: [
        { word: " दोस्तों", start: 0.52, end: 0.98 },
        { word: "नमस्ते ", start: 0.0, end: 0.5 },
      ],
    });
    expect(mapGroqWords(response)).toEqual([
      { text: "नमस्ते", start: 0, end: 0.5 },
      { text: "दोस्तों", start: 0.52, end: 0.98 },
    ]);
  });

  it("drops empty words, clamps negatives, repairs end < start and rounds to ms", () => {
    const words = mapGroqWords({
      words: [
        { word: "   ", start: 1, end: 2 },
        { word: "a", start: -0.1, end: 0.2 },
        { word: "b", start: 1.23456, end: 1.0 },
      ],
    });
    expect(words).toEqual([
      { text: "a", start: 0, end: 0.2 },
      { text: "b", start: 1.235, end: 1.235 },
    ]);
  });

  it("returns [] when Groq omits words (silence)", () => {
    expect(mapGroqWords(groqResponseSchema.parse({ text: "" }))).toEqual([]);
  });
});

describe("createGroqProvider", () => {
  const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/ogg" });

  it("requests word timestamps with the configured model and language", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const form = init!.body as FormData;
      expect(form.get("model")).toBe("whisper-large-v3");
      expect(form.get("response_format")).toBe("verbose_json");
      expect(form.get("timestamp_granularities[]")).toBe("word");
      expect(form.get("language")).toBe("hi");
      expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
      return Response.json({ words: [{ word: "hi", start: 0, end: 0.3 }] });
    });
    const provider = createGroqProvider({ apiKey: "test-key", fetch: fetchMock as typeof fetch });
    await expect(provider.transcribe({ audio, language: "hi" })).resolves.toEqual([{ text: "hi", start: 0, end: 0.3 }]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("omits language for auto-detect", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect((init!.body as FormData).has("language")).toBe(false);
      return Response.json({ words: [] });
    });
    await createGroqProvider({ apiKey: "k", fetch: fetchMock as typeof fetch }).transcribe({ audio, language: "auto" });
  });

  it.each([
    [429, "PROVIDER_RATE_LIMITED"],
    [401, "PROVIDER_UNAVAILABLE"],
    [500, "PROVIDER_UNAVAILABLE"],
    [400, "PROVIDER_REJECTED"],
  ])("maps HTTP %i to %s", async (status, code) => {
    const fetchMock = vi.fn(async () => new Response("secret transcript text", { status }));
    const provider = createGroqProvider({ apiKey: "k", fetch: fetchMock as typeof fetch });
    const err = await provider.transcribe({ audio, language: "auto" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).code).toBe(code);
    expect((err as ProviderError).message).not.toContain("secret");
  });

  it("rejects malformed responses", async () => {
    const fetchMock = vi.fn(async () => Response.json({ words: [{ word: 1 }] }));
    const provider = createGroqProvider({ apiKey: "k", fetch: fetchMock as typeof fetch });
    await expect(provider.transcribe({ audio, language: "auto" })).rejects.toMatchObject({
      code: "PROVIDER_BAD_RESPONSE",
    });
  });
});

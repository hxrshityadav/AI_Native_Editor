import { afterEach, describe, expect, it, vi } from "vitest";
import { requestTranscription } from "@/lib/transcription/client";

afterEach(() => vi.unstubAllGlobals());
const audio = new Blob(["speech"], { type: "audio/ogg" });

describe("transcription client", () => {
  it.each([null, 1, {}, { words: [] }, { words: "text", provider: {} }])("handles malformed responses without crashing", async (body) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(body)));
    expect((await requestTranscription(audio, "hinglish")).ok).toBe(false);
  });
  it("preserves the selected language and word timings", async () => {
    const words = [{ text: "hello", start: 0.2, end: 0.7 }];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect((init.body as FormData).get("language")).toBe("en");
      return Response.json({ words, provider: { displayName: "Groq" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await requestTranscription(audio, "en")).toMatchObject({ ok: true, words });
  });
  it("allows retry after network failure and accepts empty transcripts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(Response.json({ words: [], provider: { displayName: "Groq" } })));
    expect(await requestTranscription(audio, "hi")).toMatchObject({ ok: false, code: "NETWORK" });
    expect(await requestTranscription(audio, "hi")).toMatchObject({ ok: true, words: [] });
  });
});

import { describe, expect, it, vi } from "vitest";
import { createGroqRomanizer, hasDevanagari, ROMANIZE_CHUNK } from "@/lib/transcription/groqRomanize";
import { ProviderError } from "@/lib/transcription/types";

/** A fetch mock that answers each chat request with `answer(inputWords)`. */
function chatFetch(answer: (words: string[]) => unknown) {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init!.body));
    const words = JSON.parse(body.messages[1].content).words as string[];
    return Response.json({ choices: [{ message: { content: JSON.stringify(answer(words)) } }] });
  });
}

describe("createGroqRomanizer", () => {
  it("sends a strict JSON-schema request with low reasoning and no reasoning text", async () => {
    const fetchMock = chatFetch(() => ({ words: ["Namaste", "doston"] }));
    await createGroqRomanizer({ apiKey: "k", fetch: fetchMock as typeof fetch }).romanize(["नमस्ते", "दोस्तों"]);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]!.body));
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(body.reasoning_effort).toBe("low");
    expect(body.include_reasoning).toBe(false);
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.additionalProperties).toBe(false);
  });

  it("returns one Roman word per input and never rewrites words already in Roman script", async () => {
    const fetchMock = chatFetch(() => ({ words: ["Namaste", "REELS", "caption"] }));
    const out = await createGroqRomanizer({ apiKey: "k", fetch: fetchMock as typeof fetch }).romanize([
      "नमस्ते",
      "reels",
      "कैप्शन",
    ]);
    expect(out).toEqual(["Namaste", "reels", "caption"]);
  });

  it("rejects a reply with the wrong number of words", async () => {
    const fetchMock = chatFetch(() => ({ words: ["Namaste doston"] }));
    const err = await createGroqRomanizer({ apiKey: "k", fetch: fetchMock as typeof fetch })
      .romanize(["नमस्ते", "दोस्तों"])
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).code).toBe("PROVIDER_BAD_RESPONSE");
  });

  it("rejects a reply that leaves Devanagari or an empty word", async () => {
    for (const words of [["नमस्ते"], [" "]]) {
      const fetchMock = chatFetch(() => ({ words }));
      await expect(
        createGroqRomanizer({ apiKey: "k", fetch: fetchMock as typeof fetch }).romanize(["नमस्ते"]),
      ).rejects.toMatchObject({ code: "PROVIDER_BAD_RESPONSE" });
    }
  });

  it("rejects non-JSON content and HTTP errors without echoing content", async () => {
    const bad = vi.fn(async () => Response.json({ choices: [{ message: { content: "sure! here you go" } }] }));
    await expect(createGroqRomanizer({ apiKey: "k", fetch: bad as typeof fetch }).romanize(["है"])).rejects.toMatchObject({
      code: "PROVIDER_BAD_RESPONSE",
    });
    const limited = vi.fn(async () => new Response("secret transcript", { status: 429 }));
    const err = (await createGroqRomanizer({ apiKey: "k", fetch: limited as typeof fetch })
      .romanize(["है"])
      .catch((e: unknown) => e)) as ProviderError;
    expect(err.code).toBe("PROVIDER_RATE_LIMITED");
    expect(err.message).not.toContain("secret");
  });

  it("splits long transcripts into chunks, keeps order, and skips chunks with no Devanagari", async () => {
    const input = [
      ...Array.from({ length: ROMANIZE_CHUNK }, () => "है"),
      ...Array.from({ length: 5 }, (_, i) => `word${i}`),
    ];
    const fetchMock = chatFetch((words) => ({ words: words.map(() => "hai") }));
    const out = await createGroqRomanizer({ apiKey: "k", fetch: fetchMock as typeof fetch }).romanize(input);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(input.length);
    expect(out.at(-1)).toBe("word4");
    expect(out[0]).toBe("hai");
  });
});

describe("hasDevanagari", () => {
  it("detects Devanagari anywhere in a word", () => {
    expect(hasDevanagari("नमस्ते")).toBe(true);
    expect(hasDevanagari("reels।")).toBe(true);
    expect(hasDevanagari("doston")).toBe(false);
  });
});

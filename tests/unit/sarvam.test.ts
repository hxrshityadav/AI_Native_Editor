import { describe, expect, it, vi } from "vitest";
import { getConfiguredProvider } from "@/lib/transcription/providers";
import { createSarvamProvider, estimateWordTimings, sarvamResponseSchema } from "@/lib/transcription/sarvam";
import { ProviderError } from "@/lib/transcription/types";

// Response shape from https://docs.sarvam.ai/api-reference/speech-to-text/transcribe (checked 2026-10-25).
const RESPONSE = {
  request_id: "r1",
  transcript: "mera phone number hai aaj reels banate hain",
  language_code: "hi-IN",
  timestamps: {
    words: ["mera phone number hai", "aaj reels banate hain"],
    start_time_seconds: [0.4, 2.5],
    end_time_seconds: [2.0, 4.6],
  },
};

describe("estimateWordTimings", () => {
  const words = estimateWordTimings(sarvamResponseSchema.parse(RESPONSE));

  it("splits each timed phrase into words", () => {
    expect(words.map((w) => w.text)).toEqual(["mera", "phone", "number", "hai", "aaj", "reels", "banate", "hain"]);
  });

  it("keeps Sarvam's phrase start and end exactly", () => {
    expect(words[0].start).toBe(0.4);
    expect(words[3].end).toBe(2);
    expect(words[4].start).toBe(2.5);
    expect(words[7].end).toBe(4.6);
  });

  it("shares the phrase's span by word length, without gaps or overlaps", () => {
    // "mera phone number hai": 4 + 5 + 6 + 3 = 18 characters over 1.6 s.
    expect(words[1].start).toBeCloseTo(0.4 + (1.6 * 4) / 18, 3);
    for (let i = 1; i < 4; i++) expect(words[i].start).toBe(words[i - 1].end);
  });

  it("returns no words for silence, and refuses text without timings", () => {
    expect(estimateWordTimings({ transcript: "", timestamps: null })).toEqual([]);
    expect(() => estimateWordTimings({ transcript: "kuch", timestamps: null })).toThrow(ProviderError);
  });
});

describe("createSarvamProvider", () => {
  const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/ogg" });
  const ok = () => vi.fn<typeof fetch>(async () => Response.json(RESPONSE));

  it("asks for Roman script (translit) when Hinglish is wanted, with the key in its header", async () => {
    const fetch = ok();
    const provider = createSarvamProvider({ apiKey: "sk", fetch });
    await provider.transcribe({ audio, language: "hi", preferRoman: true });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.sarvam.ai/speech-to-text");
    expect((init!.headers as Record<string, string>)["api-subscription-key"]).toBe("sk");
    const form = init!.body as FormData;
    expect(Object.fromEntries([...form.entries()].filter(([k]) => k !== "file"))).toEqual({
      model: "saaras:v3",
      language_code: "hi-IN",
      mode: "translit",
      with_timestamps: "true",
    });
  });

  it("transcribes in the spoken script otherwise", async () => {
    const fetch = ok();
    await createSarvamProvider({ apiKey: "sk", fetch }).transcribe({ audio, language: "en", preferRoman: true });
    const form = fetch.mock.calls[0][1]!.body as FormData;
    expect(form.get("mode")).toBe("transcribe");
    expect(form.get("language_code")).toBe("en-IN");
  });

  it("declares its 30 s limit and who receives the audio", () => {
    const provider = createSarvamProvider({ apiKey: "sk" });
    expect(provider.maxSeconds).toBe(30);
    expect(provider.privacy.name).toBe("Sarvam AI");
  });

  it("maps HTTP errors to provider codes without reading the body", async () => {
    const cases: [number, string][] = [
      [429, "PROVIDER_RATE_LIMITED"],
      [403, "PROVIDER_UNAVAILABLE"],
      [503, "PROVIDER_UNAVAILABLE"],
      [400, "PROVIDER_REJECTED"],
    ];
    for (const [status, code] of cases) {
      const provider = createSarvamProvider({ apiKey: "sk", fetch: async () => new Response("secret words", { status }) });
      await expect(provider.transcribe({ audio, language: "hi" })).rejects.toMatchObject({ code });
    }
  });

  it("rejects an unexpected response shape", async () => {
    const provider = createSarvamProvider({ apiKey: "sk", fetch: async () => Response.json({ text: "x" }) });
    await expect(provider.transcribe({ audio, language: "hi" })).rejects.toMatchObject({ code: "PROVIDER_BAD_RESPONSE" });
  });
});

describe("provider selection", () => {
  it("defaults to Groq", () => {
    expect(getConfiguredProvider({ GROQ_API_KEY: "g" })?.id).toBe("groq");
  });

  it("uses Sarvam only with a key and a confirmed training opt-out", () => {
    const base = { TRANSCRIBE_PROVIDER: "sarvam", GROQ_API_KEY: "g" };
    expect(getConfiguredProvider({ ...base, SARVAM_API_KEY: "s" })).toBeNull();
    expect(getConfiguredProvider({ ...base, SARVAM_TRAINING_OPT_OUT: "confirmed" })).toBeNull();
    expect(getConfiguredProvider({ ...base, SARVAM_API_KEY: "s", SARVAM_TRAINING_OPT_OUT: "confirmed" })?.id).toBe("sarvam");
  });
});

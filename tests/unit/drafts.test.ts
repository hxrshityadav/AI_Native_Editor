import { describe, expect, it } from "vitest";
import { fingerprintFile, parseDraft, type Draft } from "@/lib/drafts";

describe("fingerprintFile", () => {
  const bytes = (n: number, seed: number) => new Uint8Array(n).map((_, i) => (i * 31 + seed) % 251);

  it("is stable for the same content and differs for different content", async () => {
    const a = await fingerprintFile(new Blob([bytes(3_000_000, 1)]));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await fingerprintFile(new Blob([bytes(3_000_000, 1)]))).toBe(a);
    expect(await fingerprintFile(new Blob([bytes(3_000_000, 2)]))).not.toBe(a);
  });

  it("notices a change in the tail of a large file", async () => {
    const data = bytes(3_000_000, 1);
    const a = await fingerprintFile(new Blob([data]));
    data[data.length - 1] ^= 0xff;
    expect(await fingerprintFile(new Blob([data]))).not.toBe(a);
  });

  it("handles files smaller than the sample size", async () => {
    expect(await fingerprintFile(new Blob([bytes(10, 1)]))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("parseDraft", () => {
  const draft: Draft = {
    version: 1,
    fingerprint: "abc",
    savedAt: 1,
    providerName: "Groq",
    transcript: [{ text: "नमस्ते", start: 0, end: 0.5 }],
    edited: null,
  };

  it("accepts a valid draft", () => {
    expect(parseDraft(draft)).toEqual(draft);
  });

  it("rejects missing, old-version and corrupted records", () => {
    expect(parseDraft(undefined)).toBeNull();
    expect(parseDraft({ ...draft, version: 0 })).toBeNull();
    expect(parseDraft({ ...draft, transcript: [{ text: 1 }] })).toBeNull();
  });
});

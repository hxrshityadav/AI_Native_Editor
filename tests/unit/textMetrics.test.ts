import { describe, expect, it } from "vitest";
import { devanagariShare, editDistance, lenientCer, wer, words } from "../bakeoff/textMetrics.mjs";

describe("bake-off text metrics", () => {
  it("normalizes case and punctuation, keeping Devanagari marks", () => {
    expect(words("Namaste, DOSTON! Aaj…")).toEqual(["namaste", "doston", "aaj"]);
    expect(words("नमस्ते, दोस्तों")).toEqual(["नमस्ते", "दोस्तों"]);
  });

  it("computes edit distance", () => {
    expect(editDistance(["a", "b", "c"], ["a", "x", "c", "d"])).toBe(2);
    expect(editDistance([], ["a"])).toBe(1);
  });

  it("scores word errors against the reference length", () => {
    expect(wer("aaj hum reels banayenge", "aaj hum reels banayenge")).toBe(0);
    expect(wer("aaj hum reels banayenge", "aaj ham reels")).toBe(0.5);
    expect(wer("", "anything")).toBeNull();
  });

  it("forgives spelling variants of the same word in the lenient score only", () => {
    expect(wer("accha bhai", "acchha bhai")).toBe(0.5);
    expect(lenientCer("accha bhai", "acchha bhai")).toBe(0);
    expect(lenientCer("accha bhai", "bura bhai")).toBeGreaterThan(0.3);
  });

  it("counts words left in Hindi script", () => {
    expect(devanagariShare(["namaste", "दोस्तों", "reels", "आज"])).toBe(0.5);
    expect(devanagariShare([])).toBe(0);
  });
});

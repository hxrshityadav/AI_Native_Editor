import { describe, expect, it } from "vitest";
import {
  mergeWithNext,
  MIN_WORD_SEC,
  removeWord,
  replaceWordText,
  shiftEdge,
  wordIndexAt,
  type Word,
} from "@/lib/captions";

const words: Word[] = [
  { text: "नमस्ते", start: 0, end: 0.5 },
  { text: "दोस्तों", start: 0.6, end: 1.2 },
  { text: "welcome", start: 1.3, end: 1.9 },
];

describe("replaceWordText", () => {
  it("changes text and keeps timing", () => {
    expect(replaceWordText(words, 0, " Namaste ")[0]).toEqual({ text: "Namaste", start: 0, end: 0.5 });
  });

  it("removes the word when text is emptied", () => {
    expect(replaceWordText(words, 1, "   ").map((w) => w.text)).toEqual(["नमस्ते", "welcome"]);
  });

  it("splits on spaces, dividing time by length and keeping the outer edges", () => {
    const out = replaceWordText(words, 2, "wel come");
    expect(out.slice(2)).toEqual([
      { text: "wel", start: 1.3, end: 1.557 },
      { text: "come", start: 1.557, end: 1.9 },
    ]);
  });

  it("does not mutate the input", () => {
    const copy = structuredClone(words);
    replaceWordText(words, 0, "x y");
    expect(words).toEqual(copy);
  });
});

describe("removeWord / mergeWithNext", () => {
  it("removes by index", () => {
    expect(removeWord(words, 0)).toHaveLength(2);
  });

  it("merges with the next word across the gap", () => {
    expect(mergeWithNext(words, 0)[0]).toEqual({ text: "नमस्ते दोस्तों", start: 0, end: 1.2 });
    expect(mergeWithNext(words, 0)).toHaveLength(2);
  });

  it("is a no-op on the last word", () => {
    expect(mergeWithNext(words, 2)).toEqual(words);
  });
});

describe("shiftEdge", () => {
  it("moves an edge by delta", () => {
    expect(shiftEdge(words, 1, "start", -0.05)[1].start).toBe(0.55);
    expect(shiftEdge(words, 1, "end", 0.05)[1].end).toBe(1.25);
  });

  it("never overlaps neighbours", () => {
    expect(shiftEdge(words, 1, "start", -1)[1].start).toBe(0.5);
    expect(shiftEdge(words, 1, "end", 1)[1].end).toBe(1.3);
  });

  it("keeps a minimum duration", () => {
    expect(shiftEdge(words, 1, "start", 5)[1].start).toBe(1.2 - MIN_WORD_SEC);
    expect(shiftEdge(words, 1, "end", -5)[1].end).toBe(0.6 + MIN_WORD_SEC);
  });

  it("clamps to 0 and to maxEnd", () => {
    expect(shiftEdge(words, 0, "start", -1)[0].start).toBe(0);
    expect(shiftEdge(words, 2, "end", 10, 2)[2].end).toBe(2);
  });
});

describe("wordIndexAt", () => {
  it("finds the spoken word, end exclusive, -1 in gaps", () => {
    expect(wordIndexAt(words, 0.1)).toBe(0);
    expect(wordIndexAt(words, 0.55)).toBe(-1);
    expect(wordIndexAt(words, 1.3)).toBe(2);
    expect(wordIndexAt(words, 1.9)).toBe(-1);
  });
});

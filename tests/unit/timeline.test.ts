import { describe, expect, it } from "vitest";
import { detectSilences, editedToSource, normalizeCuts, remapCaptionLines, remapWords, retainedPieces, sourceToEdited } from "@/lib/editor/timeline";

describe("non-destructive cut timeline", () => {
  const cuts = [{ start: 1, end: 2 }, { start: 3, end: 4 }];
  it("merges overlapping cuts, sorts them, and clamps to the source", () => {
    expect(normalizeCuts([{ start: 3, end: 20 }, { start: 1, end: 2 }, { start: 1.5, end: 4 }], 8)).toEqual([{ start: 1, end: 8 }]);
  });
  it("maps source and edited time at cut edges without drift", () => {
    expect(sourceToEdited(5, cuts)).toBe(3);
    expect(sourceToEdited(1.5, cuts)).toBe(1);
    expect(editedToSource(1, cuts)).toBe(2);
    expect(editedToSource(3, cuts)).toBe(5);
    for (const time of [0, 0.5, 2.1, 2.5, 4.1, 5]) expect(editedToSource(sourceToEdited(time, cuts), cuts)).toBeCloseTo(time);
  });
  it("clips frame/audio samples that straddle edits, with no gaps in output time", () => {
    expect(retainedPieces(0.9, 2.1, cuts)).toEqual([{ start: 0.9, end: 1 }, { start: 2, end: 2.1 }]);
    expect(retainedPieces(1.1, 1.9, cuts)).toEqual([]);
    expect(retainedPieces(2.2, 2.8, cuts)).toEqual([{ start: 2.2, end: 2.8 }]);
  });
  it("remaps captions and removes entirely cut words without modifying their source data", () => {
    const words = [{ text: "first", start: 0, end: 0.8 }, { text: "removed", start: 1.2, end: 1.8 }, { text: "last", start: 4, end: 5 }];
    expect(remapWords(words, cuts)).toEqual([{ text: "first", start: 0, end: 0.8 }, { text: "last", start: 2, end: 3 }]);
    expect(words[2].start).toBe(4);
  });
  it("keeps portions of words crossing a cut, without duplicating text", () => {
    expect(remapWords([{ text: "hello", start: 0.8, end: 2.2 }], cuts)).toEqual([{ text: "hello", start: 0.8, end: 1.2000000000000002 }]);
  });
  it("preserves caption blocks across cuts so SRT and video cannot regroup differently", () => {
    const lines = [
      { text: "one", start: 0, end: 0.8, words: [{ text: "one", start: 0, end: 0.8 }] },
      { text: "two", start: 2.1, end: 2.5, words: [{ text: "two", start: 2.1, end: 2.5 }] },
    ];
    const mapped = remapCaptionLines(lines, cuts);
    expect(mapped).toHaveLength(2);
    expect(mapped[1].start).toBeCloseTo(1.1);
  });
});
describe("RMS pause candidates", () => {
  const options = { threshold: -40, minimum: 0.5, padding: 0.08, keep: 0.2 };
  it("preserves short natural pauses and audible sound", () => {
    expect(detectSilences([{ start: 0, end: 0.2, db: -70 }, { start: 0.2, end: 1, db: -25 }], options)).toEqual([]);
  });
  it("detects a quiet interval and preserves edge padding plus the requested pause", () => {
    expect(detectSilences([{ start: 0, end: 1, db: -20 }, { start: 1, end: 2, db: -70 }, { start: 2, end: 3, db: -20 }], options)).toEqual([{ start: 1.18, end: 1.82 }]);
  });
  it("does not bridge an unmeasured gap", () => {
    expect(detectSilences([{ start: 0, end: 0.3, db: -70 }, { start: 1, end: 1.3, db: -70 }], options)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildTimeMap,
  editDecisionListSchema,
  mapInterval,
  mapWords,
  removedRangeAt,
  toOutputTime,
  toOutputTimeSnapped,
  toSourceTime,
  type EditInterval,
} from "@/lib/edit/timeline";

const cut = (start: number, end: number, action: EditInterval["action"] = "remove"): EditInterval => ({
  start,
  end,
  action,
  origin: "silence",
});
const edl = (...intervals: EditInterval[]) => ({ version: 1 as const, intervals });

describe("buildTimeMap", () => {
  it("is the identity with no cuts", () => {
    const map = buildTimeMap(30, edl());
    expect(map.outputDuration).toBe(30);
    expect(toOutputTime(map, 17.5)).toBe(17.5);
  });

  it("shifts everything after a 12–15 s cut three seconds earlier", () => {
    const map = buildTimeMap(30, edl(cut(12, 15)));
    expect(map.outputDuration).toBe(27);
    expect(toOutputTime(map, 11)).toBe(11);
    expect(toOutputTime(map, 13)).toBeNull();
    expect(toOutputTime(map, 15)).toBe(12);
    expect(toOutputTime(map, 20)).toBe(17);
  });

  it("handles several non-adjacent cuts", () => {
    const map = buildTimeMap(20, edl(cut(2, 3), cut(10, 12), cut(15, 15.5)));
    expect(map.outputDuration).toBe(16.5);
    expect(toOutputTime(map, 5)).toBe(4);
    expect(toOutputTime(map, 13)).toBe(10);
    expect(toOutputTime(map, 19)).toBe(15.5);
  });

  it("merges overlapping and adjacent cuts, and drops slivers between them", () => {
    const map = buildTimeMap(20, edl(cut(5, 8), cut(7, 9), cut(9.02, 11)));
    expect(map.removed).toEqual([{ start: 5, end: 11 }]);
    expect(map.outputDuration).toBe(14);
  });

  it("handles cuts at the very start and end", () => {
    const map = buildTimeMap(10, edl(cut(0, 1.5), cut(8.99, 10)));
    expect(map.removed).toEqual([{ start: 0, end: 1.5 }, { start: 8.99, end: 10 }]);
    expect(toOutputTime(map, 1.5)).toBe(0);
    expect(map.outputDuration).toBeCloseTo(7.49, 3);
  });

  it("ignores suggestions the user chose to keep, and clamps to the video", () => {
    const map = buildTimeMap(10, edl(cut(2, 4, "keep"), cut(9, 12)));
    expect(map.removed).toEqual([{ start: 9, end: 10 }]);
  });

  it("maps output time back to source time", () => {
    const map = buildTimeMap(30, edl(cut(12, 15), cut(20, 21)));
    for (const t of [0, 11.9, 15, 19.5, 21, 29]) expect(toSourceTime(map, toOutputTime(map, t)!)).toBeCloseTo(t, 6);
  });

  it("tells the preview where to jump", () => {
    const map = buildTimeMap(30, edl(cut(12, 15)));
    expect(removedRangeAt(map, 13)).toEqual({ start: 12, end: 15 });
    expect(removedRangeAt(map, 15)).toBeNull();
    expect(toOutputTimeSnapped(map, 13)).toBe(12);
  });

  it("rejects malformed intervals at the boundary", () => {
    expect(editDecisionListSchema.safeParse(edl(cut(5, 4))).success).toBe(false);
    expect(editDecisionListSchema.safeParse({ version: 1, intervals: [{ start: 1, end: 2, action: "delete", origin: "silence" }] }).success).toBe(false);
  });
});

describe("captions and words across cuts", () => {
  const map = buildTimeMap(30, edl(cut(12, 15), cut(20, 21)));

  it("shifts words after a cut and leaves earlier ones alone", () => {
    const words = mapWords(map, [
      { text: "pehle", start: 10, end: 11 },
      { text: "baad", start: 16, end: 16.5 },
      { text: "aakhri", start: 25, end: 25.4 },
    ]);
    expect(words).toEqual([
      { text: "pehle", start: 10, end: 11 },
      { text: "baad", start: 13, end: 13.5 },
      { text: "aakhri", start: 21, end: 21.4 },
    ]);
  });

  it("drops a word entirely inside a cut", () => {
    expect(mapWords(map, [{ text: "umm", start: 13, end: 13.4 }])).toEqual([]);
  });

  it("clips a word that overlaps a cut edge", () => {
    expect(mapInterval(map, { start: 11.8, end: 12.4 })).toEqual({ start: 11.8, end: 12 });
    expect(mapInterval(map, { start: 14.6, end: 15.5 })).toEqual({ start: 12, end: 12.5 });
  });

  it("shortens a caption that spans a whole cut", () => {
    expect(mapInterval(map, { start: 11, end: 16 })).toEqual({ start: 11, end: 13 });
  });

  it("drops what survives a cut only as a sliver", () => {
    expect(mapInterval(map, { start: 11.98, end: 13 })).toBeNull();
  });

  it("keeps word order and non-overlap after several cuts", () => {
    const words = Array.from({ length: 60 }, (_, i) => ({ text: `w${i}`, start: i * 0.5, end: i * 0.5 + 0.4 }));
    const mapped = mapWords(map, words);
    for (let i = 1; i < mapped.length; i++) expect(mapped[i].start).toBeGreaterThanOrEqual(mapped[i - 1].end);
    expect(mapped.at(-1)!.end).toBeLessThanOrEqual(map.outputDuration);
  });
});

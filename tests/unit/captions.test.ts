import { describe, expect, it } from "vitest";
import { formatSrtTime, groupWords, layoutWords, lineAt, makeTestWords, toSrt, type Word } from "@/lib/captions";

const w = (text: string, start: number, end: number): Word => ({ text, start, end });

describe("groupWords", () => {
  it("breaks on max words", () => {
    const words = ["a", "b", "c", "d", "e"].map((t, i) => w(t, i * 0.3, i * 0.3 + 0.25));
    const lines = groupWords(words, { maxChars: 100, maxWords: 2, maxGapSec: 10, maxDurationSec: 10 });
    expect(lines.map((l) => l.text)).toEqual(["a b", "c d", "e"]);
  });

  it("breaks on silence gaps and sentence ends", () => {
    const lines = groupWords([w("नमस्ते", 0, 0.4), w("दोस्तों।", 0.4, 0.8), w("आज", 0.9, 1.1), w("hum", 3, 3.2)]);
    expect(lines.map((l) => l.text)).toEqual(["नमस्ते दोस्तों।", "आज", "hum"]);
  });

  it("breaks on character count and keeps line timings from first/last word", () => {
    const lines = groupWords([w("supercalifragilistic", 0, 0.5), w("expialidocious", 0.5, 1)], {
      maxChars: 24,
      maxWords: 4,
      maxGapSec: 1,
      maxDurationSec: 5,
    });
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ start: 0.5, end: 1 });
  });

  it("drops empty words", () => {
    expect(groupWords([w("  ", 0, 1), w(" hi ", 1, 2)]).map((l) => l.text)).toEqual(["hi"]);
  });
});

describe("lineAt", () => {
  const lines = groupWords([w("a", 0, 1), w("b", 2, 3)], { maxChars: 50, maxWords: 1, maxGapSec: 5, maxDurationSec: 5 });
  it("finds the active line with end exclusive", () => {
    expect(lineAt(lines, 0)?.text).toBe("a");
    expect(lineAt(lines, 0.99)?.text).toBe("a");
    expect(lineAt(lines, 1)).toBeNull();
    expect(lineAt(lines, 2.5)?.text).toBe("b");
    expect(lineAt(lines, 3)).toBeNull();
  });
});

describe("SRT", () => {
  it("formats timestamps", () => {
    expect(formatSrtTime(0)).toBe("00:00:00,000");
    expect(formatSrtTime(62.3456)).toBe("00:01:02,346");
    expect(formatSrtTime(3725.5)).toBe("01:02:05,500");
    expect(formatSrtTime(-1)).toBe("00:00:00,000");
  });

  it("serialises numbered cues", () => {
    const srt = toSrt(groupWords([w("hello", 0, 0.5), w("world", 2, 2.5)]));
    expect(srt).toBe("1\n00:00:00,000 --> 00:00:00,500\nhello\n\n2\n00:00:02,000 --> 00:00:02,500\nworld\n");
  });
});

describe("layoutWords", () => {
  const measure = (s: string) => s.length * 10;
  it("wraps words into rows within max width", () => {
    const layout = layoutWords([w("aaa", 0, 1), w("bbb", 1, 2), w("ccc", 2, 3)], 75, measure);
    expect(layout.rows).toBe(2);
    expect(layout.rowWidths).toEqual([70, 30]);
    expect(layout.words.map((x) => [x.row, x.x])).toEqual([
      [0, 0],
      [0, 40],
      [1, 0],
    ]);
  });
  it("puts an over-wide word on its own row", () => {
    expect(layoutWords([w("aaaaaaaaaaaa", 0, 1)], 50, measure).rows).toBe(1);
  });
});

describe("makeTestWords", () => {
  it("stays inside the duration", () => {
    const words = makeTestWords(3);
    expect(words.length).toBeGreaterThan(0);
    expect(words.at(-1)!.end).toBeLessThanOrEqual(3);
  });
});

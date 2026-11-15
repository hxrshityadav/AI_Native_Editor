import { describe, expect, it } from "vitest";
import { MIN_CAPTION, PRESETS, safeArea, activeIndex, add, drawCaption, fromCues, layoutCaption, merge, remove, scriptsIn, setText, setTiming, split, toSrt, toVtt, validate, type Caption } from "@/lib/subtitles/captions";

const make = (...spans: [number, number, string][]): Caption[] => spans.map(([start, end, text], i) => ({ id: `t${i}`, start, end, text }));
/** A measuring context: every character is half the font size wide. Records what is drawn. */
function fakeContext() {
  const calls: { op: string; text?: string; x?: number; y?: number; fill?: string }[] = [];
  let px = 10;
  const ctx = {
    set font(value: string) { px = Number(/(\d+)px/.exec(value)?.[1] ?? 10); }, get font() { return `${px}px`; },
    measureText: (text: string) => ({ width: text.length * px * 0.5 }), fillStyle: "", strokeStyle: "", lineWidth: 0, globalAlpha: 1, textAlign: "left", textBaseline: "alphabetic", lineJoin: "miter", miterLimit: 10,
    save() {}, restore() {}, translate() {}, scale() {}, rect() {}, clip() {}, createLinearGradient: () => ({ addColorStop() {} }), beginPath() {}, moveTo() {}, arcTo() {}, closePath() {}, fill() { calls.push({ op: "fill" }); },
    fillText(text: string, x: number, y: number) { calls.push({ op: "text", text, x, y, fill: ctx.fillStyle }); }, strokeText(text: string) { calls.push({ op: "stroke", text }); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("editing", () => {
  const base = make([0, 2, "one two three four"], [2.5, 4, "five six"], [6, 8, "seven"]);
  it("clamps timing between neighbours so captions never overlap", () => {
    const moved = setTiming(base, 1, 1, 7, 10);
    expect(moved[1].start).toBe(2); expect(moved[1].end).toBe(6);
    const tiny = setTiming(base, 1, 3, 3, 10); expect(tiny[1].end - tiny[1].start).toBeCloseTo(MIN_CAPTION, 6);
    expect(setTiming(base, 2, 6, 99, 10)[2].end).toBe(10);
  });
  it("splits at the word boundary nearest the cursor, time in proportion to text", () => {
    const parts = split(base, 0, 8);
    expect(parts.map(c => c.text).slice(0, 2)).toEqual(["one two", "three four"]);
    expect(parts[0].end).toBe(parts[1].start); expect(parts[0].end).toBeGreaterThan(0.7); expect(parts[0].end).toBeLessThan(1.1);
    expect(parts).toHaveLength(4);
    expect(() => split(base, 2)).toThrow(/two words/);
  });
  it("splits with real word timings when they exist", () => {
    const words = [{ text: "a", start: 0, end: 0.3 }, { text: "b", start: 1.4, end: 1.6 }];
    const parts = split([{ id: "w", start: 0, end: 2, text: "a b", words }], 0);
    expect(parts[1].start).toBe(1.4); expect(parts[1].words).toEqual([words[1]]);
  });
  it("merges with the next caption and removes", () => {
    const merged = merge(base, 0); expect(merged).toHaveLength(2); expect(merged[0]).toMatchObject({ start: 0, end: 4, text: "one two three four five six" });
    expect(() => merge(base, 2)).toThrow(/next caption/);
    expect(remove(base, 1).map(c => c.text)).toEqual(["one two three four", "seven"]);
  });
  it("adds at the playhead when free, otherwise in the next gap", () => {
    expect(add(base, 4.5, 10)).toMatchObject({ index: 2 }); expect(add(base, 4.5, 10).captions[2]).toMatchObject({ start: 4.5, end: 6 });
    expect(add(base, 1, 10).captions[1]).toMatchObject({ start: 2, end: 2.5 }); // first free gap after the playhead
    expect(add(make([0, 2, "a"], [2.2, 4, "b"]), 1, 10).captions[2]).toMatchObject({ start: 4, end: 6 }); // 0.2 s gap is too small
    expect(() => add(make([0, 10, "full"]), 3, 10)).toThrow(/no free time/);
  });
  it("editing text drops word timings that no longer match", () => {
    const withWords: Caption[] = [{ id: "a", start: 0, end: 1, text: "hi", words: [{ text: "hi", start: 0, end: 1 }] }];
    expect(setText(withWords, 0, "hello there").at(0)!.words).toBeUndefined();
  });
  it("finds the active caption by time", () => {
    expect(activeIndex(base, 0)).toBe(0); expect(activeIndex(base, 2.2)).toBe(-1); expect(activeIndex(base, 7.99)).toBe(2); expect(activeIndex(base, 8)).toBe(-1);
  });
  it("imports transcript cues, dropping empty ones", () => { expect(fromCues([{ text: " hi ", start: 0, end: 1 }, { text: " ", start: 1, end: 2 }])).toHaveLength(1); });
});

describe("validation and scripts", () => {
  it("reports empty, overlapping and out-of-range captions", () => {
    const issues = validate(make([0, 2, ""], [1.5, 3, "x"], [4, 12, "y"]), 10, PRESETS.clean.style);
    expect(issues.map(i => [i.index, i.level])).toEqual(expect.arrayContaining([[0, "error"], [1, "error"], [2, "error"]]));
  });
  it("detects scripts and refuses a font that cannot draw Devanagari", () => {
    expect(scriptsIn("नमस्ते, world 123!")).toEqual(["devanagari", "latin"]);
    expect(scriptsIn("你好")).toEqual(["other"]);
    expect(validate(make([0, 1, "नमस्ते"]), 2, { ...PRESETS.clean.style, font: "anton" })[0].message).toMatch(/no Devanagari/);
    expect(validate(make([0, 1, "नमस्ते"]), 2, { ...PRESETS.clean.style, font: "mukta" })).toEqual([]);
  });
});

describe("layout and drawing", () => {
  it("wraps by words per line and keeps the block inside the safe area", () => {
    const { ctx } = fakeContext(), style = { ...PRESETS.clean.style, maxWords: 2, y: 0.99 }, safe = safeArea(1080, 1920);
    const layout = layoutCaption(ctx, "one two three four five", style, 1080, 1920);
    expect(layout.lines.map(l => l.words.length)).toEqual([2, 2, 1]);
    expect(layout.top + layout.blockHeight).toBeLessThanOrEqual(1920 * (1 - safe.bottom) + 0.5);
    expect(layoutCaption(ctx, "a", { ...style, y: 0 }, 1080, 1920).top).toBeGreaterThanOrEqual(1920 * safe.top - 0.5);
  });
  it("wraps long words at the safe width", () => {
    const { ctx } = fakeContext(), layout = layoutCaption(ctx, "aaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbb", { ...PRESETS.clean.style, maxWords: 10 }, 400, 400);
    expect(layout.lines).toHaveLength(2);
  });
  it("draws only the active caption, with outline strokes, and highlights the spoken word only with real timings", () => {
    const { ctx, calls } = fakeContext();
    drawCaption(ctx, make([1, 2, "hello there"]), 0.5, PRESETS.clean.style, 1080, 1920); expect(calls).toHaveLength(0);
    drawCaption(ctx, make([1, 2, "hello there"]), 1.5, PRESETS.word.style, 1080, 1920);
    expect(calls.filter(c => c.op === "text").map(c => c.text)).toEqual(["hello", "there"]); expect(calls.some(c => c.op === "stroke")).toBe(true);
    const timed: Caption[] = [{ id: "w", start: 1, end: 2, text: "hello there", words: [{ text: "hello", start: 1, end: 1.4 }, { text: "there", start: 1.5, end: 2 }] }];
    const highlight = fakeContext(); drawCaption(highlight.ctx, timed, 1.6, PRESETS.word.style, 1080, 1920);
    expect(highlight.calls.filter(c => c.op === "text").map(c => c.fill)).toEqual([PRESETS.word.style.color, PRESETS.word.style.highlight]);
    const plain = fakeContext(); drawCaption(plain.ctx, make([1, 2, "hello there"]), 1.6, PRESETS.word.style, 1080, 1920);
    expect(new Set(plain.calls.filter(c => c.op === "text").map(c => c.fill))).toEqual(new Set([PRESETS.word.style.color]));
  });
  it("box background draws one box per line", () => {
    const { ctx, calls } = fakeContext(); drawCaption(ctx, make([0, 1, "a b c d e f g h"]), 0.5, { ...PRESETS.boxed.style, maxWords: 4 }, 1080, 1920);
    expect(calls.filter(c => c.op === "fill")).toHaveLength(2);
  });
});

describe("subtitle files", () => {
  const captions = make([0, 1.5, "Hello --> world"], [61.25, 3723.004, "नमस्ते"]);
  it("writes SRT with comma milliseconds and numbering", () => { expect(toSrt(captions)).toBe("1\n00:00:00,000 --> 00:00:01,500\nHello → world\n\n2\n00:01:01,250 --> 01:02:03,004\nनमस्ते\n"); });
  it("writes VTT with a header and dot milliseconds", () => { expect(toVtt(captions)).toBe("WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nHello → world\n\n00:01:01.250 --> 01:02:03.004\nनमस्ते\n"); });
});

describe("captions 2.0", () => {
  const timed: Caption[] = [{ id: "k", start: 0, end: 2, text: "one two three", words: [{ text: "one", start: 0, end: 0.5 }, { text: "two", start: 0.6, end: 1.1 }, { text: "three", start: 1.2, end: 2 }] }];
  const texts = (style: typeof PRESETS.word.style, t: number) => { const { ctx, calls } = fakeContext(); drawCaption(ctx, timed, t, style, 1080, 1920); return calls.filter(c => c.op === "text"); };
  it("progressive reveal draws only words already started", () => { expect(texts(PRESETS.bold.style, 0.7).map(c => c.text)).toEqual(["ONE", "TWO"]); });
  it("karaoke colours finished words and fills the current one", () => {
    const calls = texts(PRESETS.karaoke.style, 0.8);
    expect(calls[0].fill).toBe(PRESETS.karaoke.style.highlight); expect(calls.filter(c => c.text === "two")).toHaveLength(2); // base + clipped fill
  });
  it("falls back to whole captions without word timings", () => {
    const { ctx, calls } = fakeContext(); drawCaption(ctx, [{ id: "n", start: 0, end: 2, text: "one two three" }], 0.7, PRESETS.bold.style, 1080, 1920);
    expect(calls.filter(c => c.op === "text").map(c => c.text)).toEqual(["ONE", "TWO", "THREE"]);
  });
  it("a spelling fix keeps word timings; a word-count change drops them", () => {
    expect(setText(timed, 0, "one too three")[0].words?.[1]).toEqual({ text: "too", start: 0.6, end: 1.1 });
    expect(setText(timed, 0, "one three")[0].words).toBeUndefined();
  });
  it("respects characters per line and the caption box width", () => {
    const { ctx } = fakeContext();
    expect(layoutCaption(ctx, "aaaa bbbb cccc dddd", { ...PRESETS.clean.style, maxWords: 10, maxChars: 9 }, 1080, 1920).lines).toHaveLength(2);
  });
  it("offers fifteen distinct presets", () => {
    const presets = Object.values(PRESETS); expect(presets).toHaveLength(15);
    expect(new Set(presets.map(p => JSON.stringify({ ...p.style, preset: "" }))).size).toBe(15);
  });
});

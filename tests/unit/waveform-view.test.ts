import { describe, expect, it } from "vitest";
import { MIN_SELECTION, maxZoom, nudge, nudgeStep, reducePeaks, viewFor, zoomAround } from "@/lib/media/waveformView";

describe("visible window", () => {
  it("fits the whole file at zoom 1 and never leaves the file", () => {
    expect(viewFor(60, 1, 10)).toEqual({ start: 0, end: 60 });
    expect(viewFor(60, 4, 50)).toEqual({ start: 45, end: 60 });
    expect(viewFor(60, 4, -5)).toEqual({ start: 0, end: 15 });
  });
  it("caps zoom so the window is at least half a second", () => {
    expect(maxZoom(60)).toBe(120);
    const view = viewFor(60, 10000, 30); expect(view.end - view.start).toBeCloseTo(0.5, 6);
    expect(maxZoom(0.3)).toBe(1);
  });
  it("keeps the anchor time at the same screen position when zooming", () => {
    const { zoom, view } = zoomAround(100, { start: 0, end: 100 }, 4, 50);
    expect(zoom).toBe(4); expect(view).toEqual({ start: 37.5, end: 62.5 });
    const edge = zoomAround(100, { start: 0, end: 100 }, 4, 0); expect(edge.view.start).toBe(0);
  });
});

describe("peak reduction", () => {
  const fine = Float32Array.from({ length: 1000 }, (_, i) => i / 1000); // 10 s at 100 per second
  it("takes the maximum of each bucket over the visible window only", () => {
    const out = reducePeaks(fine, 0, 10, { start: 2, end: 4 }, 100)!;
    expect(out).toHaveLength(100); expect(out[0]).toBeCloseTo(0.201, 3); expect(out[99]).toBeCloseTo(0.399, 3);
  });
  it("asks for worker detail when the window has fewer fine peaks than bars", () => {
    expect(reducePeaks(fine, 0, 10, { start: 2, end: 2.5 }, 100)).toBeNull();
  });
  it("rejects a window outside the fine range", () => { expect(reducePeaks(fine, 0, 10, { start: 9, end: 11 }, 10)).toBeNull(); });
});

describe("keyboard nudging", () => {
  it("uses 0.1 s, Shift 1 s, Alt 0.01 s and PageUp 5 s", () => {
    expect(nudgeStep("ArrowRight", false, false)).toBe(0.1); expect(nudgeStep("ArrowLeft", true, false)).toBe(-1);
    expect(nudgeStep("ArrowUp", false, true)).toBe(0.01); expect(nudgeStep("PageUp", false, false)).toBe(5); expect(nudgeStep("a", false, false)).toBe(0);
  });
  it("never crosses the other edge or leaves the file", () => {
    expect(nudge(2, 2.15, "start", 1, 10)).toEqual([2.05, 2.15]);
    expect(nudge(2, 5, "end", -10, 10)).toEqual([2, 2 + MIN_SELECTION]);
    expect(nudge(0.05, 5, "start", -1, 10)).toEqual([0, 5]);
    expect(nudge(2, 9.95, "end", 1, 10)).toEqual([2, 10]);
  });
});

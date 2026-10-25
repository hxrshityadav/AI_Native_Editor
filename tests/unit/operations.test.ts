import { describe, expect, it } from "vitest";
import { applyOperations, captionLines, captionsFromLines, editPlanSchema, moveOverlay, snapPosition, videoSegments } from "@/lib/editor/operations";
import { changeEditing, defaultEditing, redoEditing, undoEditing } from "@/lib/editor/project";
import { remapCaptionLines } from "@/lib/editor/timeline";

const base = () => captionsFromLines([{ start: 1, end: 3, text: "Hello world", words: [{ text: "Hello", start: 1, end: 2 }, { text: "world", start: 2, end: 3 }] }]);
describe("shared manual and AI operations", () => {
  it("rejects unavailable AI font references before changing settings", () => { expect(() => applyOperations(defaultEditing(), [], [{ type: "global_style", appearance: { font: "invented" } }], 6, ["poppins"])).toThrow(/font is unavailable/); });
  it("adds manual captions without a transcript", () => { const next = applyOperations(defaultEditing(), [], [{ type: "caption_add", start: 0, end: 2, text: "Manual text" }], 6); expect(next.captions?.[0]).toMatchObject({ start: 0, end: 2, estimated: true }); expect(next.captions?.[0].words[1]).toEqual({ text: "text", start: 1, end: 2 }); });
  it("moves and scales word timing as metadata", () => { const next = applyOperations(defaultEditing(), base(), [{ type: "caption_time", id: base()[0].id, start: 2, end: 6 }], 6); expect(next.captions?.[0].words).toEqual([{ text: "Hello", start: 2, end: 4 }, { text: "world", start: 4, end: 6 }]); });
  it("rejects overlapping, reversed, out of range and too short captions atomically", () => {
    const original = defaultEditing(); const snapshot = JSON.stringify(original);
    for (const [start, end] of [[2, 4], [4, 2], [5, 7], [4, 4.01]]) expect(() => applyOperations(original, base(), [{ type: "global_style", appearance: { textColor: "#FF0000" } }, { type: "caption_add", text: "bad", start, end }], 6)).toThrow();
    expect(JSON.stringify(original)).toBe(snapshot);
  });
  it("splits and merges without losing word timing and style", () => {
    const captions = base(); captions[0].appearance.textColor = "#00FF00";
    const split = applyOperations(defaultEditing(), captions, [{ type: "caption_split", id: captions[0].id, time: 2 }], 6);
    expect(split.captions).toHaveLength(2); expect(split.captions?.[1].appearance.textColor).toBe("#00FF00");
    const merged = applyOperations(split, [], [{ type: "caption_merge", id: captions[0].id }], 6); expect(merged.captions?.[0].words).toEqual(captions[0].words); expect(merged.captions).toHaveLength(1);
  });
  it("preserves per-caption overrides across global style changes and remaps", () => {
    const captions = base(); const settings = applyOperations(defaultEditing(), captions, [{ type: "caption_style", id: captions[0].id, appearance: { textColor: "#00FF00", horizontalPosition: 0.2 } }, { type: "global_style", appearance: { textColor: "#FFFF00" } }, { type: "cut", start: 0, end: 0.5 }], 6);
    expect(settings.appearance.textColor).toBe("#FFFF00");
    const mapped = remapCaptionLines(captionLines(settings.captions!), settings.cuts); expect(mapped[0]).toMatchObject({ start: 0.5, appearance: { textColor: "#00FF00", horizontalPosition: 0.2 } });
  });
  it("honors caption and overlay locks", () => {
    const captions = base(); captions[0].locked = true;
    expect(() => applyOperations(defaultEditing(), captions, [{ type: "caption_delete", id: captions[0].id }], 6)).toThrow(/Unlock/);
    expect(() => moveOverlay([{ id: "title", text: "Title", start: 0, end: 2, x: 0.5, y: 0.5, size: 0.05, color: "#FFFFFF", opacity: 1, locked: true, hidden: false }], "title", 0.1, 0.2)).toThrow(/unlock/);
  });
  it("clamps and snaps normalized positions independently of resolution", () => { expect(snapPosition(0.49)).toBe(0.5); expect(snapPosition(0.11)).toBe(0.1); expect(snapPosition(20)).toBe(0.95); expect(snapPosition(-1)).toBe(0.05); expect(() => snapPosition(NaN)).toThrow(); });
  it("splits retained clips and deletes source ranges without changing source", () => {
    let settings = applyOperations(defaultEditing(), [], [{ type: "trim", start: 1, end: 5 }, { type: "video_split", time: 3 }], 6);
    expect(videoSegments(settings, 6).map(({ start, end }) => [start, end])).toEqual([[1, 3], [3, 5]]);
    settings = applyOperations(settings, [], [{ type: "cut", start: 1, end: 3 }], 6);
    expect(videoSegments(settings, 6).map(({ start, end, outputStart }) => [start, end, outputStart])).toEqual([[3, 5, 0]]);
    expect(() => applyOperations(settings, [], [{ type: "cut", start: 3, end: 5 }], 6)).toThrow(/Keep/);
  });
  it("undoes caption, cut, audio and global edits in one metadata history", () => {
    const original = defaultEditing(); let history = { current: original, past: [], future: [] } as Parameters<typeof changeEditing>[0];
    const next = applyOperations(original, [], [{ type: "caption_add", start: 0, end: 1, text: "Text" }, { type: "audio", muted: true, volume: 0.5 }, { type: "cut", start: 4, end: 6 }], 6);
    history = changeEditing(history, next); expect(undoEditing(history).current).toEqual(original); expect(redoEditing(undoEditing(history)).current).toEqual(next); expect(JSON.stringify(next)).not.toMatch(/blob:|File/);
  });
  it("rejects unknown operations and nested script fields", () => {
    expect(editPlanSchema.safeParse({ summary: "Run", operations: [{ type: "execute", code: "alert(1)" }] }).success).toBe(false);
    expect(editPlanSchema.safeParse({ summary: "Style", operations: [{ type: "global_style", appearance: { script: "x" } }] }).success).toBe(false);
    expect(editPlanSchema.safeParse({ summary: "Style", operations: [{ type: "global_style", appearance: { textColor: "red" } }] }).success).toBe(false);
  });
});

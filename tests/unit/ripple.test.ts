import { describe, expect, it } from "vitest";
import { applyOperations, timelineGaps, videoSegments } from "@/lib/editor/operations";
import { defaultEditing, changeEditing, undoEditing, redoEditing } from "@/lib/editor/project";
import { editedToSource, sourceToEdited, retainedPieces, remapCaptionLines } from "@/lib/editor/timeline";

const fixture = () => applyOperations(defaultEditing(), [], [{ type: "video_split", time: 10 }, { type: "video_split", time: 15 }], 25);
describe("ripple gaps over a source EDL", () => {
  it("distinguishes delete leaving a gap from closing that gap", () => {
    const settings = fixture(); const middle = videoSegments(settings, 25)[1];
    const deleted = applyOperations(settings, [], [{ type: "video_delete", id: middle.id, ripple: false }], 25);
    expect(sourceToEdited(25, deleted.cuts)).toBe(25);
    expect(videoSegments(deleted, 25)[1]).toMatchObject({ start: 15, end: 25, outputStart: 15, outputEnd: 25 });
    const closed = applyOperations(deleted, [], [{ type: "remove_gap", id: timelineGaps(deleted, 25)[0].id }], 25);
    expect(closed.gaps).toEqual([]); expect(sourceToEdited(25, closed.cuts)).toBe(20);
    expect(videoSegments(closed, 25)[1]).toMatchObject({ start: 15, end: 25, outputStart: 10, outputEnd: 20 });
    expect(middle).toMatchObject({ start: 10, end: 15 }); expect(settings.cuts).toEqual([]);
    expect(() => applyOperations(closed, [], [{ type: "remove_gap", id: timelineGaps(deleted, 25)[0].id }], 25)).toThrow(/existing gap/);
  });
  it("closes multiple gaps in either order, preserving neighboring source intervals", () => {
    let settings = applyOperations(fixture(), [], [{ type: "video_split", time: 20 }, { type: "video_split", time: 22 }], 25);
    const clips = videoSegments(settings, 25);
    settings = applyOperations(settings, [], [clips[1], clips[3]].map((clip) => ({ type: "video_delete", id: clip.id, ripple: false })), 25);
    const gaps = timelineGaps(settings, 25);
    settings = applyOperations(settings, [], [{ type: "remove_gap", id: gaps[1].id }, { type: "remove_gap", id: gaps[0].id }], 25);
    expect(videoSegments(settings, 25).map(({ start, end, outputStart, outputEnd }) => [start, end, outputStart, outputEnd])).toEqual([[0, 10, 0, 10], [15, 20, 10, 15], [22, 25, 15, 18]]);
  });
  it("ripple deletes a split clip and supports a subsequent trim", () => {
    let settings = fixture(); settings = applyOperations(settings, [], [{ type: "video_delete", id: videoSegments(settings, 25)[1].id, ripple: true }], 25);
    expect(settings.gaps).toEqual([]);
    settings = applyOperations(settings, [], [{ type: "cut", start: 15, end: 17 }], 25);
    expect(videoSegments(settings, 25)[1]).toMatchObject({ start: 17, end: 25, outputStart: 10, outputEnd: 18 });
  });
  it("maps seeking and trim boundaries correctly on either side of the join", () => {
    const cuts = [{ start: 10, end: 15 }];
    expect(editedToSource(10, cuts)).toBe(15); expect(editedToSource(10, cuts, "end")).toBe(10);
    expect(editedToSource(10.01, cuts)).toBeCloseTo(15.01); expect(sourceToEdited(12, cuts)).toBe(10);
    for (const time of [0, 9, 15, 24]) expect(editedToSource(sourceToEdited(time, cuts), cuts)).toBe(time);
  });
  it("retains portions of overlapping captions and shared A/V sample intervals at the seam", () => {
    const cuts = [{ start: 10, end: 15 }];
    const line = { id: "caption", start: 9, end: 16, appearance: { verticalPosition: 0.3 }, animation: { effect: "fade" as const, duration: 0.2, intensity: 0.5 }, text: "left gone right", words: [{ text: "left", start: 9, end: 11 }, { text: "gone", start: 12, end: 14 }, { text: "right", start: 15, end: 16 }] };
    const [mapped] = remapCaptionLines([line], cuts); expect(mapped.text).toBe("left right"); expect(mapped.words).toEqual([{ text: "left", start: 9, end: 10 }, { text: "right", start: 10, end: 11 }]); expect(mapped).toMatchObject({ start: 9, end: 11, appearance: line.appearance, animation: line.animation });
    const samples = retainedPieces(9.99, 15.01, cuts).map((p) => ({ start: sourceToEdited(p.start, cuts), end: sourceToEdited(p.end, cuts) })); expect(samples[0].end).toBe(samples[1].start);
  });
  it("restores gaps and output duration through undo and redo", () => {
    const before = applyOperations(fixture(), [], [{ type: "video_delete", id: videoSegments(fixture(), 25)[1].id, ripple: false }], 25);
    const after = applyOperations(before, [], [{ type: "remove_gap", id: timelineGaps(before, 25)[0].id }], 25);
    const history = changeEditing({ current: before, past: [], future: [] }, after);
    expect(undoEditing(history).current).toEqual(before); expect(redoEditing(undoEditing(history)).current).toEqual(after);
  });
  it("leaves legacy saved cuts rippled and validates selections", () => {
    const old = { ...defaultEditing(), cuts: [{ start: 10, end: 15 }] };
    expect(videoSegments(old, 25).map((clip) => [clip.outputStart, clip.outputEnd])).toEqual([[0, 10], [10, 20]]); expect(timelineGaps(old, 25)).toEqual([]);
    expect(() => applyOperations(old, [], [{ type: "video_delete", id: "missing", ripple: true }], 25)).toThrow(/existing video/);
  });
});

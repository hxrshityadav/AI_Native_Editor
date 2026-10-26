import { describe, it, expect } from "vitest";
import type { MediaItem } from "@openreel/core";
import { convertLegacy, migrationProblems } from "./legacy-convert";
import { editingSchema } from "../../../../../../src/lib/editor/project";
import { readCaption } from "./caption-data";
const media: MediaItem = { id: "media", name: "local.mp4", type: "video", blob: new Blob(), fileHandle: null, thumbnailUrl: null, waveformData: null, metadata: { width: 320, height: 180, duration: 8, frameRate: 30, sampleRate: 48000, channels: 2, codec: "avc", fileSize: 0 } };
describe("legacy conversion", () => {
  it("keeps cuts, blank gaps, split markers, source intervals and audio settings", () => {
    const settings = editingSchema.parse({ exportPreset: "original", cuts: [{ start: 2, end: 3 }], gaps: [{ start: 4, end: 5 }], splits: [6], audio: { volume: 0.3 } });
    const before = JSON.stringify(settings), project = convertLegacy(settings, [], media);
    expect(JSON.stringify(settings)).toBe(before); expect(project.id).not.toBe("media"); expect(project.mediaLibrary.items[0]).toBe(media);
    expect(project.timeline.tracks[0].clips.map((clip) => [clip.startTime, clip.duration, clip.inPoint, clip.outPoint])).toEqual([[0, 2, 0, 2], [2, 1, 3, 4], [4, 1, 5, 6], [5, 2, 6, 8]]);
    expect(project.timeline.tracks[0].clips.every((clip) => clip.volume === 0.3)).toBe(true);
  });
  it("preserves caption words, overrides, Hindi, animation and locks in a versioned extension", () => {
    const settings = editingSchema.parse({ exportPreset: "original", cuts: [{ start: 2, end: 3 }], appearance: { font: "hind", strokeRatio: 0.2 }, captions: [{ id: "cap", start: 3, end: 5, words: [{ text: "नमस्ते", start: 3, end: 4 }, { text: "doston", start: 4, end: 5 }], appearance: { textColor: "#ff0000", horizontalPosition: 0.3 }, locked: true, animation: { effect: "bounce", duration: 0.3, intensity: 0.5 } }] });
    const project = convertLegacy(settings, [], media), clip = project.textClips![0], data = readCaption(clip)!;
    expect(clip.startTime).toBe(2); expect(clip.duration).toBe(2); expect(clip.text).toBe("नमस्ते doston"); expect(data.words[0].start).toBe(0);
    expect({ ...data.baseAppearance, ...data.appearance }).toMatchObject({ font: "hind", strokeRatio: 0.2, textColor: "#ff0000", horizontalPosition: 0.3 });
    expect(data.animation.effect).toBe("bounce"); expect(project.timeline.tracks.find((track) => track.id === clip.trackId)?.locked).toBe(true);
  });
  it("reports trailing gaps before migration rather than dropping their duration", () => {
    expect(migrationProblems(editingSchema.parse({ gaps: [{ start: 6, end: 8 }] }), 8)).toEqual([expect.stringMatching(/empty gap/)]);
  });
  it("preserves explicit text overlays and composition", () => {
    const settings = editingSchema.parse({ exportPreset: "original", framing: "fit", composition: { ratio: "1:1", scale: 1.2, x: 0.3, blur: true, background: "#123456" }, overlays: [{ id: "title", text: "Title", start: 1, end: 3, x: 0.2, y: 0.4, size: 0.06, color: "#ff0000", opacity: 0.8 }] });
    const project = convertLegacy(settings, [], media); expect(project.settings.width).toBe(project.settings.height); expect(project.timeline.backgroundFillMode).toBe("blur"); expect(project.timeline.layoutBackgroundColor).toBe("#123456");
    const clip = project.textClips![0]; expect(readCaption(clip)?.kind).toBe("overlay"); expect(clip.transform.position).toEqual({ x: 0.2, y: 0.4 });
  });
});

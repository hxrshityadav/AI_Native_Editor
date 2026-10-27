import { describe, expect, it } from "vitest";
import { captionExtension, estimatedWords, currentWords, sliceCaption } from "./caption-data";
import { makeCaption, srtCaptions, captionTrack } from "./caption-project";
import { createEmptyProject } from "../stores/project/project-helpers";
import { nativeCaptionStyle } from "./native-caption-style";
import { getCaptionStyle } from "../../../../../../src/lib/captions/styles";
import { FONT_CATALOG } from "../../../../../../src/lib/editor/fontLibrary";
const data = { version: 1 as const, styleId: "clean", kind: "caption" as const, appearance: {}, animation: { effect: "none" as const, duration: 0.25, intensity: 0.5 }, timing: "verified-words" as const, words: estimatedWords("one two three four", 8), referenceDuration: 8, referenceFontSize: 1 };
describe("versioned captions", () => {
  it("rejects zero, backwards, unordered and out-of-bounds word times", () => {
    for (const words of [[{ text: "a", start: 1, end: 1 }], [{ text: "a", start: 1, end: 0 }], [{ text: "a", start: 0, end: 9 }], [{ text: "a", start: 2, end: 3 }, { text: "b", start: 0, end: 1 }]]) expect(() => captionExtension.parse({ ...data, words })).toThrow();
    expect(() => captionExtension.parse({ ...data, version: 2 })).toThrow();
  });
  it("keeps explicit per-caption overrides over shared brand defaults", () => {
    const clip = makeCaption(createEmptyProject("Style"), "track", "one two three four", 0, 8, { ...data, baseAppearance: { textColor: "#ff0000", verticalPosition: 0.8, fontSizeRatio: 0.06 }, appearance: { textColor: "#00ff00", horizontalPosition: 0.3 } });
    expect(clip.style.color).toBe("#00ff00"); expect(clip.transform.position).toEqual({ x: 0.3, y: 0.8 }); expect(clip.style.fontSize).toBe(1080 * 0.06);
    expect(JSON.stringify(clip.metadata)).not.toContain("blob");
  });
  it("slices words at native split boundaries without duplicating a full caption", () => {
    const clip = makeCaption(createEmptyProject("Split"), "track", "one two three four", 0, 8, data);
    expect(sliceCaption(clip, 0, 4).text).toBe("one two"); expect(sliceCaption(clip, 4, 8).text).toBe("three four");
  });
  it("treats edited native text as estimated timing instead of retaining stale word offsets", () => {
    const clip = makeCaption(createEmptyProject("Edit"), "track", "updated text", 0, 8, data);
    expect(currentWords(clip, data)).toEqual(estimatedWords("updated text", 8));
  });
  it("exports caption cues without ordinary title overlays or hidden tracks", () => {
    const project = createEmptyProject("SRT"), track = captionTrack(), hidden = captionTrack("Hidden", { hidden: true });
    const caption = makeCaption(project, track.id, "caption", 0, 8, { ...data, timing: "estimated", words: estimatedWords("caption", 8) });
    const overlay = makeCaption(project, track.id, "title", 0, 8, { ...data, kind: "overlay", words: estimatedWords("title", 8) });
    expect(srtCaptions({ ...project, timeline: { ...project.timeline, tracks: [track, hidden] }, textClips: [caption, overlay, { ...caption, id: "hidden", trackId: hidden.id }] }).map((line) => line.text)).toEqual(["caption"]);
  });
  it("keeps native font, outline and spacing controls effective for extension captions", () => {
    const clip = makeCaption(createEmptyProject("Native styles"), "track", "one two three four", 0, 8, data);
    const extension = captionExtension.parse(clip.metadata?.reelFinisher);
    const rendered = nativeCaptionStyle(getCaptionStyle("clean"), { ...clip.style, fontFamily: "RF Mukta", fontWeight: 400, strokeWidth: 0, letterSpacing: 4, lineHeight: 1.8 }, extension, FONT_CATALOG);
    expect(rendered.customFont?.family).toBe("RF Mukta"); expect(rendered.weight).toBe(400); expect(rendered.strokeRatio).toBe(0); expect(rendered.lineSpacing).toBe(1.8); expect(rendered.letterSpacing).toBe(4 / clip.style.fontSize);
  });
});

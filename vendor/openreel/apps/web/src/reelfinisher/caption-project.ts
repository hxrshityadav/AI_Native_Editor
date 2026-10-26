import type { TextClip, Project, Track } from "@openreel/core";
import { DEFAULT_TEXT_STYLE, DEFAULT_TEXT_TRANSFORM } from "@openreel/core/text/types";
import { getCaptionStyle } from "../../../../../../src/lib/captions/styles";
import { applyAppearance } from "../../../../../../src/lib/captions/appearance";
import { CAPTION_FONTS } from "../../../../../../src/lib/captions/fonts";
import { FONT_CATALOG, type FontRecord } from "../../../../../../src/lib/editor/fontLibrary";
import { captionExtension, readCaption, type CaptionExtension } from "./caption-data";

export function captionTrack(name = "Captions", properties: Partial<Track> = {}): Track {
  return { id: crypto.randomUUID(), type: "text", role: "captions", name, clips: [], transitions: [], locked: false, hidden: false, muted: false, solo: false, ...properties };
}
export function srtCaptions(project: Project) {
  const hidden = new Set(project.timeline.tracks.filter((track) => track.hidden).map((track) => track.id));
  return (project.textClips ?? []).filter((clip) => {
    const data = readCaption(clip);
    return !hidden.has(clip.trackId) && (data ? data.kind === "caption" : typeof clip.metadata?.captionSource === "string");
  }).sort((a, b) => a.startTime - b.startTime).map((clip) => ({ text: clip.text, words: [], start: clip.startTime, end: clip.startTime + clip.duration }));
}
export function makeCaption(project: Project, trackId: string, text: string, startTime: number, duration: number, extension: CaptionExtension, fonts: FontRecord[] = FONT_CATALOG): TextClip {
  const data = captionExtension.parse(extension);
  const style = applyAppearance(getCaptionStyle(data.styleId), { ...data.baseAppearance, ...data.appearance }, data.animation, fonts);
  const size = style.fontSizeRatio * project.settings.height;
  return { id: crypto.randomUUID(), trackId, startTime, duration, text, keyframes: [],
    style: { ...DEFAULT_TEXT_STYLE, fontFamily: style.customFont?.family ?? CAPTION_FONTS[style.font].family, fontSize: size, fontWeight: "bold", color: style.textColor },
    transform: { ...DEFAULT_TEXT_TRANSFORM, position: { x: style.horizontalPosition ?? 0.5, y: style.verticalPosition } },
    metadata: { captionSource: "reel-finisher", reelFinisher: { ...data, referenceFontSize: size } } };
}

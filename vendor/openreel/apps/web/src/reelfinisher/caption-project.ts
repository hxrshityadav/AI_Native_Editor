import type { TextClip, TextStyle, Project, Track } from "@openreel/core";
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
  const nativeStyle: TextStyle = { ...DEFAULT_TEXT_STYLE, fontFamily: style.customFont?.family ?? CAPTION_FONTS[style.font].family, fontSize: size,
    fontWeight: (style.weight ?? style.customFont?.weights[0] ?? CAPTION_FONTS[style.font].weight) as TextStyle["fontWeight"], fontStyle: style.italic ? "italic" : "normal", color: style.textColor,
    strokeColor: style.strokeColor, strokeWidth: size * style.strokeRatio, backgroundColor: style.box?.fill,
    textAlign: style.align ?? "center", lineHeight: style.lineSpacing ?? 1.3, letterSpacing: (style.letterSpacing ?? 0) * size,
    shadowColor: style.shadow ? style.shadowColor ?? "rgba(0,0,0,0.75)" : undefined,
    shadowBlur: style.shadow ? size * (style.shadowBlur ?? 0.3) : 0,
    shadowOffsetX: style.shadow ? size * (style.shadowX ?? 0) : 0, shadowOffsetY: style.shadow ? size * (style.shadowY ?? 0.06) : 0 };
  return { id: crypto.randomUUID(), trackId, startTime, duration, text, keyframes: [],
    style: nativeStyle,
    transform: { ...DEFAULT_TEXT_TRANSFORM, position: { x: style.horizontalPosition ?? 0.5, y: style.verticalPosition } },
    metadata: { captionSource: "reel-finisher", reelFinisher: { ...data, referenceFontSize: size, nativeReference: nativeStyle } } };
}

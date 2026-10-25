import { CAPTION_FONTS, type CaptionFontId } from "./fonts";
import type { CaptionStyle } from "./types";
import type { Appearance, Animation } from "../editor/project";
import type { FontRecord } from "../editor/fontLibrary";

export function applyAppearance(base: CaptionStyle, appearance: Appearance, animation: Animation, fonts: FontRecord[]): CaptionStyle {
  const { font, ...overrides } = appearance;
  const highlight = appearance.highlightEnabled === false ? { kind: "none" as const }
    : appearance.highlightColor || appearance.highlightEnabled === true
      ? base.highlight.kind === "pill" ? { ...base.highlight, fill: appearance.highlightColor ?? base.highlight.fill }
        : { kind: "color" as const, color: appearance.highlightColor ?? "#FFD60A" } : base.highlight;
  const opacity = appearance.boxOpacity;
  return { ...base, ...overrides, animation, highlight,
    font: font && font in CAPTION_FONTS ? font as CaptionFontId : base.font,
    customFont: font ? !(font in CAPTION_FONTS) ? fonts.find((item) => item.id === font) : undefined : base.customFont,
    box: opacity === 0 ? null : appearance.boxColor || opacity !== undefined
      ? { fill: hexRgba(appearance.boxColor ?? "#000000", opacity ?? 0.72) } : base.box };
}
export function hexRgba(hex: string, opacity: number) {
  return `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${opacity})`;
}

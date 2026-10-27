import { DEFAULT_TEXT_STYLE, type TextStyle } from "@openreel/core/text/types";
import { CAPTION_FONTS } from "../../../../../../src/lib/captions/fonts";
import type { CaptionStyle } from "../../../../../../src/lib/captions/types";
import type { FontRecord } from "../../../../../../src/lib/editor/fontLibrary";
import type { CaptionExtension } from "./caption-data";

/** Native inspector edits override extension defaults without discarding unrepresented settings. */
export function nativeCaptionStyle(base: CaptionStyle, native: TextStyle, data: CaptionExtension, fonts: FontRecord[]): CaptionStyle {
  const reference = data.nativeReference ?? { ...DEFAULT_TEXT_STYLE, fontFamily: base.customFont?.family ?? CAPTION_FONTS[base.font].family, fontSize: data.referenceFontSize, color: base.textColor };
  let style = { ...base };
  const changed = (key: keyof TextStyle) => native[key] !== reference[key];
  const size = Math.max(1, native.fontSize);
  if (changed("fontFamily")) {
    const font = fonts.find((font) => font.family === native.fontFamily);
    style = { ...style, customFont: font ?? { id: "native-family", label: native.fontFamily, family: native.fontFamily, category: "Sans Serif", weights: [400] } };
  }
  if (changed("fontWeight")) style.weight = typeof native.fontWeight === "number" ? native.fontWeight : native.fontWeight === "bold" ? 700 : 400;
  if (changed("fontStyle")) style.italic = native.fontStyle === "italic";
  if (changed("letterSpacing")) style.letterSpacing = native.letterSpacing / size;
  if (changed("lineHeight")) style.lineSpacing = native.lineHeight;
  if (changed("textAlign") && native.textAlign !== "justify") style.align = native.textAlign;
  if (changed("strokeWidth")) style.strokeRatio = (native.strokeWidth ?? 0) / size;
  if (changed("strokeColor")) style.strokeColor = native.strokeColor ?? "#000000";
  if (changed("backgroundColor")) style.box = native.backgroundColor && native.backgroundColor !== "transparent" ? { fill: native.backgroundColor } : null;
  if (["shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY"].some((key) => changed(key as keyof TextStyle))) {
    style = { ...style, shadow: !!native.shadowColor, shadowColor: native.shadowColor, shadowBlur: (native.shadowBlur ?? 0) / size, shadowX: (native.shadowOffsetX ?? 0) / size, shadowY: (native.shadowOffsetY ?? 0) / size };
  }
  return style;
}

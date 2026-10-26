import { titleEngine } from "@openreel/core/text/title-engine";
import { textAnimationEngine } from "@openreel/core/text/text-animation";
import { drawCaption, type TextBounds } from "../../../../../../src/lib/captions/draw";
import { getCaptionStyle } from "../../../../../../src/lib/captions/styles";
import { applyAppearance } from "../../../../../../src/lib/captions/appearance";
import { FONT_CATALOG, listLocalFonts, loadLibraryFont, type FontRecord } from "../../../../../../src/lib/editor/fontLibrary";
import { readCaption, currentWords } from "./caption-data";

let fonts: FontRecord[] = [...FONT_CATALOG];
let pending: Promise<void> | undefined;
export function ensureLocalCaptionFonts(refresh = false): Promise<void> {
  if (refresh) pending = undefined;
  return pending ??= (async () => {
    fonts = [...FONT_CATALOG, ...await listLocalFonts()];
    await Promise.all(fonts.map((font) => loadLibraryFont(font, document.fonts)));
  })().catch((error) => { pending = undefined; throw error; });
}
titleEngine.registerCaptionRenderer((clip, width, height, time) => {
  const data = readCaption(clip)!;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  const state = textAnimationEngine.getAnimatedState(clip, time);
  let style = applyAppearance(getCaptionStyle(data.styleId), { ...data.baseAppearance, ...data.appearance }, data.animation, fonts);
  // Native position, size, opacity and color controls remain authoritative.
  style = { ...style, additionalFonts: fonts,
    fontSizeRatio: style.fontSizeRatio * state.style.fontSize / data.referenceFontSize,
    textColor: state.style.color, horizontalPosition: state.transform.position.x,
    verticalPosition: state.transform.position.y,
    highlight: data.timing === "verified-words" && data.words.map((word) => word.text).join(" ") === clip.text.trim() ? style.highlight : { kind: "none" },
  };
  const words = currentWords(clip, data);
  let bounds: TextBounds = { x: 0, y: 0, width: 0, height: 0 };
  ctx.save();
  const x = width * state.transform.position.x, y = height * state.transform.position.y;
  ctx.translate(x, y); ctx.rotate(state.transform.rotation * Math.PI / 180);
  ctx.scale(state.transform.scale.x, state.transform.scale.y);
  ctx.translate(-x, -y);
  ctx.globalAlpha = state.opacity;
  drawCaption(ctx, { text: clip.text, words, start: 0, end: clip.duration }, time,
    { ...style, opacity: (style.opacity ?? 1) * state.opacity }, width, height, (value) => { bounds = value; });
  ctx.restore();
  return { canvas, width, height, textMetrics: { width: bounds.width, height: bounds.height,
    lines: [{ text: clip.text, width: bounds.width, height: bounds.height, baseline: bounds.y + bounds.height }] } };
});

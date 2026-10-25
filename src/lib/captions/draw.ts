import { captionFont } from "./fonts";
import { animationFrame } from "./animation";
import { applyAppearance } from "./appearance";
import { FONT_CATALOG } from "../editor/fontLibrary";
import { layoutWords } from "./layout";
import type { CaptionLine, CaptionStyle } from "./types";

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type TextBounds = { x: number; y: number; width: number; height: number };

/**
 * Draws one caption line onto a frame of size width x height, highlighting the
 * word being spoken at time `t` as the style says.
 */
export function drawCaption(
  ctx: Ctx2D,
  line: CaptionLine,
  t: number,
  style: CaptionStyle,
  width: number,
  height: number,
  onBounds?: (bounds: TextBounds) => void,
): void {
  if (line.appearance || line.animation) style = applyAppearance(style, line.appearance ?? {}, line.animation ?? style.animation ?? { effect: "none", duration: 0.25, intensity: 0.5 }, style.additionalFonts ?? FONT_CATALOG);
  let fontSize = Math.round(height * style.fontSizeRatio);
  ctx.save();
  const setFont = () => {
    const fallback = captionFont(style.font, fontSize);
    const family = style.customFont ? `"${style.customFont.family}", ` : "";
    ctx.font = (style.italic ? "italic " : "") + (style.weight || style.customFont
      ? fallback.replace(/^\d+ /, String(style.weight ?? style.customFont?.weights[0] ?? 400) + " ") : fallback);
    if (family) ctx.font = ctx.font.replace(/px /, "px " + family);
    if ("letterSpacing" in ctx) ctx.letterSpacing = ((style.letterSpacing ?? 0) * fontSize) + "px";
  };
  setFont();
  const motion = animationFrame(style.animation, t, line.start, line.end);
  ctx.globalAlpha = (style.opacity ?? 1) * motion.opacity;
  if (motion.scale !== 1 || motion.y !== 0) {
    const anchorX = width * (style.horizontalPosition ?? 0.5), anchorY = height * style.verticalPosition;
    ctx.translate(anchorX, anchorY + height * motion.y);
    ctx.scale(motion.scale, motion.scale);
    ctx.translate(-anchorX, -anchorY);
  }
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, fontSize * style.strokeRatio);
  ctx.strokeStyle = style.strokeColor;

  const { highlight } = style;
  // A pill extends pillPad past each side of its word; widen words (not spaces) so it never touches a neighbour.
  let pillPad = highlight.kind === "pill" ? fontSize * 0.18 : 0;
  const measure = (s: string) => ctx.measureText(s).width + (s === " " ? 0 : pillPad * 2);
  const displayWords = line.words.map((word) => ({ ...word, text: style.transform === "uppercase" ? word.text.toUpperCase() : style.transform === "lowercase" ? word.text.toLowerCase() : word.text }));
  let layout = layoutWords(displayWords, width * style.maxWidthRatio, measure);
  for (let attempt = 0; attempt < 20 && (layout.rows > (style.maxLines ?? 5) || Math.max(...layout.rowWidths) > width * style.maxWidthRatio); attempt++) {
    fontSize = Math.max(1, fontSize * 0.85); setFont();
    pillPad = highlight.kind === "pill" ? fontSize * 0.18 : 0;
    layout = layoutWords(displayWords, width * style.maxWidthRatio, measure);
  }
  const lineHeight = fontSize * (style.lineSpacing ?? 1.3);
  const padX = fontSize * (style.boxPadding ?? 0.35);
  const blockWidth = Math.max(0, ...layout.rowWidths);
  const blockHeight = layout.rows * lineHeight;
  const blockTop = Math.max(0, Math.min(height - blockHeight, height * style.verticalPosition - blockHeight / 2));
  const left = Math.max(padX, Math.min(width - blockWidth - padX, width * (style.horizontalPosition ?? 0.5) - blockWidth / 2));
  onBounds?.({ x: left - padX, y: blockTop, width: blockWidth + 2 * padX, height: blockHeight });
  const rowLeft = (row: number) => left + (style.align === "left" ? 0 : style.align === "right" ? blockWidth - layout.rowWidths[row] : (blockWidth - layout.rowWidths[row]) / 2);

  if (style.box) {
    ctx.globalAlpha = motion.opacity;
    ctx.fillStyle = style.box.fill;
    for (let row = 0; row < layout.rows; row++) {
      ctx.beginPath();
      ctx.roundRect(rowLeft(row) - padX, blockTop + row * lineHeight, layout.rowWidths[row] + padX * 2, lineHeight, fontSize * (style.boxRadius ?? 0.25));
      ctx.fill();
    }
  }
  ctx.globalAlpha = (style.opacity ?? 1) * motion.opacity;

  if (style.shadow) {
    ctx.shadowColor = style.shadowColor ?? "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = fontSize * (style.shadowBlur ?? 0.3);
    ctx.shadowOffsetX = fontSize * (style.shadowX ?? 0);
    ctx.shadowOffsetY = fontSize * (style.shadowY ?? 0.06);
  }

  for (const item of layout.words) {
    const effect = style.animation?.effect;
    if ((effect === "reveal" || effect === "typewriter") && t < item.word.start) continue;
    const text = effect === "typewriter" ? revealText(item.word.text, Math.min(1, (t - item.word.start) / Math.max(0.001, item.word.end - item.word.start))) : item.word.text;
    const x = rowLeft(item.row) + item.x + pillPad;
    const y = blockTop + lineHeight * (item.row + 0.5);
    const active = highlight.kind !== "none" && t >= item.word.start && t < item.word.end;

    const pulse = effect === "pop" && t >= item.word.start && t < item.word.end
      ? 1 + (style.animation?.intensity ?? 0.5) * 0.2 * Math.sin(Math.PI * Math.min(1, (t - item.word.start) / Math.min(style.animation?.duration ?? 0.25, item.word.end - item.word.start))) : 1;
    if (pulse !== 1) { ctx.save(); ctx.translate(x + item.width / 2, y); ctx.scale(pulse, pulse); ctx.translate(-x - item.width / 2, -y); }
    if (active && highlight.kind === "pill") {
      // Centre on the glyphs' ink, not the em box: Devanagari ink sits high in the em box.
      const ink = ctx.measureText(item.word.text);
      const padY = fontSize * 0.14;
      ctx.fillStyle = highlight.fill;
      ctx.beginPath();
      ctx.roundRect(
        x - pillPad,
        y - ink.actualBoundingBoxAscent - padY,
        item.width,
        ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent + padY * 2,
        fontSize * 0.2,
      );
      ctx.fill();
      ctx.fillStyle = highlight.textColor;
    } else {
      if (style.strokeRatio > 0) ctx.strokeText(text, x, y);
      ctx.fillStyle = active && highlight.kind === "color" ? highlight.color : style.textColor;
    }
    ctx.fillText(text, x, y);
    if (pulse !== 1) ctx.restore();
  }
  ctx.restore();
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
function revealText(text: string, progress: number): string {
  const segments = [...graphemes.segment(text)].map((segment) => segment.segment);
  return segments.slice(0, Math.ceil(segments.length * Math.max(0, progress))).join("");
}

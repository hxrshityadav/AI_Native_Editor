import { captionFont } from "./fonts";
import { layoutWords } from "./layout";
import type { CaptionLine, CaptionStyle } from "./types";

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

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
): void {
  const fontSize = Math.round(height * style.fontSizeRatio);
  const lineHeight = fontSize * 1.3;
  const padX = fontSize * 0.35;
  ctx.save();
  ctx.font = captionFont(style.font, fontSize);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, fontSize * style.strokeRatio);
  ctx.strokeStyle = style.strokeColor;

  const { highlight } = style;
  // A pill extends pillPad past each side of its word; widen words (not spaces) so it never touches a neighbour.
  const pillPad = highlight.kind === "pill" ? fontSize * 0.18 : 0;
  const measure = (s: string) => ctx.measureText(s).width + (s === " " ? 0 : pillPad * 2);
  const layout = layoutWords(line.words, width * style.maxWidthRatio, measure);
  const blockTop = height * style.verticalPosition - (layout.rows * lineHeight) / 2;
  const rowLeft = (row: number) => (width - layout.rowWidths[row]) / 2;

  if (style.box) {
    ctx.fillStyle = style.box.fill;
    for (let row = 0; row < layout.rows; row++) {
      ctx.beginPath();
      ctx.roundRect(rowLeft(row) - padX, blockTop + row * lineHeight, layout.rowWidths[row] + padX * 2, lineHeight, fontSize * 0.25);
      ctx.fill();
    }
  }

  if (style.shadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = fontSize * 0.3;
    ctx.shadowOffsetY = fontSize * 0.06;
  }

  for (const item of layout.words) {
    const x = rowLeft(item.row) + item.x + pillPad;
    const y = blockTop + lineHeight * (item.row + 0.5);
    const active = highlight.kind !== "none" && t >= item.word.start && t < item.word.end;

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
      if (style.strokeRatio > 0) ctx.strokeText(item.word.text, x, y);
      ctx.fillStyle = active && highlight.kind === "color" ? highlight.color : style.textColor;
    }
    ctx.fillText(item.word.text, x, y);
  }
  ctx.restore();
}

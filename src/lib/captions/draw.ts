import { layoutWords } from "./layout";
import type { CaptionLine, CaptionStyle } from "./types";

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Draws one caption line onto a frame of size width x height. The word being
 * spoken at time `t` is drawn in the highlight colour.
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
  const lineHeight = fontSize * 1.25;
  ctx.save();
  ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, fontSize * style.strokeRatio);
  ctx.strokeStyle = style.strokeColor;

  const layout = layoutWords(line.words, width * style.maxWidthRatio, (s) => ctx.measureText(s).width);
  const blockTop = height * style.verticalPosition - (layout.rows * lineHeight) / 2;

  for (const item of layout.words) {
    const rowLeft = (width - layout.rowWidths[item.row]) / 2;
    const x = rowLeft + item.x;
    const y = blockTop + lineHeight * (item.row + 0.5);
    const active = t >= item.word.start && t < item.word.end;
    ctx.strokeText(item.word.text, x, y);
    ctx.fillStyle = active ? style.highlightColor : style.textColor;
    ctx.fillText(item.word.text, x, y);
  }
  ctx.restore();
}

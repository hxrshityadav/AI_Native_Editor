import type { TextOverlay } from "../editor/project";
import { drawCaption, type Ctx2D, type TextBounds } from "./draw";
import type { CaptionStyle } from "./types";
import { applyAppearance } from "./appearance";
import { FONT_CATALOG } from "../editor/fontLibrary";
import { sourceToEdited } from "../editor/timeline";
import type { Cut } from "../editor/project";

/** Ordinary source-timed titles. Segmentation is intentionally not implied by these overlays. */
export function drawOverlays(ctx: Ctx2D, overlays: readonly TextOverlay[], time: number, style: CaptionStyle, width: number, height: number, onBounds?: (id: string, bounds: TextBounds) => void, cuts: readonly Cut[] = []) {
  for (const overlay of overlays) {
    if (overlay.hidden || !overlay.text.trim() || time < overlay.start || time >= overlay.end) continue;
    const ownStyle = applyAppearance(style, { ...overlay.appearance, ...(overlay.font ? { font: overlay.font } : {}), ...(overlay.weight ? { weight: overlay.weight } : {}) }, overlay.animation ?? { effect: "none", duration: 0.25, intensity: 0.5 }, style.additionalFonts ?? FONT_CATALOG);
    const start = sourceToEdited(overlay.start, cuts), end = sourceToEdited(overlay.end, cuts);
    if (end <= start) continue;
    drawCaption(ctx, { start, end, text: overlay.text,
      words: overlay.text.split(/\s+/).map((text) => ({ text, start, end })) }, sourceToEdited(time, cuts),
      { ...ownStyle, fontSizeRatio: overlay.size, textColor: overlay.color, opacity: overlay.opacity,
        horizontalPosition: overlay.x, verticalPosition: overlay.y, highlight: { kind: "none" }, box: null }, width, height, (bounds) => onBounds?.(overlay.id, bounds));
  }
}

/*
 * Output frame composition for Subtitle Studio, shared by the preview canvas and the burned-in export.
 * The source video is never changed: it is drawn into an output frame of the chosen aspect ratio with
 * - contain: the whole picture, letterboxed on the background colour;
 * - cover: the frame filled, centred, edges cropped;
 * - crop: like cover, with user framing (pan x/y and zoom ≥ 1).
 */
export type Aspect = "source" | "9:16" | "4:3" | "16:9" | "1:1";
export type Fit = "contain" | "cover" | "crop";
export type Framing = { x: number; y: number; zoom: number };
export type Composition = { aspect: Aspect; fit: Fit; framing: Framing; background: string; scale: number };
export const DEFAULT_COMPOSITION: Composition = { aspect: "source", fit: "contain", framing: { x: 0.5, y: 0.5, zoom: 1 }, background: "#000000", scale: 1 };

/** Full-size output for each aspect ratio. `scale` (≤ 1) lowers it for slower devices. */
export const ASPECT_SIZES: Record<Exclude<Aspect, "source">, [number, number]> = { "9:16": [1080, 1920], "4:3": [1440, 1080], "16:9": [1920, 1080], "1:1": [1080, 1080] };
export const ASPECT_LABELS: Record<Aspect, string> = { source: "Original", "9:16": "9:16 Portrait", "4:3": "4:3 Standard", "16:9": "16:9 Landscape", "1:1": "1:1 Square" };

const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);
/** Output size in pixels. "source" keeps the video's own shape, capped at 1920 on the long edge. */
export function outputSize(sourceWidth: number, sourceHeight: number, composition: Pick<Composition, "aspect" | "scale">): { width: number; height: number } {
  const scale = Math.min(1, Math.max(0.25, composition.scale));
  if (composition.aspect === "source") {
    const cap = Math.min(1, 1920 / Math.max(sourceWidth, sourceHeight));
    return { width: even(sourceWidth * cap * scale), height: even(sourceHeight * cap * scale) };
  }
  const [w, h] = ASPECT_SIZES[composition.aspect];
  return { width: even(w * scale), height: even(h * scale) };
}

/** Where the source picture is drawn inside the output frame. Rectangles may extend past the frame (cropping). */
export function placement(sourceWidth: number, sourceHeight: number, outWidth: number, outHeight: number, composition: Pick<Composition, "fit" | "framing">) {
  const contain = Math.min(outWidth / sourceWidth, outHeight / sourceHeight), cover = Math.max(outWidth / sourceWidth, outHeight / sourceHeight);
  if (composition.fit === "contain") { const w = sourceWidth * contain, h = sourceHeight * contain; return { x: (outWidth - w) / 2, y: (outHeight - h) / 2, width: w, height: h }; }
  const zoom = composition.fit === "crop" ? Math.min(4, Math.max(1, composition.framing.zoom)) : 1, w = sourceWidth * cover * zoom, h = sourceHeight * cover * zoom;
  const fx = composition.fit === "crop" ? Math.min(1, Math.max(0, composition.framing.x)) : 0.5, fy = composition.fit === "crop" ? Math.min(1, Math.max(0, composition.framing.y)) : 0.5;
  return { x: (outWidth - w) * fx, y: (outHeight - h) * fy, width: w, height: h };
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/** Paints the background and the source frame. `draw` receives the destination rectangle. */
export function paintFrame(ctx: Ctx, outWidth: number, outHeight: number, sourceWidth: number, sourceHeight: number, composition: Composition, draw: (x: number, y: number, w: number, h: number) => void) {
  ctx.fillStyle = composition.background; ctx.fillRect(0, 0, outWidth, outHeight);
  const rect = placement(sourceWidth, sourceHeight, outWidth, outHeight, composition);
  draw(rect.x, rect.y, rect.width, rect.height);
}

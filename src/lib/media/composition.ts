import type { Ctx2D } from "../captions/draw";
import { compositionSchema, type Composition } from "../editor/project";
import { planExport, type ExportPlan, type ExportPresetId, type Framing } from "./exportPresets";

export const ASPECT_RATIOS = ["9:16", "16:9", "1:1", "4:3"] as const;
const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

export function planComposition(source: { width: number; height: number }, preset: ExportPresetId, framing: Framing, value: Composition): ExportPlan {
  const composition = compositionSchema.parse(value);
  const legacy = planExport(source, preset, framing);
  if (composition.ratio === "preset" && composition.x === 0.5 && composition.y === 0.5 && composition.scale === 1 && composition.background === "#000000" && !composition.blur) return legacy;
  if (composition.ratio === "original") return { ...legacy, width: even(source.width), height: even(source.height), composition, fit: "contain", resize: true };
  if (composition.ratio === "preset") return { ...legacy, composition };
  const [a, b] = composition.ratio.split(":").map(Number);
  const ratio = a / b;
  const maxEdge = preset === "small" ? 1280 : 1920;
  const maxWidth = ratio >= 1 ? maxEdge : maxEdge * ratio;
  const maxHeight = ratio >= 1 ? maxEdge / ratio : maxEdge;
  const height = framing === "fill"
    ? Math.min(source.height, source.width / ratio, maxHeight)
    : Math.min(source.width, maxWidth) / ratio;
  return { width: even(height * ratio), height: even(height), fit: framing === "fill" ? "cover" : "contain",
    resize: true, quality: preset === "small" ? "medium" : "high", composition };
}

export function compositionRect(sw: number, sh: number, frame: ExportPlan, background = false) {
  const c = frame.composition;
  const fit = background || frame.fit === "cover" ? Math.max : Math.min;
  const scale = fit(frame.width / sw, frame.height / sh) * (background ? 1.1 : c?.scale ?? 1);
  const width = sw * scale, height = sh * scale;
  return { x: (frame.width - width) * (background ? 0.5 : c?.x ?? 0.5),
    y: (frame.height - height) * (background ? 0.5 : c?.y ?? 0.5), width, height };
}

/** The same drawing routine accepts either HTML video or a Mediabunny sample's draw method. */
export function drawComposition(ctx: Ctx2D, sw: number, sh: number, frame: ExportPlan,
  draw: (x: number, y: number, width: number, height: number) => void) {
  ctx.save();
  ctx.fillStyle = frame.composition?.background ?? "#000000";
  ctx.fillRect(0, 0, frame.width, frame.height);
  if (frame.composition?.blur) {
    const bg = compositionRect(sw, sh, frame, true);
    ctx.filter = `blur(${Math.max(frame.width, frame.height) * 0.02}px)`;
    draw(bg.x, bg.y, bg.width, bg.height);
    ctx.filter = "none";
  }
  const rect = compositionRect(sw, sh, frame);
  draw(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

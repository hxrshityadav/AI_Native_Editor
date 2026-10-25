import { z } from "zod";
import type { ProbeResult } from "../media/types";
import type { Word } from "../captions/types";

export const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
export const compositionSchema = z.object({
  ratio: z.enum(["preset", "9:16", "16:9", "1:1", "4:3", "original"]).default("preset"),
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  scale: z.number().min(0.5).max(3).default(1),
  background: colorSchema.default("#000000"),
  blur: z.boolean().default(false),
});
export const animationSchema = z.object({
  effect: z.enum(["none", "fade", "slide", "scale", "pop", "bounce", "typewriter", "reveal"]).default("none"),
  duration: z.number().min(0.05).max(1).default(0.25),
  intensity: z.number().min(0).max(1).default(0.5),
}).strict();
export const appearanceSchema = z.object({
  font: z.string().optional(), weight: z.number().int().min(100).max(900).optional(),
  italic: z.boolean().optional(), fontSizeRatio: z.number().min(0.015).max(0.15).optional(),
  textColor: colorSchema.optional(), opacity: z.number().min(0).max(1).optional(),
  letterSpacing: z.number().min(-0.05).max(0.3).optional(),
  lineSpacing: z.number().min(0.9).max(2).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  transform: z.enum(["none", "uppercase", "lowercase"]).optional(),
  maxWidthRatio: z.number().min(0.2).max(0.96).optional(),
  maxLines: z.number().int().min(1).max(5).optional(),
  horizontalPosition: z.number().min(0.05).max(0.95).optional(),
  verticalPosition: z.number().min(0.05).max(0.95).optional(),
  strokeRatio: z.number().min(0).max(0.3).optional(), strokeColor: colorSchema.optional(),
  shadow: z.boolean().optional(), shadowColor: colorSchema.optional(),
  shadowBlur: z.number().min(0).max(1).optional(), shadowX: z.number().min(-1).max(1).optional(), shadowY: z.number().min(-1).max(1).optional(),
  boxColor: colorSchema.optional(), boxOpacity: z.number().min(0).max(1).optional(),
  boxPadding: z.number().min(0).max(1).optional(), boxRadius: z.number().min(0).max(1).optional(),
  highlightColor: colorSchema.optional(), highlightEnabled: z.boolean().optional(),
}).strict();
export const overlaySchema = z.object({
  id: z.string(), text: z.string().max(200), start: z.number().nonnegative(), end: z.number().positive(),
  x: z.number().min(0.05).max(0.95), y: z.number().min(0.05).max(0.95),
  size: z.number().min(0.015).max(0.2), color: colorSchema, opacity: z.number().min(0).max(1),
  font: z.string().optional(), weight: z.number().int().min(100).max(900).optional(),
  animation: animationSchema.optional(), appearance: appearanceSchema.optional(),
  locked: z.boolean().default(false), hidden: z.boolean().default(false),
}).refine((overlay) => overlay.end > overlay.start);
export const cutSchema = z.object({ start: z.number().nonnegative(), end: z.number().positive() })
  .refine((cut) => cut.end > cut.start);
export const wordSchema = z.object({ text: z.string(), start: z.number().nonnegative(), end: z.number().nonnegative() });
export const captionSchema = z.object({
  id: z.string(), start: z.number().nonnegative(), end: z.number().positive(), words: z.array(wordSchema),
  appearance: appearanceSchema.default({}), animation: animationSchema.optional(),
  locked: z.boolean().default(false), hidden: z.boolean().default(false), estimated: z.boolean().default(false),
}).refine((caption) => caption.end > caption.start && caption.words.every((word) => word.end > word.start && word.start >= caption.start - 0.001 && word.end <= caption.end + 0.001));

export const editingSchema = z.object({
  version: z.literal(1).default(1),
  styleId: z.string().default("clean"),
  exportPreset: z.enum(["reels", "small", "original"]).default("reels"),
  framing: z.enum(["fill", "fit"]).default("fill"),
  composition: compositionSchema.prefault({}),
  appearance: appearanceSchema.prefault({}),
  animation: animationSchema.prefault({}),
  overlays: z.array(overlaySchema).max(20).default([]),
  cuts: z.array(cutSchema).max(200).default([]),
  gaps: z.array(cutSchema).max(200).default([]),
  captions: z.array(captionSchema).max(3000).nullable().default(null),
  wordEdits: z.array(wordSchema).nullable().default(null),
  splits: z.array(z.number().positive().max(600)).max(200).default([]),
  audio: z.object({ muted: z.boolean().default(false), volume: z.number().min(0).max(1).default(1) }).prefault({}),
  captionPositionLocked: z.boolean().default(false),
  segmentation: z.literal("off").default("off"),
});
export type EditingSettings = z.infer<typeof editingSchema>;
export type Composition = z.infer<typeof compositionSchema>;
export type Appearance = z.infer<typeof appearanceSchema>;
export type Animation = z.infer<typeof animationSchema>;
export type TextOverlay = z.infer<typeof overlaySchema>;
export type Cut = z.infer<typeof cutSchema>;
export type CaptionSegment = z.infer<typeof captionSchema>;
export type EditorSelection = { kind: "caption" | "overlay" | "video" | "gap"; id: string } | { kind: "audio" } | null;
/** Source data remains separate from settings; neither File nor object URLs enter persistence. */
export type EditorProject = { source: ProbeResult | null; words: Word[]; settings: EditingSettings };
export const defaultEditing = () => editingSchema.parse({});

export type EditHistory = { current: EditingSettings; past: EditingSettings[]; future: EditingSettings[] };
export function changeEditing(history: EditHistory, next: EditingSettings): EditHistory {
  const current = editingSchema.parse(next);
  if (JSON.stringify(current) === JSON.stringify(history.current)) return history;
  return { current, past: [...history.past, history.current].slice(-100), future: [] };
}
export function undoEditing(history: EditHistory): EditHistory {
  if (!history.past.length) return history;
  return { current: history.past.at(-1)!, past: history.past.slice(0, -1), future: [history.current, ...history.future] };
}
export function redoEditing(history: EditHistory): EditHistory {
  if (!history.future.length) return history;
  return { current: history.future[0], past: [...history.past, history.current], future: history.future.slice(1) };
}

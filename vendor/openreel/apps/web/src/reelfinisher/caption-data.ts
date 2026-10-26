import { z } from "zod";
import type { TextClip } from "@openreel/core";
import { appearanceSchema, animationSchema, wordSchema } from "../../../../../../src/lib/editor/project";

/** Relative times survive moves. Original word times are never replaced with guesses silently. */
export const captionExtension = z.object({
  version: z.literal(1),
  styleId: z.string(),
  appearance: appearanceSchema,
  baseAppearance: appearanceSchema.optional(),
  animation: animationSchema,
  customAnimation: z.boolean().optional(),
  words: z.array(wordSchema),
  referenceDuration: z.number().positive(),
  referenceFontSize: z.number().positive(),
  timing: z.enum(["verified-words", "estimated", "segment"]),
  kind: z.enum(["caption", "overlay"]).default("caption"),
}).refine((data) => data.words.every((word, index) => word.end > word.start && word.end <= data.referenceDuration + 0.001 && (!index || word.start >= data.words[index - 1].start)), "Caption words require ordered positive intervals within their reference duration");
export type CaptionExtension = z.infer<typeof captionExtension>;
export function readCaption(clip: TextClip): CaptionExtension | null {
  if (!clip.metadata?.reelFinisher) return null;
  return captionExtension.parse(clip.metadata.reelFinisher);
}
export function estimatedWords(text: string, duration: number) {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.map((text, i) => ({ text, start: duration * i / tokens.length, end: duration * (i + 1) / tokens.length }));
}
export function currentWords(clip: TextClip, data: CaptionExtension) {
  if (data.words.map((word) => word.text).join(" ") !== clip.text.trim()) return estimatedWords(clip.text, clip.duration);
  return data.words.map((word) => ({ ...word, start: word.start * clip.duration / data.referenceDuration, end: word.end * clip.duration / data.referenceDuration }));
}
/** Trim/split native caption items without stretching their word timestamps. */
export function sliceCaption(clip: TextClip, from: number, to: number): TextClip {
  const data = readCaption(clip);
  if (!data) return clip;
  const duration = to - from;
  const words = data.kind === "overlay" ? estimatedWords(clip.text, duration) : currentWords(clip, data)
    .filter((word) => word.end > from && word.start < to)
    .map((word) => ({ ...word, start: Math.max(0, word.start - from), end: Math.min(duration, word.end - from) }));
  return { ...clip, text: data.kind === "overlay" ? clip.text : words.map((word) => word.text).join(" "),
    metadata: { ...clip.metadata, reelFinisher: { ...data, words, referenceDuration: duration } } };
}

import { z } from "zod";
import type { Cue } from "./text";

export const creatorSpec = z.object({
  version: z.literal(1), duration: z.number().positive().max(600),
  start: z.number().nonnegative(), end: z.number().positive(),
  shape: z.enum(["9:16", "1:1", "16:9"]), x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  quality: z.enum(["small", "reels"]),
  cues: z.array(z.object({ start: z.number().nonnegative(), end: z.number().positive(), text: z.string().trim().min(1).max(500) })).max(1000),
}).strict().superRefine((value, context) => {
  if (value.end > value.duration || value.end - value.start < .1 || value.end - value.start > 60 + Number.EPSILON * 600 * 4) context.addIssue({ code: "custom", message: "Choose a non-empty range of up to 60 seconds inside the source." });
  let end = 0;
  for (const cue of value.cues) {
    if (cue.start < end || cue.end <= cue.start || cue.end > value.duration + .05) context.addIssue({ code: "custom", message: "Captions need ordered, non-overlapping times inside the source." });
    end = cue.end;
  }
});
export type CreatorSpec = z.infer<typeof creatorSpec>;
export type Moment = { start: number; end: number; coverage: number; score: number; text: string };

/** Deterministic speech structure, not semantic or viral-potential prediction. */
export function detectMoments(cues: Cue[], duration: number, maximum: number): Moment[] {
  creatorSpec.parse({ version: 1, duration, start: 0, end: Math.min(duration, 60), shape: "9:16", x: .5, y: .5, quality: "small", cues });
  if (!Number.isFinite(maximum) || maximum < 2 || maximum > 60) throw new Error("Choose a maximum clip length from 2–60 seconds.");
  const candidates: Moment[] = [];
  for (let i = 0; i < cues.length;) {
    const first = cues[i]; let j = i, end = first.end, speech = 0;
    while (j < cues.length && cues[j].end - first.start <= maximum && (j === i || cues[j].start - end < 1.5)) {
      speech += cues[j].end - cues[j].start; end = cues[j].end; j++;
    }
    if (j === i) { i++; continue; }
    const text = cues.slice(i, j).map(cue => cue.text).join(" "), words = text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const span = end - first.start, coverage = Math.min(1, speech / span);
    if (span >= 1 && words.length >= 3) candidates.push({ start: first.start, end, text, coverage,
      score: coverage + new Set(words).size / words.length + (/[.!?।。]$/.test(text.trim()) ? .25 : 0) });
    i = j;
  }
  return candidates.sort((a, b) => b.score - a.score || a.start - b.start).slice(0, 8);
}

import { z } from "zod";
import { appearanceSchema, animationSchema, editingSchema, type CaptionSegment, type EditingSettings, type TextOverlay } from "./project";
import { normalizeCuts, retainedPieces, sourceToEdited } from "./timeline";
import type { CaptionLine, Word } from "../captions/types";

export const MIN_ITEM_SECONDS = 0.05;
export function captionsFromLines(lines: readonly CaptionLine[]): CaptionSegment[] {
  return lines.filter((line) => line.end > line.start).map((line, index) => ({ id: `caption-${index}-${line.start.toFixed(4)}`,
    start: line.start, end: line.end, words: line.words.map((word) => ({ ...word })), appearance: {}, locked: false, hidden: false, estimated: false }));
}
export function captionLines(captions: readonly CaptionSegment[]): CaptionLine[] {
  return captions.filter((caption) => !caption.hidden).map((caption) => ({ ...caption, text: caption.words.map((word) => word.text).join(" ") }));
}
export function wordsForText(text: string, start: number, end: number): Word[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.map((text, index) => ({ text, start: start + (end - start) * index / tokens.length, end: start + (end - start) * (index + 1) / tokens.length }));
}
export function videoSegments(settings: EditingSettings, duration: number) {
  const keep = retainedPieces(0, duration, normalizeCuts([...settings.cuts, ...settings.gaps], duration));
  return keep.flatMap((piece) => {
    const edges = [piece.start, ...settings.splits.filter((time) => time > piece.start + 0.001 && time < piece.end - 0.001).sort((a, b) => a - b), piece.end];
    return edges.slice(0, -1).map((start, index) => ({ id: `video-${start.toFixed(4)}-${edges[index + 1].toFixed(4)}`, start, end: edges[index + 1], outputStart: sourceToEdited(start, settings.cuts), outputEnd: sourceToEdited(edges[index + 1], settings.cuts) }));
  });
}
/** Gaps occupy output time until closed; cuts already removed output time in saved projects. */
export function timelineGaps(settings: EditingSettings, duration: number) {
  return normalizeCuts(settings.gaps, duration).flatMap((gap) => retainedPieces(gap.start, gap.end, settings.cuts))
    .map((gap) => ({ ...gap, id: `gap-${gap.start.toFixed(4)}-${gap.end.toFixed(4)}`, outputStart: sourceToEdited(gap.start, settings.cuts), outputEnd: sourceToEdited(gap.end, settings.cuts) }));
}
export const editOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("global_style"), appearance: appearanceSchema }).strict(),
  z.object({ type: z.literal("caption_style"), id: z.string(), appearance: appearanceSchema }).strict(),
  z.object({ type: z.literal("caption_text"), id: z.string(), text: z.string().trim().min(1).max(1000) }).strict(),
  z.object({ type: z.literal("caption_time"), id: z.string(), start: z.number().nonnegative(), end: z.number().positive() }).strict(),
  z.object({ type: z.literal("caption_add"), start: z.number().nonnegative(), end: z.number().positive(), text: z.string().trim().min(1).max(1000) }).strict(),
  z.object({ type: z.literal("caption_delete"), id: z.string() }).strict(),
  z.object({ type: z.literal("caption_split"), id: z.string(), time: z.number().nonnegative() }).strict(),
  z.object({ type: z.literal("caption_merge"), id: z.string() }).strict(),
  z.object({ type: z.literal("ratio"), ratio: z.enum(["1:1", "4:3", "9:16", "16:9", "original"]) }).strict(),
  z.object({ type: z.literal("trim"), start: z.number().nonnegative(), end: z.number().positive() }).strict(),
  z.object({ type: z.literal("video_split"), time: z.number().nonnegative() }).strict(),
  z.object({ type: z.literal("cut"), start: z.number().nonnegative(), end: z.number().positive() }).strict(),
  z.object({ type: z.literal("video_delete"), id: z.string(), ripple: z.boolean() }).strict(),
  z.object({ type: z.literal("remove_gap"), id: z.string() }).strict(),
  z.object({ type: z.literal("audio"), muted: z.boolean(), volume: z.number().min(0).max(1) }).strict(),
  z.object({ type: z.literal("animation"), animation: animationSchema }).strict(),
  z.object({ type: z.literal("detect_silence"), minimum: z.number().min(0.2).max(10), threshold: z.number().min(-65).max(-15) }).strict(),
]);
export type EditOperation = z.infer<typeof editOperationSchema>;
export const editPlanSchema = z.object({ summary: z.string().min(1).max(500), operations: z.array(editOperationSchema).min(1).max(20) }).strict();
export type EditPlan = z.infer<typeof editPlanSchema>;

/** Manual tools and AI plans use this exact reducer. A plan is atomic: failure leaves input intact. */
export function applyOperations(settings: EditingSettings, base: CaptionSegment[], operations: readonly EditOperation[], duration: number, fontIds?: readonly string[]): EditingSettings {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600) throw new Error("Choose a valid video of 10 minutes or less.");
  let next = editingSchema.parse(settings);
  next.cuts = normalizeCuts(next.cuts, duration);
  let captions = (next.captions ?? base).map((caption) => ({ ...caption, appearance: { ...caption.appearance }, words: caption.words.map((word) => ({ ...word })) }));
  const interval = (start: number, end: number) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > duration + 0.000001 || end - start < MIN_ITEM_SECONDS) throw new Error("Use start/end times inside the video, at least 0.05 seconds apart.");
  };
  const requireCaption = (id: string) => {
    const caption = captions.find((caption) => caption.id === id);
    if (!caption) throw new Error("Select an existing caption first.");
    if (caption.locked) throw new Error("Unlock the selected caption before editing it.");
    return caption;
  };
  for (const raw of operations) {
    const operation = editOperationSchema.parse(raw);
    if ((operation.type === "global_style" || operation.type === "caption_style") && operation.appearance.font && fontIds && !fontIds.includes(operation.appearance.font)) throw new Error("That font is unavailable. Choose an installed font in the plan or import it first.");
    switch (operation.type) {
      case "global_style": next = { ...next, appearance: { ...next.appearance, ...operation.appearance } }; break;
      case "ratio": next = { ...next, composition: { ...next.composition, ratio: operation.ratio } }; break;
      case "audio": next = { ...next, audio: { muted: operation.muted, volume: operation.volume } }; break;
      case "animation": next = { ...next, animation: operation.animation }; break;
      case "caption_style": {
        const caption = requireCaption(operation.id); caption.appearance = { ...caption.appearance, ...operation.appearance }; break;
      }
      case "caption_text": {
        const caption = requireCaption(operation.id); caption.words = wordsForText(operation.text, caption.start, caption.end); caption.estimated = true; break;
      }
      case "caption_time": {
        interval(operation.start, operation.end);
        const caption = requireCaption(operation.id);
        const scale = (operation.end - operation.start) / (caption.end - caption.start);
        caption.words = caption.words.map((word) => ({ ...word, start: operation.start + (word.start - caption.start) * scale, end: operation.start + (word.end - caption.start) * scale }));
        caption.start = operation.start; caption.end = operation.end; break;
      }
      case "caption_add": {
        interval(operation.start, operation.end);
        captions.push({ id: crypto.randomUUID(), start: operation.start, end: operation.end, words: wordsForText(operation.text, operation.start, operation.end), appearance: {}, estimated: true, locked: false, hidden: false }); break;
      }
      case "caption_delete": requireCaption(operation.id); captions = captions.filter((caption) => caption.id !== operation.id); break;
      case "caption_split": {
        const caption = requireCaption(operation.id);
        interval(caption.start, operation.time); interval(operation.time, caption.end);
        const left = caption.words.filter((word) => (word.start + word.end) / 2 < operation.time);
        const right = caption.words.filter((word) => (word.start + word.end) / 2 >= operation.time);
        if (!left.length || !right.length) throw new Error("Split between words so both captions retain text.");
        const split = (words: Word[], start: number, end: number) => words.map((word) => ({ ...word, start: Math.max(start, word.start), end: Math.min(end, word.end) }));
        captions = captions.flatMap((item) => item.id !== caption.id ? [item] : [
          { ...caption, end: operation.time, words: split(left, caption.start, operation.time) },
          { ...caption, id: crypto.randomUUID(), start: operation.time, words: split(right, operation.time, caption.end) },
        ]); break;
      }
      case "caption_merge": {
        const caption = requireCaption(operation.id);
        const ordered = [...captions].sort((a, b) => a.start - b.start);
        const following = ordered[ordered.findIndex((item) => item.id === caption.id) + 1];
        if (!following) throw new Error("There is no following caption to merge.");
        requireCaption(following.id);
        caption.words = [...caption.words, ...following.words]; caption.end = following.end;
        captions = captions.filter((item) => item.id !== following.id); break;
      }
      case "trim": {
        interval(operation.start, operation.end);
        next = { ...next, cuts: normalizeCuts([...next.cuts, ...(operation.start > 0 ? [{ start: 0, end: operation.start }] : []), ...(operation.end < duration ? [{ start: operation.end, end: duration }] : [])], duration) }; break;
      }
      case "cut": interval(operation.start, operation.end); next = { ...next, cuts: normalizeCuts([...next.cuts, { start: operation.start, end: operation.end }], duration) }; break;
      case "video_delete": {
        const clip = videoSegments(next, duration).find((clip) => clip.id === operation.id);
        if (!clip) throw new Error("Select an existing video clip first.");
        const key = operation.ripple ? "cuts" : "gaps";
        next = { ...next, [key]: normalizeCuts([...next[key], { start: clip.start, end: clip.end }], duration) }; break;
      }
      case "remove_gap": {
        const gap = timelineGaps(next, duration).find((gap) => gap.id === operation.id);
        if (!gap) throw new Error("Select an existing gap first. It may already have been removed.");
        next = { ...next, cuts: normalizeCuts([...next.cuts, { start: gap.start, end: gap.end }], duration) }; break;
      }
      case "video_split":
        if (!videoSegments(next, duration).some((segment) => operation.time - segment.start >= MIN_ITEM_SECONDS && segment.end - operation.time >= MIN_ITEM_SECONDS)) throw new Error("Place the playhead inside a retained clip before splitting.");
        next = { ...next, splits: [...new Set([...next.splits, operation.time])].sort((a, b) => a - b) }; break;
      case "detect_silence": break; // the shared local analyzer proposes intervals for explicit review
    }
  }
  captions.sort((a, b) => a.start - b.start);
  for (let i = 0; i < captions.length; i++) {
    interval(captions[i].start, captions[i].end);
    if (i > 0 && captions[i].start < captions[i - 1].end - 0.001) throw new Error("Captions cannot overlap. Adjust the neighboring caption first.");
  }
  if (sourceToEdited(duration, next.cuts) < 0.1) throw new Error("Keep at least 0.1 seconds of video.");
  next.gaps = timelineGaps(next, duration).map(({ start, end }) => ({ start, end }));
  if (videoSegments(next, duration).reduce((total, clip) => total + clip.end - clip.start, 0) < 0.1) throw new Error("Keep at least 0.1 seconds of video.");
  const hasCaptionOperation = operations.some((operation) => operation.type.startsWith("caption_"));
  return editingSchema.parse({ ...next, ...(hasCaptionOperation ? { captions, wordEdits: null } : {}) });
}

export function moveOverlay(overlays: TextOverlay[], id: string, x: number, y: number) {
  const target = overlays.find((overlay) => overlay.id === id);
  if (!target || target.locked) throw new Error("Select and unlock a text overlay first.");
  return overlays.map((overlay) => overlay.id === id ? { ...overlay, x: snapPosition(x), y: snapPosition(y) } : overlay);
}
export function snapPosition(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Position must be a finite number.");
  const clamped = Math.max(0.05, Math.min(0.95, value));
  return [0.1, 0.5, 0.9].find((guide) => Math.abs(guide - clamped) < 0.02) ?? clamped;
}

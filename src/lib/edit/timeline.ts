import { z } from "zod";
import type { Word } from "@/lib/captions/types";

/**
 * Non-destructive edit decision list (EDL). The original file is never changed: an edit is a list of
 * source-time intervals, each with an action. Everything time-based (preview, captions, word
 * highlights, overlays, export) goes through one TimeMap built from it.
 */
export const editIntervalSchema = z
  .object({
    /** Source time in seconds. */
    start: z.number().finite().min(0),
    end: z.number().finite().min(0),
    /** "remove" cuts it from the output; "keep" is a suggestion the user rejected. */
    action: z.enum(["remove", "keep"]),
    /** Where the suggestion came from. */
    origin: z.enum(["silence", "manual", "ai"]),
  })
  .refine((i) => i.end > i.start, { message: "end must be after start" });
export type EditInterval = z.infer<typeof editIntervalSchema>;

export const editDecisionListSchema = z.object({
  version: z.literal(1),
  intervals: z.array(editIntervalSchema).max(2000),
});
export type EditDecisionList = z.infer<typeof editDecisionListSchema>;

export const EMPTY_EDL: EditDecisionList = { version: 1, intervals: [] };

/** A kept stretch of source, and where it starts in the output. */
export type KeptSegment = { sourceStart: number; sourceEnd: number; outputStart: number };

export type TimeMap = {
  sourceDuration: number;
  outputDuration: number;
  /** In source order, non-overlapping, never empty-length. */
  segments: KeptSegment[];
  /** The removed source ranges, merged and sorted. */
  removed: { start: number; end: number }[];
};

/** Shorter leftovers than this between cuts are dropped: a 10 ms sliver is a glitch, not content. */
export const MIN_SEGMENT_SEC = 0.04;

/** Builds the source → output mapping. Overlapping or adjacent removals are merged. */
export function buildTimeMap(sourceDuration: number, edl: EditDecisionList): TimeMap {
  const raw = edl.intervals
    .filter((i) => i.action === "remove")
    .map((i) => ({ start: clamp(i.start, 0, sourceDuration), end: clamp(i.end, 0, sourceDuration) }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  const removed: { start: number; end: number }[] = [];
  for (const r of raw) {
    const last = removed.at(-1);
    // Merge overlaps, and swallow kept slivers too short to matter.
    if (last && r.start - last.end < MIN_SEGMENT_SEC) last.end = Math.max(last.end, r.end);
    else removed.push({ ...r });
  }
  // A sliver left at either end of the video is dropped too.
  if (removed.length && removed[0].start < MIN_SEGMENT_SEC) removed[0].start = 0;
  const lastCut = removed.at(-1);
  if (lastCut && sourceDuration - lastCut.end < MIN_SEGMENT_SEC) lastCut.end = sourceDuration;

  const segments: KeptSegment[] = [];
  let cursor = 0;
  let out = 0;
  for (const r of removed) {
    if (r.start > cursor) {
      segments.push({ sourceStart: cursor, sourceEnd: r.start, outputStart: out });
      out += r.start - cursor;
    }
    cursor = r.end;
  }
  if (cursor < sourceDuration) {
    segments.push({ sourceStart: cursor, sourceEnd: sourceDuration, outputStart: out });
    out += sourceDuration - cursor;
  }
  return { sourceDuration, outputDuration: round(out), segments, removed };
}

/** Output time for a source time, or null when that moment was cut. */
export function toOutputTime(map: TimeMap, t: number): number | null {
  for (const s of map.segments) {
    if (t >= s.sourceStart && t < s.sourceEnd) return s.outputStart + (t - s.sourceStart);
    if (t === s.sourceEnd && s === map.segments.at(-1)) return s.outputStart + (t - s.sourceStart);
  }
  return null;
}

/**
 * Output time for a source time, snapping a cut moment to the output point where the cut happens
 * (the end of the content before it). Used for interval ends and for the preview clock.
 */
export function toOutputTimeSnapped(map: TimeMap, t: number): number {
  let snapped = 0;
  for (const s of map.segments) {
    if (t < s.sourceStart) return snapped;
    if (t <= s.sourceEnd) return s.outputStart + (t - s.sourceStart);
    snapped = s.outputStart + (s.sourceEnd - s.sourceStart);
  }
  return snapped;
}

/** Source time for an output time (inverse mapping). At a cut point, the content after the cut. */
export function toSourceTime(map: TimeMap, outputTime: number): number {
  for (const s of map.segments) {
    const length = s.sourceEnd - s.sourceStart;
    const last = s === map.segments.at(-1);
    if (outputTime < s.outputStart + length || (last && outputTime <= s.outputStart + length)) {
      return s.sourceStart + Math.max(0, outputTime - s.outputStart);
    }
  }
  return map.segments.at(-1)?.sourceEnd ?? 0;
}

/** The removed range containing `t`, if any: where the preview must jump to. */
export function removedRangeAt(map: TimeMap, t: number): { start: number; end: number } | null {
  return map.removed.find((r) => t >= r.start && t < r.end) ?? null;
}

/**
 * Maps a source-time interval (a word, a caption, an overlay) to output time. The rules:
 * - entirely inside removed time: dropped (null);
 * - partly cut at either edge: clipped to the part that survives;
 * - spanning a cut: kept, and shortened by the removed time;
 * - shorter than `minDuration` after clipping: dropped.
 */
export function mapInterval(
  map: TimeMap,
  interval: { start: number; end: number },
  minDuration = 0.05,
): { start: number; end: number } | null {
  let kept = 0;
  for (const s of map.segments) kept += overlap(s.sourceStart, s.sourceEnd, interval.start, interval.end);
  if (kept < minDuration) return null;
  const firstKept = map.segments.find((s) => s.sourceEnd > interval.start && s.sourceStart < interval.end)!;
  const start = toOutputTimeSnapped(map, Math.max(interval.start, firstKept.sourceStart));
  return { start: round(start), end: round(start + kept) };
}

/** Words on the output timeline, by the mapInterval rules. Order is kept. */
export function mapWords(map: TimeMap, words: readonly Word[]): Word[] {
  if (map.removed.length === 0) return [...words];
  const out: Word[] = [];
  for (const w of words) {
    const mapped = mapInterval(map, w);
    if (mapped) out.push({ ...w, ...mapped });
  }
  return out;
}

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Replaces every interval from one origin (e.g. a new silence analysis), keeping the others. */
export function replaceOrigin(edl: EditDecisionList, origin: EditInterval["origin"], intervals: EditInterval[]): EditDecisionList {
  return { version: 1, intervals: [...edl.intervals.filter((i) => i.origin !== origin), ...intervals] };
}

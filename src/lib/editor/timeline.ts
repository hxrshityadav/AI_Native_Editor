import { cutSchema, type Cut } from "./project";
import type { CaptionLine, Word } from "../captions/types";
export const inInterval = (time: number, intervals: readonly Cut[]) => intervals.some((item) => time >= item.start && time < item.end);

/** Canonical, non-overlapping source intervals; never alters the source media. */
export function normalizeCuts(cuts: readonly Cut[], duration: number): Cut[] {
  const sorted = cuts.map((cut) => cutSchema.parse(cut)).map((cut) => ({ start: Math.max(0, Math.min(duration, cut.start)), end: Math.min(duration, cut.end) }))
    .filter((cut) => cut.end > cut.start).sort((a, b) => a.start - b.start);
  const result: Cut[] = [];
  for (const cut of sorted) {
    const last = result.at(-1);
    if (last && cut.start <= last.end) last.end = Math.max(last.end, cut.end);
    else result.push({ ...cut });
  }
  return result;
}
export function sourceToEdited(time: number, cuts: readonly Cut[]): number {
  let removed = 0;
  for (const cut of cuts) removed += Math.max(0, Math.min(time, cut.end) - cut.start);
  return Math.max(0, time - removed);
}
export function editedToSource(time: number, cuts: readonly Cut[], edge: "start" | "end" = "start"): number {
  let source = time;
  for (const cut of cuts) { if (source > cut.start || (source === cut.start && edge === "start")) source += cut.end - cut.start; else break; }
  return source;
}
/** Portions of a source sample that survive the EDL, including cuts inside a frame/audio block. */
export function retainedPieces(start: number, end: number, cuts: readonly Cut[]): Cut[] {
  let cursor = start;
  const pieces: Cut[] = [];
  for (const cut of cuts) {
    if (cut.end <= cursor) continue;
    if (cut.start >= end) break;
    if (cut.start > cursor) pieces.push({ start: cursor, end: Math.min(cut.start, end) });
    cursor = Math.max(cursor, cut.end);
    if (cursor >= end) break;
  }
  if (cursor < end) pieces.push({ start: cursor, end });
  return pieces;
}
export function remapWords(words: readonly Word[], cuts: readonly Cut[]): Word[] {
  return words.flatMap((word) => {
    const pieces = retainedPieces(word.start, word.end, cuts);
    return pieces.length ? [{ ...word, start: sourceToEdited(pieces[0].start, cuts), end: sourceToEdited(pieces.at(-1)!.end, cuts) }] : [];
  });
}
export function remapCaptionLines(lines: readonly CaptionLine[], cuts: readonly Cut[]): CaptionLine[] {
  return lines.flatMap((line) => {
    const words = remapWords(line.words, cuts);
    return words.length ? [{ ...line, words, text: words.map((word) => word.text).join(" "), start: sourceToEdited(line.start, cuts), end: sourceToEdited(line.end, cuts) }] : [];
  });
}

export type EnergyWindow = { start: number; end: number; db: number };
export type SilenceOptions = { threshold: number; minimum: number; padding: number; keep: number };
export function detectSilences(windows: readonly EnergyWindow[], options: SilenceOptions): Cut[] {
  const candidates: Cut[] = [];
  let start: number | null = null;
  let end = 0;
  const flush = () => {
    if (start !== null && end - start >= options.minimum) {
      const trim = options.padding + options.keep / 2;
      if (end - start > trim * 2) candidates.push({ start: start + trim, end: end - trim });
    }
    start = null;
  };
  for (const window of windows) {
    if (window.db <= options.threshold) {
      if (start !== null && window.start - end > 0.03) flush();
      start ??= window.start;
      end = window.end;
    } else flush();
  }
  flush();
  return candidates;
}

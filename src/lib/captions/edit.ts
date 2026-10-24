import type { Word } from "./types";

/** Shortest a word may be after an edit. Keeps captions on screen for at least ~1.5 frames at 30 fps. */
export const MIN_WORD_SEC = 0.05;
/** One timing nudge. Matches the ±150 ms sync target with three presses of headroom. */
export const NUDGE_SEC = 0.05;

/**
 * Replaces word i's text. Empty text removes the word. Text containing spaces
 * splits it into several words, dividing its time in proportion to length.
 */
export function replaceWordText(words: readonly Word[], i: number, text: string): Word[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return removeWord(words, i);
  const w = words[i];
  const totalChars = tokens.reduce((n, t) => n + t.length, 0);
  let t = w.start;
  const replaced = tokens.map((token, k) => {
    const end = k === tokens.length - 1 ? w.end : round(t + ((w.end - w.start) * token.length) / totalChars);
    const word = { text: token, start: round(t), end };
    t = end;
    return word;
  });
  return [...words.slice(0, i), ...replaced, ...words.slice(i + 1)];
}

export function removeWord(words: readonly Word[], i: number): Word[] {
  return words.filter((_, k) => k !== i);
}

/** Joins word i with the next word into one word spanning both. */
export function mergeWithNext(words: readonly Word[], i: number): Word[] {
  if (i < 0 || i >= words.length - 1) return [...words];
  const a = words[i];
  const b = words[i + 1];
  return [...words.slice(0, i), { text: `${a.text} ${b.text}`, start: a.start, end: b.end }, ...words.slice(i + 2)];
}

/**
 * Moves the start or end of word i by delta seconds, clamped so words never
 * overlap their neighbours, never go below MIN_WORD_SEC, and stay within
 * [0, maxEnd].
 */
export function shiftEdge(
  words: readonly Word[],
  i: number,
  edge: "start" | "end",
  delta: number,
  maxEnd = Infinity,
): Word[] {
  const w = words[i];
  const prevEnd = i > 0 ? words[i - 1].end : 0;
  const nextStart = i < words.length - 1 ? words[i + 1].start : maxEnd;
  const next =
    edge === "start"
      ? { ...w, start: round(clamp(w.start + delta, prevEnd, w.end - MIN_WORD_SEC)) }
      : { ...w, end: round(clamp(w.end + delta, w.start + MIN_WORD_SEC, nextStart)) };
  return words.map((x, k) => (k === i ? next : x));
}

/** Index of the word being spoken at time t, or -1. */
export function wordIndexAt(words: readonly Word[], t: number): number {
  let lo = 0;
  let hi = words.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t < words[mid].start) hi = mid - 1;
    else if (t >= words[mid].end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), Math.max(min, max));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

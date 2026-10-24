import type { CaptionLine, Word } from "./types";

export type GroupOptions = {
  /** Maximum characters per caption, including spaces. */
  maxChars: number;
  maxWords: number;
  /** A silence longer than this starts a new caption. */
  maxGapSec: number;
  maxDurationSec: number;
};

export const DEFAULT_GROUP_OPTIONS: GroupOptions = {
  maxChars: 24,
  maxWords: 4,
  maxGapSec: 0.6,
  maxDurationSec: 2.5,
};

/** Splits a word sequence into short, readable caption lines suited to vertical video. */
export function groupWords(
  words: readonly Word[],
  options: GroupOptions = DEFAULT_GROUP_OPTIONS,
): CaptionLine[] {
  const lines: CaptionLine[] = [];
  let current: Word[] = [];

  const flush = () => {
    if (current.length === 0) return;
    lines.push(toLine(current));
    current = [];
  };

  for (const word of words) {
    const text = word.text.trim();
    if (!text) continue;
    const clean = { ...word, text };

    if (current.length > 0) {
      const first = current[0];
      const last = current[current.length - 1];
      const nextChars = current.reduce((n, w) => n + w.text.length + 1, 0) + text.length;
      const breaks =
        current.length >= options.maxWords ||
        nextChars > options.maxChars ||
        clean.start - last.end > options.maxGapSec ||
        clean.end - first.start > options.maxDurationSec ||
        endsSentence(last.text);
      if (breaks) flush();
    }
    current.push(clean);
  }
  flush();
  return lines;
}

function toLine(words: Word[]): CaptionLine {
  return {
    words,
    text: words.map((w) => w.text).join(" "),
    start: words[0].start,
    end: words[words.length - 1].end,
  };
}

function endsSentence(text: string): boolean {
  return /[.!?।]$/.test(text);
}

/** Returns the caption line visible at time `t` (seconds), or null between lines. */
export function lineAt(lines: readonly CaptionLine[], t: number): CaptionLine | null {
  let lo = 0;
  let hi = lines.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const line = lines[mid];
    if (t < line.start) hi = mid - 1;
    else if (t >= line.end) lo = mid + 1;
    else return line;
  }
  return null;
}

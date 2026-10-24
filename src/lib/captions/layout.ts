import type { Word } from "./types";

export type LaidOutWord = { word: Word; x: number; row: number; width: number };
export type CaptionLayout = { words: LaidOutWord[]; rowWidths: number[]; rows: number };

/**
 * Wraps words into rows no wider than `maxWidth`, measured with `measure`.
 * x positions are relative to the left edge of each row. A word wider than
 * `maxWidth` gets its own row rather than being split.
 */
export function layoutWords(
  words: readonly Word[],
  maxWidth: number,
  measure: (text: string) => number,
): CaptionLayout {
  const space = measure(" ");
  const out: LaidOutWord[] = [];
  const rowWidths: number[] = [];
  let row = 0;
  let x = 0;

  for (const word of words) {
    const width = measure(word.text);
    if (x > 0 && x + space + width > maxWidth) {
      rowWidths.push(x);
      row += 1;
      x = 0;
    }
    if (x > 0) x += space;
    out.push({ word, x, row, width });
    x += width;
  }
  if (words.length > 0) rowWidths.push(x);
  return { words: out, rowWidths, rows: rowWidths.length };
}

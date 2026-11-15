/*
 * Post-processing of recognised words, shared by the speech worker and Subtitle Studio:
 * - dropLoops: Whisper sometimes falls into a decoding loop ("sky sky sky ..."). Runs of the same word or short phrase
 *   repeated more than three times are cut to one occurrence and reported, so the caption can be flagged for review.
 * - groupWords: builds captions from real word timings, breaking at sentence punctuation, pauses, a word limit and a
 *   duration limit. Times come only from the words; nothing is interpolated.
 */
export type TimedWord = { text: string; start: number; end: number };

const norm = (text: string) => text.toLowerCase().replace(/[\p{P}\p{S}]/gu, "");

export function dropLoops(words: TimedWord[], maxRepeats = 3): { words: TimedWord[]; removed: number } {
  const out: TimedWord[] = [];
  let removed = 0;
  for (let i = 0; i < words.length;) {
    let skipped = false;
    for (const size of [1, 2, 3, 4, 5, 6]) { // loops up to six words long (Tiny repeated "This is a problem" on a real reel)
      if (i + size * (maxRepeats + 1) > words.length) continue;
      const unit = words.slice(i, i + size).map(word => norm(word.text)).join(" ");
      if (!unit) continue;
      let count = 1;
      while (i + (count + 1) * size <= words.length && words.slice(i + count * size, i + (count + 1) * size).map(word => norm(word.text)).join(" ") === unit) count++;
      if (count > maxRepeats) { out.push(...words.slice(i, i + size)); removed += (count - 1) * size; i += count * size; skipped = true; break; }
    }
    if (!skipped) { out.push(words[i]); i++; }
  }
  return { words: out, removed };
}

export type Grouping = { maxWords: number; maxSeconds: number; pause: number };
export const DEFAULT_GROUPING: Grouping = { maxWords: 7, maxSeconds: 3.5, pause: 0.6 };

/** Groups real word timings into caption segments. Each segment spans its first word's start to its last word's end. */
export function groupWords(words: TimedWord[], grouping: Grouping = DEFAULT_GROUPING): { text: string; start: number; end: number; words: TimedWord[] }[] {
  const out: { text: string; start: number; end: number; words: TimedWord[] }[] = [];
  let current: TimedWord[] = [];
  const flush = () => { if (current.length) out.push({ text: current.map(word => word.text).join(" "), start: current[0].start, end: current.at(-1)!.end, words: current }); current = []; };
  for (const word of words) {
    const last = current.at(-1);
    if (last && (word.start - last.end > grouping.pause || current.length >= grouping.maxWords || word.end - current[0].start > grouping.maxSeconds)) flush();
    current.push(word);
    if (/[.!?।॥]$/.test(word.text)) flush();
  }
  flush();
  // Keep segments ordered and non-overlapping even if word times touch.
  for (let i = 1; i < out.length; i++) if (out[i].start < out[i - 1].end) out[i - 1].end = out[i].start;
  return out.filter(segment => segment.end > segment.start);
}

import type { Word } from "./types";

/**
 * Placeholder words used by the render lab before a real transcript exists.
 * They are evenly spaced and do NOT match any real speech.
 */
export function makeTestWords(durationSec: number): Word[] {
  const phrase = "यह एक test caption है जो render pipeline check करता है".split(" ");
  const words: Word[] = [];
  const step = 0.4;
  for (let t = 0.2, i = 0; t + step <= durationSec; t += step, i++) {
    words.push({ text: phrase[i % phrase.length], start: round(t), end: round(t + step * 0.9) });
  }
  return words;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

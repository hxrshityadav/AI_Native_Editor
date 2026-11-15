/*
 * Rule-based transcript cleanup. Deterministic and local: no language model is involved, and nothing changes until the
 * user applies a step (each step is one undoable edit, and the original transcript is kept separately).
 * Word timings are preserved wherever the number of words does not change, and recomputed from real word times when
 * words are removed or captions are split or merged.
 */
import { MIN_CAPTION, captionId, type Caption } from "./captions";
import { restoreEnglish, toRoman, wordRestoreEnglish, wordToRoman } from "./hinglish";

const FILLERS = new Set(["um", "umm", "uh", "uhh", "erm", "hmm", "hm", "mm", "ah", "अं", "उम्म", "हम्म", "आं"]);
const norm = (word: string) => word.toLowerCase().replace(/[\p{P}\p{S}]/gu, "");

/** Applies a per-word transform to text and timed words alike, so timings stay attached. */
function mapWords(caption: Caption, transform: (word: string) => string): Caption {
  const text = caption.text.split(/(\s+)/).map(part => /\s/.test(part) ? part : transform(part)).join("");
  const words = caption.words?.map(word => ({ ...word, text: transform(word.text) }));
  return { ...caption, text, ...(words ? { words } : {}) };
}

export const romanise = (captions: Caption[]) => captions.map(caption => mapWords(caption, wordToRoman));
export const restoreEnglishWords = (captions: Caption[]) => captions.map(caption => mapWords(caption, wordRestoreEnglish));
export { toRoman, restoreEnglish };

/** Removes filler words ("um", "uh", "हम्म"). Captions left empty are dropped. */
export function removeFillers(captions: Caption[]): Caption[] {
  return captions.map(caption => {
    const keep = (word: string) => !FILLERS.has(norm(word));
    const words = caption.words?.filter(word => keep(word.text));
    const text = caption.text.split(/\s+/).filter(keep).join(" ");
    return { ...caption, text, ...(words ? { words } : {}) };
  }).filter(caption => caption.text.trim());
}

/** Fixes spacing around punctuation and capitalises sentence starts in Latin text. Devanagari is left as it is. */
export function tidyPunctuation(captions: Caption[]): Caption[] {
  let sentenceStart = true;
  return captions.map(caption => mapWords(caption, word => {
    let out = word.replace(/\s+([,.!?।])/g, "$1");
    if (sentenceStart && /^[a-z]/.test(out)) out = out[0].toUpperCase() + out.slice(1);
    sentenceStart = /[.!?।]$/.test(out);
    return out;
  })).map(caption => ({ ...caption, text: caption.text.replace(/\s+([,.!?।])/g, "$1").replace(/\bi\b/g, "I") }));
}

/** Splits captions longer than `maxWords` at real word times (or proportionally when there are none). */
export function splitLong(captions: Caption[], maxWords: number): Caption[] {
  const out: Caption[] = [];
  for (const caption of captions) {
    const tokens = caption.text.trim().split(/\s+/);
    if (tokens.length <= maxWords) { out.push(caption); continue; }
    for (let i = 0; i < tokens.length; i += maxWords) {
      const part = tokens.slice(i, i + maxWords), words = caption.words?.length === tokens.length ? caption.words.slice(i, i + maxWords) : undefined;
      const start = words ? words[0].start : caption.start + (caption.end - caption.start) * i / tokens.length;
      const end = words ? (i + maxWords < tokens.length ? caption.words![i + maxWords].start : caption.end) : caption.start + (caption.end - caption.start) * Math.min(tokens.length, i + maxWords) / tokens.length;
      out.push({ id: i ? captionId() : caption.id, start: Math.round(start * 1000) / 1000, end: Math.round(Math.max(start + MIN_CAPTION, end) * 1000) / 1000, text: part.join(" "), ...(words ? { words } : {}) });
    }
  }
  return out;
}

/** Merges captions shorter than `minSeconds` into the next one when they are close together (≤ 0.3 s apart). */
export function mergeShort(captions: Caption[], minSeconds = 0.8): Caption[] {
  const out: Caption[] = [];
  for (const caption of captions) {
    const last = out.at(-1);
    if (last && last.end - last.start < minSeconds && caption.start - last.end <= 0.3) {
      const words = last.words && caption.words ? [...last.words, ...caption.words] : undefined;
      out[out.length - 1] = { id: last.id, start: last.start, end: caption.end, text: `${last.text} ${caption.text}`.trim(), ...(words ? { words } : {}) };
    } else out.push(caption);
  }
  return out;
}

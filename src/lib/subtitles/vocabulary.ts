/*
 * User vocabulary for captions: names and terms the speech model does not know ("Claude", "Antigravity", "subagents").
 * The model cannot be biased in this Transformers.js version, so this works after recognition and only as suggestions:
 * runs of 1–3 recognised words whose spelling is close to a listed term are proposed for replacement, the user accepts
 * or ignores each one, and the raw transcript is never changed. It catches near-misses ("Hantic gravity",
 * "subagence", "work flow"), not words the model replaced with something unrelated ("plot" for "Claude").
 */
import type { Caption } from "./captions";

export type Suggestion = { id: string; caption: number; from: number; count: number; original: string; term: string; score: number };

export const MAX_TERMS = 200;
/** Parses a comma- or newline-separated list. Terms keep the user's casing; duplicates and very short entries are dropped. */
export function parseVocabulary(text: string): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const term = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    if (term.length < 3 || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase()); out.push(term);
    if (out.length >= MAX_TERMS) break;
  }
  return out;
}

/** Spelling key that tolerates how Hinglish speech is usually misheard or romanised. */
export function soundKey(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "")
    .replace(/ph/g, "f").replace(/(?:ck|q|c(?=[aou])|c$)/g, "k").replace(/c/g, "s").replace(/w/g, "v").replace(/z/g, "j").replace(/x/g, "ks")
    .replace(/(?<=[bdgkpt])h/g, "").replace(/aa/g, "a").replace(/ee/g, "i").replace(/oo/g, "u").replace(/y/g, "i").replace(/(.)\1+/g, "$1");
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { const row = [i]; for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = row; }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

/** Everyday Hindi and English function words never start or end a suggestion, so "ki", "hai" or "the" are not rewritten. */
const COMMON = new Set("a an the of to in on is are and or but for with ki ka ke ko se hai hain ho tha thi the aur bhi to toh ye yeh yah vo woh wo hum ham main mein me tum aap kya kaise jab tab ab ek do na nahi par per iske uske isko usko".split(" "));
const bare = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Finds near-miss spellings of the terms in the captions. Threshold tuned on a real Hinglish reel (2026-11-15). */
export function findSuggestions(captions: Caption[], terms: string[], threshold = 0.74): Suggestion[] {
  const keys = terms.map(term => ({ term, key: soundKey(term), words: term.split(" ").length })).filter(t => t.key.length >= 3), out: Suggestion[] = [];
  captions.forEach((caption, index) => {
    const tokens = caption.text.split(/\s+/).filter(Boolean), taken = new Set<number>();
    const candidates: Suggestion[] = [];
    for (let from = 0; from < tokens.length; from++) for (let count = 1; count <= 3 && from + count <= tokens.length; count++) {
      const span = tokens.slice(from, from + count), first = bare(span[0]), last = bare(span[count - 1]);
      if (COMMON.has(first) || COMMON.has(last)) continue;
      const original = span.join(" "), key = soundKey(original);
      for (const t of keys) {
        if (Math.abs(t.words - count) > 1 || original.replace(/[^\p{L}\p{N} ]/gu, "") === t.term) continue;
        const score = similarity(key, t.key);
        if (score >= threshold && key.length >= t.key.length * 0.6) candidates.push({ id: `${caption.id}:${from}:${count}:${t.term}`, caption: index, from, count, original, term: t.term, score: Math.round(score * 100) / 100 });
      }
    }
    // Best first; overlapping spans keep only the stronger suggestion.
    for (const c of candidates.sort((a, b) => b.score - a.score || b.count - a.count)) {
      if (Array.from({ length: c.count }, (_, k) => c.from + k).some(k => taken.has(k))) continue;
      for (let k = 0; k < c.count; k++) taken.add(c.from + k);
      out.push(c);
    }
  });
  return out.sort((a, b) => a.caption - b.caption || a.from - b.from);
}

/**
 * Applies accepted suggestions. Punctuation attached to the replaced words is kept. Word timings stay real: when the term
 * has the same number of words, each keeps its recognised time; otherwise the term's words share the replaced span.
 */
export function applySuggestions(captions: Caption[], accepted: Suggestion[]): Caption[] {
  return captions.map((caption, index) => {
    const mine = accepted.filter(s => s.caption === index).sort((a, b) => b.from - a.from);
    if (!mine.length) return caption;
    const tokens = caption.text.split(/\s+/).filter(Boolean);
    const timed = caption.words && caption.words.length === tokens.length ? [...caption.words] : undefined;
    for (const s of mine) {
      const lead = /^[^\p{L}\p{N}]*/u.exec(tokens[s.from])![0], tail = /[^\p{L}\p{N}]*$/u.exec(tokens[s.from + s.count - 1])![0];
      const replacement = `${lead}${s.term}${tail}`.split(" ");
      tokens.splice(s.from, s.count, ...replacement);
      if (timed) {
        const span = timed.slice(s.from, s.from + s.count), start = span[0].start, end = span[span.length - 1].end;
        const words = replacement.map((text, k) => replacement.length === span.length ? { ...span[k], text } : { text, start, end });
        timed.splice(s.from, s.count, ...words);
      }
    }
    return { ...caption, text: tokens.join(" "), ...(timed ? { words: timed } : {}) };
  });
}

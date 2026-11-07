import { z } from "zod";
import type { Cue } from "./text";

const input = z.object({ duration: z.number().positive().max(600), cues: z.array(z.object({ start: z.number().nonnegative(), end: z.number().positive(), text: z.string().trim().min(1).max(500) })).min(1).max(1000) });
export type LectureNotes = { sections: { start: number; end: number; cues: Cue[] }[]; points: Cue[]; cards: { start: number; question: string; answer: string }[]; markdown: string; text: string };
export const noteTime = (n: number) => { const ms=Math.round(n*1000),fraction=ms%1000; return `${Math.floor(ms/60000).toString().padStart(2,"0")}:${Math.floor(ms%60000/1000).toString().padStart(2,"0")}${fraction?`.${fraction.toString().padStart(3,"0")}`:""}`; };

/** Extractive study aids: every point and answer is copied from reviewed source text. */
export function lectureNotes(cues: Cue[], duration: number): LectureNotes {
  const parsed = input.safeParse({ cues, duration });
  if (!parsed.success) throw new Error("Add 1–1,000 non-empty transcript segments of up to 500 characters, within a ten-minute recording.");
  let end = 0;
  for (const cue of parsed.data.cues) {
    if (cue.start < end || cue.end <= cue.start || cue.end > duration + .05) throw new Error("Review transcript times: segments must be ordered, non-overlapping and inside the recording.");
    end = cue.end;
  }
  const sections: LectureNotes["sections"] = [];
  for (const cue of parsed.data.cues) {
    let section = sections.at(-1);
    if (!section || cue.start - section.end >= 8 || cue.end - section.start > 90) { section = { start: cue.start, end: cue.end, cues: [] }; sections.push(section); }
    section.cues.push(cue); section.end = cue.end;
  }
  const words = (text: string) => text.toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  const frequency = new Map<string, number>();
  for (const cue of parsed.data.cues) for (const word of new Set(words(cue.text))) frequency.set(word, (frequency.get(word) ?? 0) + 1);
  const seen = new Set<string>();
  const points = parsed.data.cues.filter(cue => { const key = cue.text.toLocaleLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
    .map(cue => ({ cue, score: words(cue.text).reduce((sum, word) => sum + (frequency.get(word) ?? 0), 0) / Math.max(1, words(cue.text).length) }))
    .sort((a, b) => b.score - a.score || a.cue.start - b.cue.start).slice(0, 8).map(x => x.cue).sort((a, b) => a.start - b.start);
  const cards = points.flatMap(cue => {
    const word = cue.text.match(/[\p{L}]{5,}/u)?.[0];
    return word ? [{ start: cue.start, question: cue.text.replace(word, "_____"), answer: word }] : [];
  });
  // Escaping prevents transcript content from becoming active links/images or Markdown headings.
  const escape = (text: string) => text.replace(/[\\`*_{}\[\]()#+.!<>|~-]/g, "\\$&").replace(/[\r\n]+/g, " ");
  const lines = ["# Lecture notes", "", "Extractive notes from the reviewed transcript. Key points are selected quotes, not a generated explanation or fact check.", "", "## Key points (extractive summary)", ...points.map(cue => `- [${noteTime(cue.start)}] ${escape(cue.text)}`), "", "## Timestamped sections"];
  for (const section of sections) lines.push("", `### ${noteTime(section.start)}–${noteTime(section.end)}`, ...section.cues.map(cue => `- [${noteTime(cue.start)}] ${escape(cue.text)}`));
  lines.push("", "## Cloze practice", "Fill the blank with the exact source word. These are recall prompts, not generated knowledge questions.");
  for (const card of cards) lines.push("", `- [${noteTime(card.start)}] ${escape(card.question)}`, `  Answer: ${escape(card.answer)}`);
  const text = ["LECTURE NOTES", "Extractive notes: selected source quotes, not a generated explanation or fact check.", "", "KEY POINTS", ...points.map(c => `[${noteTime(c.start)}] ${c.text}`), "", "TIMESTAMPED TRANSCRIPT", ...parsed.data.cues.map(c => `[${noteTime(c.start)}–${noteTime(c.end)}] ${c.text}`), "", "CLOZE PRACTICE", ...cards.map(c => `[${noteTime(c.start)}] ${c.question}\nAnswer: ${c.answer}`)].join("\n");
  return { sections, points, cards, markdown: lines.join("\n"), text };
}

"use client";
import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import type { Caption } from "@/lib/subtitles/captions";
import { applySuggestions, findSuggestions, parseVocabulary, type Suggestion } from "@/lib/subtitles/vocabulary";
import { InlineMessage, styles } from "../../tools/surface/ToolSurface";
import css from "../SubtitleStudio.module.css";

/*
 * Names and terms the speech model does not know. Near-miss spellings in the captions are offered as suggestions; each
 * one is accepted or ignored by the user and every change is an undoable edit. The raw transcript is never changed.
 */
const KEY = "rf-caption-vocabulary-v1";
const load = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

export function VocabularyPanel({ captions, onApply }: { captions: Caption[]; onApply: (next: Caption[], label: string) => void }) {
  const [text, setText] = useState(() => typeof window === "undefined" ? "" : load()), [searched, setSearched] = useState(false), [ignored, setIgnored] = useState<Set<string>>(new Set());
  const terms = useMemo(() => parseVocabulary(text), [text]);
  const key = (s: Suggestion) => `${captions[s.caption]?.id}|${s.original}|${s.term}`;
  const suggestions = useMemo(() => searched ? findSuggestions(captions, terms).filter(s => !ignored.has(`${captions[s.caption]?.id}|${s.original}|${s.term}`)) : [], [searched, captions, terms, ignored]);
  const save = (value: string) => { setText(value); try { localStorage.setItem(KEY, value); } catch { /* storage blocked: kept for this session */ } };
  const accept = (list: Suggestion[]) => onApply(applySuggestions(captions, list), list.length === 1 ? `Replaced “${list[0].original}” with “${list[0].term}”` : `Applied ${list.length} name and term fixes`);

  return <details className={css.section}><summary>Names and terms</summary><div className={css.sectionBody}>
    <p className={styles.help}>List names and technical terms the speech model may mishear, such as Claude, Gemini or subagents. The studio suggests fixes for close misspellings only; it cannot fix a word the model replaced with something unrelated. Nothing changes until you accept a suggestion, and the raw transcription is kept.</p>
    <label className={styles.group}><span className={styles.label}>Names and terms<span className={styles.value}>{terms.length}</span></span>
      <textarea aria-label="Names and terms" className={styles.field} rows={3} placeholder="Antigravity, Claude, Gemini, subagents, workflow" value={text} onChange={event => { save(event.target.value); setSearched(false); }} /></label>
    <div className={css.actions}>
      <button type="button" className={styles.secondary} disabled={!terms.length || !captions.length} onClick={() => { setIgnored(new Set()); setSearched(true); }}>Find suggestions</button>
      {suggestions.length > 1 && <button type="button" className={styles.secondary} onClick={() => accept(suggestions)}>Accept all {suggestions.length}</button>}
    </div>
    {searched && !suggestions.length && <InlineMessage role="status">No close matches for these terms in the captions.</InlineMessage>}
    {suggestions.length > 0 && <ul className={css.suggestions} aria-label="Suggested fixes">
      {suggestions.map(s => <li key={s.id}>
        <span className={css.num}>{s.caption + 1}</span>
        <span className={css.change}><del>{s.original}</del> → <ins>{s.term}</ins></span>
        <button type="button" className={css.icon} aria-label={`Accept: replace ${s.original} with ${s.term}`} onClick={() => accept([s])}><Check aria-hidden size={16} /></button>
        <button type="button" className={css.icon} aria-label={`Ignore: keep ${s.original}`} onClick={() => setIgnored(current => new Set(current).add(key(s)))}><X aria-hidden size={16} /></button>
      </li>)}
    </ul>}
  </div></details>;
}

"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Captions, Merge, Plus, Redo2, Scissors, Trash2, Undo2 } from "lucide-react";
import type { MediaInfo } from "@/lib/mediatools/engine";
import { runMediaTask } from "@/lib/mediatools/client";
import { runSpeech, type Transcript } from "@/lib/localtools/speechClient";
import { hasCompleteCueText } from "@/lib/localtools/text";
import { CAPTION_FONTS, PRESETS, add, captionId, fontById, fromCues, hasWordTiming, merge, remove, setText, setTiming, split, toSrt, toVtt, validate, type Caption, type CaptionStyle } from "@/lib/subtitles/captions";
import { DEFAULT_COMPOSITION, type Composition } from "@/lib/subtitles/compose";
import { burnSize, loadCaptionFont, uprightSize, type BurnResult } from "@/lib/subtitles/burn";
import { mergeShort, removeFillers, restoreEnglishWords, romanise, splitLong, tidyPunctuation } from "@/lib/subtitles/cleanup";
import { enforceRoman, hasDevanagari, normalizeHinglish } from "@/lib/subtitles/hinglish";
import { groupWords, type TimedWord } from "@/lib/subtitles/transcript";
import { restoreCustomFonts, type StoredFont } from "@/lib/subtitles/fonts";
import { useBlobUrl } from "../tools/useBlobUrl";
import { DetailsTable, FileDetails, FileDropzone, FilePicker, InlineMessage, PrimaryButton, ProcessingPanel, shortSize, styles } from "../tools/surface/ToolSurface";
import { StudioPreview } from "./studio/StudioPreview";
import { StylePanel } from "./studio/StylePanel";
import { LayoutPanel } from "./studio/LayoutPanel";
import { VocabularyPanel } from "./studio/VocabularyPanel";
import { TranscribePanel, type CaptionModel, type Recognition, type SpeechMode } from "./studio/TranscribePanel";
import css from "./SubtitleStudio.module.css";

/*
 * Subtitle Studio: video -> local Whisper transcript with real word timings (or manual captions) -> edit -> style ->
 * frame -> SRT, VTT or burned-in MP4. The preview canvas is the export renderer (same paintFrame and drawCaption,
 * same size), so what you see is what is exported.
 */

const ACCEPT = "video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv";
const TABS = [["transcribe", "Transcribe"], ["captions", "Captions"], ["style", "Style"], ["layout", "Layout"], ["export", "Export"]] as const;
type Tab = typeof TABS[number][0];
const stamp = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
const baseName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100) || "video";
const loadedFonts = new Map<string, Promise<void>>();
const loadDocumentFont = (id: string) => { if (fontById(id).custom) return Promise.resolve(); if (!loadedFonts.has(id)) loadedFonts.set(id, loadCaptionFont(id, { fonts: document.fonts, location }).catch(failure => { loadedFonts.delete(id); throw failure; })); return loadedFonts.get(id)!; };
const devanagariShare = (text: string) => { const letters = [...text].filter(c => /\p{L}/u.test(c)); return letters.length ? letters.filter(c => /\p{Script=Devanagari}/u.test(c)).length / letters.length : 0; };

type History = { past: Caption[][]; present: Caption[]; future: Caption[][]; key: string; at: number };
const EMPTY: History = { past: [], present: [], future: [], key: "", at: 0 };
function RawTranscript({raw}:{raw?:string}) {
  return raw ? <details className={css.section}><summary>Raw transcription</summary><div className={css.sectionBody}><p className={styles.help}>Exactly what the model returned, before captions, Roman conversion or any clean-up. Kept for comparison.</p><p className={css.raw} data-testid="raw-transcript">{raw}</p></div></details> : null;
}
type Original = { words: TimedWord[]; mode: SpeechMode; raw: string };

export function SubtitleStudio() {
  const [file, setFile] = useState<File>(), [info, setInfo] = useState<MediaInfo>();
  const [history, setHistory] = useState<History>(EMPTY), captions = history.present;
  const [original, setOriginal] = useState<Original>(), [recognition, setRecognition] = useState<Recognition>(), [grouping, setGrouping] = useState(6);
  const [selected, setSelected] = useState(-1), [tab, setTab] = useState<Tab>("transcribe");
  const [style, setStyleState] = useState<CaptionStyle>(PRESETS.clean.style), [composition, setComposition] = useState<Composition>(DEFAULT_COMPOSITION), [guides, setGuides] = useState(true);
  const [mode, setModeState] = useState<SpeechMode>("auto"), [model, setModel] = useState<CaptionModel>("tiny"), [consent, setConsentState] = useState<Record<CaptionModel, boolean>>({ tiny: false, base: false, "hinglish-swift": false });
  // Swift writes Roman Hinglish; Hindi mode must keep a multilingual model instead.
  const setMode = (next: SpeechMode) => { setModeState(next); setModel(next === "hinglish" ? "hinglish-swift" : model === "hinglish-swift" ? "tiny" : model); };
  const [busy, setBusy] = useState(""), [progress, setProgress] = useState<number>(), [error, setError] = useState(""), [notice, setNotice] = useState(""), [fontError, setFontError] = useState("");
  const [fontReady, setFontReady] = useState(""), [allFonts, setAllFonts] = useState(false), [customFonts, setCustomFonts] = useState<StoredFont[]>([]);
  const [result, setResult] = useState<BurnResult>(), [resultKey, setResultKey] = useState("");
  const active = useRef<AbortController | null>(null), video = useRef<HTMLVideoElement>(null), editor = useRef<HTMLTextAreaElement>(null), list = useRef<HTMLOListElement>(null), root = useRef<HTMLElement>(null), keys = useRef<(event: KeyboardEvent) => void>(() => {}), playhead = useRef(0);
  const sourceUrl = useBlobUrl(file), resultUrl = useBlobUrl(result?.blob);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => { void restoreCustomFonts().then(setCustomFonts); }, []);

  const source = useMemo(() => info?.video ? uprightSize(info) : { width: 1920, height: 1080 }, [info]);
  const size = useMemo(() => { try { return info?.video ? burnSize(info, composition) : undefined; } catch { return undefined; } }, [info, composition]);
  // Captions from Roman Hinglish must stay Roman, including after edits and clean-up.
  const romanOnly = original?.mode === "hinglish";
  const issues = useMemo(() => info ? [...validate(captions, info.duration, style), ...(romanOnly ? captions.flatMap((caption, index) => hasDevanagari(caption.text) ? [{ index, level: "error" as const, message: "Roman Hinglish captions use Roman letters only. Convert this caption to Roman." }] : []) : [])] : [], [captions, info, style, romanOnly]);
  const errors = issues.filter(issue => issue.level === "error"), hasWords = captions.some(hasWordTiming), devanagari = captions.some(caption => /\p{Script=Devanagari}/u.test(caption.text));
  const exportKey = JSON.stringify([captions, style, composition]), freshResult = result && resultKey === exportKey ? result : undefined;
  const setStyle = (next: CaptionStyle) => setStyleState(next);
  const patchStyle = useCallback((patch: Partial<CaptionStyle>) => setStyleState(current => ({ ...current, ...patch })), []);

  /** Every caption edit goes through here. Typing in one caption is grouped into one undo step per pause. */
  const commit = useCallback((next: Caption[], key = "") => setHistory(current => {
    const now = Date.now(), coalesce = key && key === current.key && now - current.at < 1200;
    return { past: coalesce ? current.past : [...current.past, current.present].slice(-200), present: next, future: [], key, at: now };
  }), []);
  const undo = () => setHistory(current => current.past.length ? { past: current.past.slice(0, -1), present: current.past.at(-1)!, future: [current.present, ...current.future], key: "", at: 0 } : current);
  const redo = () => setHistory(current => current.future.length ? { past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1), key: "", at: 0 } : current);
  const attempt = (work: () => void) => { try { setError(""); work(); } catch (failure) { setError(failure instanceof Error ? failure.message : "That edit is not possible."); } };

  // The selected caption font loads into the page so the preview never draws in a fallback face.
  useEffect(() => {
    let cancelled = false;
    loadDocumentFont(style.font).then(() => { if (!cancelled) { setFontError(""); setFontReady(style.font); } }).catch(failure => { if (!cancelled) setFontError(failure instanceof Error ? failure.message : "The caption font could not be loaded."); });
    return () => { cancelled = true; };
  }, [style.font]);
  // Preset thumbnails need every bundled font; they load when the Style tab is first opened.
  useEffect(() => { if (tab === "style" && !allFonts) void Promise.allSettled(CAPTION_FONTS.map(font => loadDocumentFont(font.id))).then(() => setAllFonts(true)); }, [tab, allFonts]);
  useEffect(() => { list.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: "nearest" }); }, [selected]);
  const onTime = useCallback((time: number) => { playhead.current = time; }, []);

  function reset() { active.current?.abort(); active.current = null; setBusy(""); setProgress(undefined); setError(""); setNotice(""); }
  function clear() { reset(); setResult(undefined); setFile(undefined); setInfo(undefined); setHistory(EMPTY); setOriginal(undefined); setRecognition(undefined); setSelected(-1); setTab("transcribe"); setComposition(DEFAULT_COMPOSITION); }
  function cancel() { active.current?.abort(); active.current = null; setBusy(""); setProgress(undefined); setNotice("Cancelled. Your video and captions are unchanged."); }
  async function load(files: FileList) {
    clear();
    if (files.length !== 1) { setError("Choose one video at a time."); return; }
    const chosen = files[0], controller = new AbortController(); active.current = controller; setBusy("Reading the video…");
    try {
      const inspected = await runMediaTask({ kind: "inspect", file: chosen, expect: "video" }, controller.signal);
      if (controller.signal.aborted) return;
      burnSize(inspected, DEFAULT_COMPOSITION);
      setFile(chosen); setInfo(inspected);
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "This video could not be read."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }

  /** Builds captions from real word timings and applies the chosen Hinglish script. */
  const buildCaptions = useCallback((words: TimedWord[], maxWords: number): Caption[] =>
    groupWords(words, { maxWords, maxSeconds: 3.5, pause: 0.6 }).map(segment => ({ id: captionId(), start: Math.round(segment.start * 1000) / 1000, end: Math.round(segment.end * 1000) / 1000, text: segment.text, words: segment.words })), []);

  async function transcribe() {
    if (!file || !info?.audio || !consent[model]) return;
    reset(); setResult(undefined);
    const controller = new AbortController(); active.current = controller; setBusy("Preparing local transcription");
    try {
      const transcript = await runSpeech<Transcript>({ kind: "transcribe", file, language: mode === "auto" ? "auto" : mode === "en" ? "en" : "hi", translate: false, longRecording: true, captionModel: model }, controller.signal, value => { if (!controller.signal.aborted) setBusy(value); }, value => { if (!controller.signal.aborted) setProgress(value); });
      if (controller.signal.aborted) return;
      // Roman Hinglish is its own pipeline: every recognised word is forced to Roman letters before captions are built.
      let romanised = 0;
      const roman = (text: string) => { if (mode !== "hinglish") return text; const result = enforceRoman(text); romanised += result.converted; return result.text; };
      const words = (transcript.words ?? []).map(word => ({ ...word, text: roman(word.text), end: Math.min(word.end, info.duration) })).filter(word => word.text.trim());
      const incomplete = transcript.timingIncomplete ?? !hasCompleteCueText(transcript.text,transcript.cues);
      const built = words.length ? buildCaptions(words, grouping) : incomplete ? [] : fromCues(transcript.cues.map(cue => ({ ...cue, text: roman(cue.text), end: Math.min(cue.end, info.duration) })));
      const language = transcript.language ?? (mode === "en" ? "en" : "hi");
      const translatedWarning = mode !== "hinglish" && language === "hi" && devanagariShare(transcript.text) < 0.3;
      if (built.length) { commit(built); setSelected(0); }
      setOriginal({ words, mode, raw: transcript.rawText ?? transcript.text });
      setRecognition({ mode, model, language, romanised, wordTiming: transcript.wordTiming !== false && words.length > 0, timingMode: words.length ? "word" : built.length ? "phrase" : "manual", detected: transcript.detected, seconds: transcript.seconds, words: words.length, loopsRemoved: transcript.loopsRemoved, translatedWarning });
      setNotice(!built.length ? "Speech was recognized but reliable timestamps are unavailable. Existing captions are unchanged. Review the raw transcription and write captions by hand." : words.length ? `${built.length} captions built from ${words.length} timed words. Review every line before export.` : `${built.length} captions with phrase timing. Review every line before export.`);
      setTab(built.length ? "captions" : "transcribe");
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Transcription failed. Try a shorter video."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); setProgress(undefined); } }
  }
  async function exportVideo() {
    if (!file || errors.length) return;
    reset(); const controller = new AbortController(); active.current = controller; setBusy("Preparing export");
    const key = exportKey, font = fontById(style.font), stored = font.custom ? customFonts.find(f => f.id === style.font) : undefined;
    try {
      const output = await runMediaTask({ kind: "burn", file, options: { captions, style, composition, ...(stored ? { customFont: { id: stored.id, label: stored.label, scripts: stored.scripts, data: stored.data } } : {}) } }, controller.signal, setProgress, setBusy);
      if (!controller.signal.aborted) { setResult(output); setResultKey(key); }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "The video could not be exported."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); setProgress(undefined); } }
  }

  const seekTo = (time: number) => { if (video.current) video.current.currentTime = time; };
  const choose = (index: number) => { setSelected(index); if (captions[index]) seekTo(captions[index].start + 0.001); };
  const now = () => video.current?.currentTime ?? playhead.current;
  const addCaption = () => attempt(() => { const next = add(captions, now(), info!.duration); commit(next.captions); setSelected(next.index); setTab("captions"); requestAnimationFrame(() => editor.current?.focus()); });
  const splitCaption = (index: number) => attempt(() => { const cursor = index === selected && editor.current ? editor.current.selectionStart : undefined; commit(split(captions, index, cursor || undefined)); });
  const time = (index: number, start: number, end: number) => attempt(() => commit(setTiming(captions, index, start, end, info!.duration), `time-${captions[index].id}`));
  const clean = (label: string, work: (current: Caption[]) => Caption[]) => attempt(() => { const next = work(captions); commit(next); setNotice(`${label}: ${next.length} captions. Undo restores the previous version.`); });

  function onKeyDown(event: KeyboardEvent) {
    const mod = event.ctrlKey || event.metaKey, target = event.target as HTMLElement, typing = /^(INPUT|SELECT)$/.test(target.tagName);
    if (target !== document.body && !root.current?.contains(target)) return;
    if (mod && event.key.toLowerCase() === "z" && !typing) { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
    if (mod && event.key.toLowerCase() === "y" && !typing) { event.preventDefault(); redo(); return; }
    if (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) { event.preventDefault(); choose(Math.max(0, Math.min(captions.length - 1, selected + (event.key === "ArrowDown" ? 1 : -1)))); return; }
    if (mod && event.key === "Enter" && selected >= 0) { event.preventDefault(); splitCaption(selected); }
  }
  useEffect(() => { keys.current = onKeyDown; });
  useEffect(() => { const listener = (event: KeyboardEvent) => keys.current(event); document.addEventListener("keydown", listener); return () => document.removeEventListener("keydown", listener); }, []);

  const messages = <>{notice && <InlineMessage role="status">{notice}</InlineMessage>}{error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}</>;
  if (!file || !info) return <section aria-label="Subtitle Studio workspace" className={styles.root}>
    <FileDropzone icon={Captions} title="Drop a video here" pickLabel="Choose video" inputLabel="Choose video" accept={ACCEPT} busy={busy} onCancel={cancel} onFiles={files => void load(files)}
      facts={<><span>MP4, MOV, WebM or MKV</span><span>Up to 10 minutes</span><span>English, Hindi, Hinglish</span></>} />
    {messages}
  </section>;

  return <section ref={root} aria-label="Subtitle Studio workspace" className={`${styles.root} ${css.studio}`}>
    <FileDetails name={file.name} factsLabel="Video details" onStartOver={clear}
      thumb={<span className={`${styles.thumb} grid place-items-center text-subtle`} aria-hidden><Captions size={20} /></span>}
      picker={<FilePicker label="Replace video" inputLabel="Choose video" accept={ACCEPT} onFiles={files => void load(files)} />}
      facts={<><span>{stamp(info.duration)}</span><span>{source.width} × {source.height}</span><span>{info.audio ? info.audio.codec.toUpperCase() : "No audio"}</span><span>{shortSize(file.size)}</span></>} />
    <div className={css.workspace}>
      <div className={css.previewStack}>
        {size && sourceUrl && <StudioPreview src={sourceUrl} size={size} captions={captions} style={style} composition={composition} guides={guides} fontReady={fontReady === style.font} video={video}
          onStyle={patchStyle} onFraming={(x, y) => setComposition(current => ({ ...current, framing: { ...current.framing, x, y } }))} onTime={onTime} duration={info.duration} />}
        <div className={css.previewMeta}>
          <span>Preview at export size {size ? `${size.width} × ${size.height}` : ""}</span>
          <label className={css.check}><input type="checkbox" checked={guides} onChange={event => setGuides(event.target.checked)} /> Safe-area guides</label>
        </div>
        {busy && <ProcessingPanel title={/export|encod|Drawing/i.test(busy) ? "Exporting video" : "Working locally"} status={busy} progress={progress} onCancel={cancel} progressUnit="complete" progressLabel="Progress" />}
        {fontError && <InlineMessage role="alert" tone="error">{fontError}</InlineMessage>}
      </div>

      <div className={css.panel}>
        <div className={css.tabs} role="tablist" aria-label="Subtitle Studio sections">
          {TABS.map(([id, label]) => <button key={id} type="button" role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={tab === id} className={css.tab} onClick={() => setTab(id)}>
            {label}{id === "captions" && captions.length ? <span className={css.count}>{captions.length}</span> : null}{id === "captions" && errors.length > 0 && <span className={css.badge}>{errors.length}</span>}</button>)}
        </div>

        {tab === "transcribe" && <div role="tabpanel" id="panel-transcribe" aria-labelledby="tab-transcribe" className={css.body}>
          <TranscribePanel mode={mode} setMode={setMode} model={model} setModel={setModel} consent={consent} setConsent={(id, value) => setConsentState(current => ({ ...current, [id]: value }))}
            busy={!!busy} hasAudio={!!info.audio} onTranscribe={() => void transcribe()} onManual={addCaption} recognition={recognition} hasCaptions={captions.length > 0} />
          {messages}
          <RawTranscript raw={original?.raw} />
        </div>}

        {tab === "captions" && <div role="tabpanel" id="panel-captions" aria-labelledby="tab-captions" className={css.body}>
          {!captions.length ? <><InlineMessage>No captions yet. Transcribe the video, or add a caption at the playhead.</InlineMessage><button type="button" className={styles.secondary} onClick={addCaption}>Write captions by hand</button>{messages}<RawTranscript raw={original?.raw} /></> : <>
            <div className={css.toolbar}>
              <button type="button" className={css.icon} aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!history.past.length} onClick={undo}><Undo2 aria-hidden size={16} /></button>
              <button type="button" className={css.icon} aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!history.future.length} onClick={redo}><Redo2 aria-hidden size={16} /></button>
              <button type="button" className={css.text} onClick={addCaption}><Plus aria-hidden size={16} />Add at playhead</button>
            </div>
            {messages}
            <ol ref={list} className={css.list} aria-label="Captions">
              {captions.map((caption, index) => {
                const rowIssues = issues.filter(issue => issue.index === index), open = index === selected;
                return <li key={caption.id} data-index={index} className={css.row} data-open={open || undefined} data-error={rowIssues.some(issue => issue.level === "error") || undefined}>
                  <button type="button" className={css.rowHead} aria-expanded={open} aria-label={`Caption ${index + 1}, ${stamp(caption.start)} to ${stamp(caption.end)}`} onClick={() => choose(index)}>
                    <span className={css.num}>{index + 1}</span><span className={css.times}>{stamp(caption.start)} → {stamp(caption.end)}</span><span className={css.preview}>{caption.text || "Empty caption"}</span>
                  </button>
                  {open && <div className={css.rowBody}>
                    <textarea ref={editor} aria-label={`Caption ${index + 1} text`} className={styles.field} rows={2} maxLength={300} value={caption.text} onChange={event => commit(setText(captions, index, event.target.value), `text-${caption.id}`)} />
                    <p className={styles.help}>{hasWordTiming(caption) ? `${caption.words!.length} words with recognised timings.` : "No word timings; this caption shows whole."}</p>
                    <div className={css.timeRow}>
                      <label>Start (s)<input className={styles.field} aria-label={`Caption ${index + 1} start`} type="number" step={0.01} min={0} max={info.duration} value={caption.start} onChange={event => time(index, Number(event.target.value), caption.end)} /></label>
                      <label>End (s)<input className={styles.field} aria-label={`Caption ${index + 1} end`} type="number" step={0.01} min={0} max={info.duration} value={caption.end} onChange={event => time(index, caption.start, Number(event.target.value))} /></label>
                    </div>
                    <div className={css.actions}>
                      <button type="button" className={css.text} onClick={() => time(index, now(), caption.end)}>Start at playhead</button>
                      <button type="button" className={css.text} onClick={() => time(index, caption.start, now())}>End at playhead</button>
                      <button type="button" className={css.text} onClick={() => splitCaption(index)}><Scissors aria-hidden size={16} />Split</button>
                      <button type="button" className={css.text} disabled={index === captions.length - 1} onClick={() => attempt(() => commit(merge(captions, index)))}><Merge aria-hidden size={16} />Merge with next</button>
                      <button type="button" className={`${css.text} ${css.danger}`} onClick={() => attempt(() => { commit(remove(captions, index)); setSelected(Math.min(index, captions.length - 2)); })}><Trash2 aria-hidden size={16} />Delete</button>
                    </div>
                  </div>}
                  {rowIssues.map((issue, i) => <p key={i} className={issue.level === "error" ? css.issue : css.warn}>{issue.message}{/no Devanagari/.test(issue.message) && <button type="button" className={css.inlineFix} onClick={() => patchStyle({ font: "mukta" })}>Use Mukta</button>}{/Roman letters only/.test(issue.message) && <button type="button" className={css.inlineFix} onClick={() => clean("Converted to Roman", current => current.map((c, j) => j === index ? { ...c, text: enforceRoman(c.text).text, ...(c.words ? { words: c.words.map(w => ({ ...w, text: enforceRoman(w.text).text })) } : {}) } : c))}>Convert to Roman</button>}</p>)}
                </li>;
              })}
            </ol>
            <details className={css.section}><summary>Clean up</summary><div className={css.sectionBody}>
              <p className={styles.help}>Rule-based tools that run on this device; no AI model rewrites your words. Each one is a single step you can undo.</p>
              <div className={css.actions}>
                <button type="button" className={styles.secondary} onClick={() => clean("Removed filler words", removeFillers)}>Remove filler words</button>
                <button type="button" className={styles.secondary} onClick={() => clean("Tidied punctuation and capitals", tidyPunctuation)}>Fix punctuation and capitals</button>
                <button type="button" className={styles.secondary} onClick={() => clean("Split long captions", current => splitLong(current, Math.max(2, grouping)))}>Split long captions</button>
                <button type="button" className={styles.secondary} onClick={() => clean("Merged short captions", current => mergeShort(current))}>Merge very short captions</button>
                {devanagari && <button type="button" className={styles.secondary} onClick={() => clean("Converted to Roman script", romanise)}>Convert Devanagari to Roman</button>}
                {devanagari && !romanOnly && <button type="button" className={styles.secondary} onClick={() => clean("Restored English words", restoreEnglishWords)}>Put English words back in Latin</button>}
                {romanOnly && <button type="button" className={styles.secondary} onClick={() => clean("Tidied Hinglish spacing and capitals", current => current.map(c => ({ ...c, text: normalizeHinglish(c.text) })))}>Tidy spacing and capitals</button>}
              </div>
              {original && original.words.length > 0 && <>
                <label className={styles.group}><span className={styles.label}>Words per caption<span className={styles.value}>{grouping}</span></span>
                  <input className={styles.range} type="range" aria-label="Words per caption" min={1} max={14} step={1} value={grouping} onChange={event => setGrouping(Number(event.target.value))} /></label>
                <button type="button" className={styles.secondary} onClick={() => clean("Rebuilt from word timings", () => buildCaptions(original.words, grouping))}>Rebuild captions from the recognised words</button>
                <p className={styles.help}>Rebuilding starts again from what the model recognised ({original.words.length} timed words), replacing your edits. Undo brings them back.</p>
              </>}
            </div></details>
            <VocabularyPanel captions={captions} onApply={(next, label) => { commit(next); setNotice(`${label}. Undo restores the previous text.`); }} />
            <RawTranscript raw={original?.raw} />
            <details className={css.keys}><summary>Keyboard shortcuts</summary>
              <dl><dt><kbd>Ctrl</kbd> <kbd>Z</kbd></dt><dd>Undo</dd><dt><kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>Z</kbd></dt><dd>Redo</dd><dt><kbd>Alt</kbd> <kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Previous or next caption</dd><dt><kbd>Ctrl</kbd> <kbd>Enter</kbd></dt><dd>Split at the text cursor</dd></dl></details>
          </>}
        </div>}

        {tab === "style" && <div role="tabpanel" id="panel-style" aria-labelledby="tab-style" className={css.body}>
          <StylePanel style={style} setStyle={setStyle} hasWords={hasWords} fontsReady={allFonts} customFonts={customFonts} setCustomFonts={setCustomFonts} devanagari={devanagari} />
        </div>}

        {tab === "layout" && <div role="tabpanel" id="panel-layout" aria-labelledby="tab-layout" className={css.body}>
          <LayoutPanel composition={composition} setComposition={setComposition} style={style} setStyle={patchStyle} source={source} />
        </div>}

        {tab === "export" && <div role="tabpanel" id="panel-export" aria-labelledby="tab-export" className={css.body}>
          {errors.length > 0 && <InlineMessage role="alert" tone="error">{errors.length} caption{errors.length === 1 ? " needs" : "s need"} fixing before export. The first is caption {errors[0].index + 1}: {errors[0].message}</InlineMessage>}
          {!captions.length && <InlineMessage>Add captions first.</InlineMessage>}
          <h2 className={styles.label}>Subtitle files</h2>
          <p className={styles.help}>Text files with the times, for YouTube or a video player. Styling is not included in these formats.</p>
          <div className={css.actions}>
            <TextDownload disabled={!captions.length || errors.length > 0} name={`${baseName(file.name)}.srt`} type="application/x-subrip" content={() => toSrt(captions)} label="Download SRT" />
            <TextDownload disabled={!captions.length || errors.length > 0} name={`${baseName(file.name)}.vtt`} type="text/vtt" content={() => toVtt(captions)} label="Download VTT" />
          </div>
          <h2 className={styles.label}>Video with captions</h2>
          <p className={styles.help}>{size ? `${size.width} × ${size.height} H.264 MP4${info.audio ? " with AAC audio" : ""}, ${fontById(style.font).label}, ${composition.aspect === "source" ? "original shape" : composition.aspect}. Change the frame in Layout.` : ""}</p>
          <PrimaryButton label="Export MP4 with captions" busyLabel="Exporting…" busy={!!busy} disabled={!captions.length || errors.length > 0 || !!fontError} onClick={() => void exportVideo()} />
          <p className={styles.help}>Every frame is re-encoded with the captions drawn in. Expect it to take about as long as the video. Free, no watermark.</p>
          {messages}
          {freshResult && resultUrl && <div className={css.result}>
            <video src={resultUrl} controls playsInline preload="metadata" aria-label="Exported video" className={css.resultVideo} />
            <a className={styles.primary} href={resultUrl} download={`${baseName(file.name)}-captions.mp4`}>Download MP4</a>
            <DetailsTable original={{ title: "Original", label: "Original video", rows: [["Size", `${source.width} × ${source.height}`], ["Length", `${info.duration.toFixed(2)} s`], ["File", shortSize(file.size)]] }}
              result={{ title: "Exported", label: "Exported video", rows: [["Size", `${freshResult.width} × ${freshResult.height}`], ["Length", `${freshResult.info.duration.toFixed(2)} s`], ["Video", "H.264"], ["Audio", freshResult.info.audio ? freshResult.info.audio.codec.toUpperCase() : "None"], ["File", shortSize(freshResult.blob.size)]] }} />
          </div>}
          {result && !freshResult && <InlineMessage>Captions, style or frame changed since the last export. Export again to include the changes.</InlineMessage>}
        </div>}
      </div>
    </div>
  </section>;
}

/** A download whose file is built when clicked, so it always reflects the current captions. */
function TextDownload({ disabled, name, type, content, label }: { disabled: boolean; name: string; type: string; content: () => string; label: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([content()], { type: `${type};charset=utf-8` })), anchor = document.createElement("a");
    anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <button type="button" className={styles.secondary} disabled={disabled} onClick={download}>{label}</button>;
}

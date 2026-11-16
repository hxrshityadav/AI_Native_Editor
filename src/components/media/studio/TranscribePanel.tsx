"use client";
import { InlineMessage, PrimaryButton, SegmentedChoice, styles } from "../../tools/surface/ToolSurface";
import css from "../SubtitleStudio.module.css";

/* Language, script and model choice for local transcription. Nothing downloads until the user consents per model. */

export type SpeechMode = "auto" | "en" | "hi" | "hinglish";
export type CaptionModel = "tiny" | "base" | "hinglish-swift";
export const MODEL_INFO: Record<CaptionModel, { label: string; size: string; note: string }> = {
  "hinglish-swift": { label: "Hindi2Hinglish Swift", size: "about 100 MiB", note: "Tuned for Hindi speech; writes Roman Hinglish (aaj hum…). Best measured: median 40% word errors on 20 FLEURS Hindi clips. Phrase timing only, no word highlighting." },
  tiny: { label: "Whisper Tiny", size: "about 95 MiB", note: "Fast, with word timing. Good on clear English. On real Hindi it mostly writes romanised or English text (median 90% word errors measured)." },
  base: { label: "Whisper Base", size: "about 140 MiB", note: "About twice as slow, with word timing. Good on clear English. On real Hindi it often writes Roman or Urdu script (median 97% word errors measured)." },
};
export const MODE_LABEL: Record<SpeechMode, string> = { auto: "Auto detect", en: "English", hi: "Hindi", hinglish: "Roman Hinglish" };
export const LANGUAGE_NAME: Record<string, string> = { en: "English", hi: "Hindi", ur: "Urdu", mr: "Marathi", bn: "Bengali", pa: "Punjabi", ne: "Nepali", gu: "Gujarati", ta: "Tamil", te: "Telugu" };

export type Recognition = { mode: SpeechMode; model: CaptionModel; romanised?: number; language: string; wordTiming?: boolean; timingMode?:"word"|"phrase"|"manual"; detected?: { code: string; probability: number; top: [string, number][] }; seconds?: number; words: number; loopsRemoved?: number; translatedWarning?: boolean };

export function TranscribePanel({ mode, setMode, model, setModel, consent, setConsent, busy, hasAudio, onTranscribe, onManual, recognition, hasCaptions }: {
  mode: SpeechMode; setMode: (mode: SpeechMode) => void; model: CaptionModel; setModel: (model: CaptionModel) => void;
  consent: Record<CaptionModel, boolean>; setConsent: (model: CaptionModel, value: boolean) => void; busy: boolean; hasAudio: boolean; onTranscribe: () => void; onManual: () => void; recognition?: Recognition; hasCaptions: boolean;
}) {
  const summary = mode === "auto" ? "Whisper identifies the spoken language first (English or Hindi), then transcribes in that language. It never translates." : mode === "en" ? "Transcribes English speech as English text." : mode === "hi" ? "Transcribes Hindi speech in Devanagari. It never translates to English." : "Hindi and English words are both written in Roman letters, as spoken, for example: Aaj hum API call karenge. Nothing is translated, and Roman Hinglish captions never contain Devanagari.";
  return <div className={css.start}>
    <SegmentedChoice legend="Spoken language" name="speech-mode" options={[{ value: "auto", label: "Auto" }, { value: "en", label: "English" }, { value: "hi", label: "Hindi" }, { value: "hinglish", label: "Roman Hinglish" }]} value={mode} disabled={busy} onChange={setMode} hint={summary} />
    {mode === "hinglish" && <InlineMessage tone="warn">Measured on 20 real Hindi recordings (FLEURS), Hindi2Hinglish Swift gave the most usable Roman text: a median of about 4 in 10 words needed a fix. Check every caption, especially names and technical terms.</InlineMessage>}
    {mode === "hi" && <InlineMessage tone="warn">On 20 real Hindi recordings, no model that runs in this browser produced reliable Devanagari: Tiny and Base mostly wrote Roman or Urdu script. Expect to correct or type Devanagari captions. For Hindi speech in Roman letters, choose Roman Hinglish.</InlineMessage>}
    <fieldset className={css.modelGrid}><legend className={styles.label}>Speech model</legend>
      {(Object.keys(MODEL_INFO) as CaptionModel[]).filter(id => id !== "hinglish-swift" || mode === "hinglish").map(id => <label key={id} className={css.presetCard} data-checked={model === id || undefined}>
        <input type="radio" name="caption-model" className="sr-only" checked={model === id} disabled={busy} onChange={() => setModel(id)} />
        <span className={css.presetName}>{MODEL_INFO[id].label}</span><span className={css.presetNote}>{MODEL_INFO[id].size} · {MODEL_INFO[id].note}</span></label>)}
    </fieldset>
    <label className={css.consent}><input type="checkbox" aria-label="Allow speech model download" checked={consent[model]} disabled={busy} onChange={event => setConsent(model, event.target.checked)} />
      <span>Download {MODEL_INFO[model].label} ({MODEL_INFO[model].size}) once from this website and keep it in this browser&apos;s cache. The audio is transcribed on this device and never uploaded. Word timings come from the same model.</span></label>
    <p className={styles.help} aria-live="polite">Ready to transcribe as <strong>{MODE_LABEL[mode]}</strong> with {MODEL_INFO[model].label}.</p>
    <PrimaryButton label={hasCaptions ? "Transcribe again" : "Transcribe locally"} busyLabel="Transcribing…" busy={busy} disabled={!consent[model] || !hasAudio} onClick={onTranscribe} />
    {hasCaptions && <p className={styles.help}>Transcribing again replaces the captions. You can undo it.</p>}
    {!hasAudio && <InlineMessage>This video has no audio track, so there is nothing to transcribe. Write captions by hand instead.</InlineMessage>}
    {recognition && <InlineMessage tone={recognition.translatedWarning ? "warn" : "ok"} role="status" title={`Transcribed as ${LANGUAGE_NAME[recognition.language] ?? recognition.language}`}>
      {recognition.detected ? `Auto detect chose ${LANGUAGE_NAME[recognition.detected.code] ?? recognition.detected.code} (${Math.round(recognition.detected.probability * 100)}% likely; next: ${recognition.detected.top.slice(1).map(([code, p]) => `${LANGUAGE_NAME[code] ?? code} ${Math.round(p * 100)}%`).join(", ")}). ` : `Language set to ${MODE_LABEL[recognition.mode]}. `}
      {recognition.timingMode === "manual" ? "No reliable timestamps; manual timing required" : recognition.wordTiming === false ? "Phrase timing; word timing unavailable or rejected" : `${recognition.words} words with timings`}{recognition.seconds ? `, recognised in ${recognition.seconds.toFixed(1)} s` : ""} by {MODEL_INFO[recognition.model].label}.
      {recognition.romanised ? ` ${recognition.romanised} words came out in Devanagari and were written in Roman letters.` : ""}
      {recognition.detected && recognition.detected.probability < 0.6 ? " Language detection was uncertain. If this is wrong, choose the language above and transcribe again." : ""}
      {recognition.loopsRemoved ? ` ${recognition.loopsRemoved} repeated words from a recognition loop were removed; check that part.` : ""}
      {recognition.translatedWarning ? " The result is not in Devanagari: the model wrote Hindi in another script or translated it. Try Roman Hinglish, or correct the captions by hand." : ""}
      {recognition.mode === "auto" ? " Wrong language? Choose it above and transcribe again." : ""}
    </InlineMessage>}
    <div className={css.divider} />
    <button type="button" className={styles.secondary} disabled={busy} onClick={onManual}>Write captions by hand</button>
  </div>;
}

"use client";
import { normalizeCuts, sourceToEdited } from "@/lib/editor/timeline";
import type { ReelSession } from "./useReelSession";

export function SilencePanel({ session: s }: { session: ReelSession }) {
  const { threshold, minimum, keep } = s.silenceOptions;
  const setThreshold = (threshold: number) => s.setSilenceOptions({ ...s.silenceOptions, threshold });
  const setMinimum = (minimum: number) => s.setSilenceOptions({ ...s.silenceOptions, minimum });
  const setKeep = (keep: number) => s.setSilenceOptions({ ...s.silenceOptions, keep });
  const progress = s.analysisProgress;
  const problem = s.analysisProblem;
  const suggestions = s.silenceReview?.file === s.file ? s.silenceReview : null;
  const setReview = s.setSilenceReview;
  const cuts = s.plan?.cuts ?? [];
  const duration = s.probe?.durationSec ?? 0;
  const analyze = () => s.analyzeSilence();
  const cancel = s.cancelAnalysis;
  const selected = suggestions?.cuts.filter((cut) => cut.selected) ?? [];
  const valid = selected.every((cut) => Number.isFinite(cut.start) && Number.isFinite(cut.end) && cut.end > cut.start && cut.start >= 0 && cut.end <= duration);
  const editedDuration = valid ? sourceToEdited(duration, normalizeCuts(selected, duration)) : 0;
  return <details open className="border-t border-line pt-3" data-testid="silence-panel"><summary className="cursor-pointer font-medium">Silence removal</summary>
    <div className="mt-3 flex flex-col gap-3 text-sm">
      <p>Analysis stays on this device. Quiet speech and music may look like silence: listen to each proposed cut before applying it. The original is preserved.</p>
      <label>Silence threshold <output>{threshold} dBFS</output><input type="range" aria-label="Silence threshold" min={-65} max={-15} step={1} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="block w-full" /></label>
      <label>Minimum pause <output>{minimum.toFixed(1)} s</output><input type="range" aria-label="Minimum silence" min={0.2} max={3} step={0.1} value={minimum} onChange={(e) => setMinimum(Number(e.target.value))} className="block w-full" /></label>
      <label>Keep pause <select aria-label="Keep pause" value={keep} onChange={(e) => setKeep(Number(e.target.value))} className="ml-2 min-h-10 rounded border bg-panel p-2">
        <option value={0}>Remove (retain edge padding)</option><option value={0.2}>Shorten to 0.2 s plus edge padding</option><option value={0.5}>Shorten to 0.5 s plus edge padding</option>
      </select></label>
      <button type="button" className="min-h-10 rounded border px-3 disabled:opacity-40" disabled={!s.ready || progress !== null} onClick={() => void analyze()}>Analyze pauses locally</button>
      {progress !== null && <div><progress className="w-full" max={1} value={progress} aria-label="Silence analysis progress" /><button type="button" className="min-h-10 underline" onClick={cancel}>Cancel analysis</button></div>}
      {problem && <p role="alert" className="text-red-700">{problem}</p>}
      {suggestions && <>
        <button type="button" className="min-h-10 underline" onClick={() => s.setPreviewSuggestions(!s.previewSuggestions)}>{s.previewSuggestions ? "Return to applied edits" : "Preview proposed cuts without applying"}</button>
        <p role="status">{suggestions.cuts.length} pause candidates. Review source times below; unchecked intervals are preserved.</p>
        <svg role="img" aria-label="Source audio level with proposed cuts" viewBox="0 0 600 70" className="w-full rounded bg-zinc-100">
          {suggestions.windows.filter((_, i) => i % Math.max(1, Math.floor(suggestions.windows.length / 600)) === 0).map((window, i) =>
            <line key={i} x1={window.start / duration * 600} x2={window.start / duration * 600} y1={35 - Math.max(1, (window.db + 80) / 80 * 30)} y2={35 + Math.max(1, (window.db + 80) / 80 * 30)} stroke="#64748b" />)}
          {selected.map((cut, i) => <rect key={i} x={cut.start / duration * 600} y={0} width={(cut.end - cut.start) / duration * 600} height={70} fill="#ef4444" opacity={0.3} />)}
        </svg>
        <div className="max-h-64 overflow-y-auto">{suggestions.cuts.map((cut, index) => <div key={index} className="flex flex-wrap items-center gap-2 border-b py-2">
          <input aria-label={`Remove pause ${index + 1}`} type="checkbox" checked={cut.selected} onChange={(e) => setReview({ ...suggestions, cuts: suggestions.cuts.map((item, i) => i === index ? { ...item, selected: e.target.checked } : item) })} />
          {(["start", "end"] as const).map((key) => <label key={key}>{key}<input type="number" aria-label={`Pause ${index + 1} ${key}`} className="ml-1 w-20 rounded border bg-panel p-1" step={0.01} min={0} max={duration} value={cut[key]}
            onChange={(e) => setReview({ ...suggestions, cuts: suggestions.cuts.map((item, i) => i === index ? { ...item, [key]: Number(e.target.value) } : item) })} /></label>)}
          <button type="button" className="min-h-10 underline" onClick={() => { if (s.videoRef.current) { s.videoRef.current.currentTime = Math.max(0, cut.start - 0.2); void s.videoRef.current.play().catch(() => s.setPreviewFailed(true)); } }}>Listen here</button>
        </div>)}</div>
        <button type="button" data-testid="apply-cuts" className="min-h-10 rounded border px-3 disabled:opacity-40" disabled={!valid || editedDuration < 0.1}
          onClick={() => { s.editing.update({ cuts: normalizeCuts([...s.editing.settings.cuts, ...selected], duration) }); s.setPreviewSuggestions(false); }}>Apply reviewed cuts · {editedDuration.toFixed(2)} s output</button>
        {!valid && <p role="alert">Each cut needs valid source start/end times inside the video.</p>}
      </>}
      {cuts.length > 0 && <p>{cuts.length} applied cuts · {sourceToEdited(duration, cuts).toFixed(2)} s edited duration. <button type="button" className="min-h-10 underline" onClick={() => s.editing.update({ cuts: [] })}>Restore all removed ranges</button></p>}
      <p className="text-xs text-muted">Preview skips cuts. Export re-encodes audio and maps samples and caption/SRT times. Video boundaries use available source frames, without interpolation; abrupt cuts can click. Undo/redo settings reverses cuts.</p>
    </div>
  </details>;
}

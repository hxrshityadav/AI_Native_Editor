"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { editedToSource, inInterval, retainedPieces, sourceToEdited } from "@/lib/editor/timeline";
import { timelineGaps, videoSegments } from "@/lib/editor/operations";
import type { ReelSession } from "./useReelSession";

export function useVideoClock(s: ReelSession) {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const video = s.videoRef.current;
    if (!video) return;
    let raf = 0;
    const tick = () => { setTime(video.currentTime); if (!video.paused) raf = requestAnimationFrame(tick); };
    const play = () => { cancelAnimationFrame(raf); tick(); };
    const update = () => setTime(video.currentTime);
    video.addEventListener("play", play); video.addEventListener("timeupdate", update); video.addEventListener("seeked", update);
    play();
    return () => { cancelAnimationFrame(raf); video.removeEventListener("play", play); video.removeEventListener("timeupdate", update); video.removeEventListener("seeked", update); };
  }, [s.videoRef, s.videoUrl]);
  return time;
}
const button = "min-h-10 rounded border border-line px-3 text-xs disabled:opacity-40";
const smallScreen = () => window.matchMedia("(max-width: 1023px)").matches;
const subscribeScreen = (changed: () => void) => { const query = window.matchMedia("(max-width: 1023px)"); query.addEventListener("change", changed); return () => query.removeEventListener("change", changed); };
export function Timeline({ session: s }: { session: ReelSession }) {
  const [expanded, setOpen] = useState<boolean | null>(null);
  const small = useSyncExternalStore(subscribeScreen, smallScreen, () => false);
  const open = expanded ?? !small;
  const [height, setHeight] = useState(220);
  const [zoom, setZoom] = useState(1);
  const time = useVideoClock(s);
  const duration = s.probe?.durationSec ?? 0;
  const settings = s.editing.settings;
  const segments = videoSegments(settings, duration);
  const gaps = timelineGaps(settings, duration);
  const outputDuration = sourceToEdited(duration, settings.cuts);
  const outputTime = sourceToEdited(time, settings.cuts);
  const toSource = (start: number, end: number) => [editedToSource(start, settings.cuts), editedToSource(end, settings.cuts, "end")];
  const selected = s.selection;
  const seek = s.seek;
  const split = () => selected?.kind === "caption" ? s.applyEdit([{ type: "caption_split", id: selected.id, time }]) : s.applyEdit([{ type: "video_split", time }]);
  const remove = () => {
    if (selected?.kind === "caption") s.applyEdit([{ type: "caption_delete", id: selected.id }]);
    if (selected?.kind === "overlay") { const item = settings.overlays.find((x) => x.id === selected.id); if (item && !item.locked) s.editing.update({ overlays: settings.overlays.filter((x) => x.id !== selected.id) }); }
    if (selected?.kind === "video") { const clip = segments.find((x) => x.id === selected.id); if (clip) s.applyEdit([{ type: "video_delete", id: clip.id, ripple: false }]); }
  };
  return <section aria-label="Editing timeline" className="shrink-0 border-t border-line bg-panel">
    <div className="flex flex-wrap items-center gap-2 px-3 py-1">
      <button className={button} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide timeline" : "Show timeline"}</button>
      {open && <><button className={button} disabled={!s.ready} onClick={() => { const video = s.videoRef.current; if (video?.paused) void video.play().catch(() => s.setPreviewFailed(true)); else video?.pause(); }}>Play / pause</button>
        <button className={button} disabled={!s.ready} onClick={split}>Split at playhead</button><button className={button} disabled={!selected || (selected.kind === "audio" || selected.kind === "gap")} onClick={remove}>Delete selected</button><button className={button} disabled={selected?.kind !== "video"} onClick={() => { if (selected?.kind === "video") s.applyEdit([{ type: "video_delete", id: selected.id, ripple: true }]); }}>Ripple delete clip</button><button className={button} disabled={selected?.kind !== "gap"} onClick={() => { if (selected?.kind === "gap") s.applyEdit([{ type: "remove_gap", id: selected.id }]); }}>Remove gap</button>
        <output className="text-xs tabular-nums">Source {time.toFixed(2)} / {duration.toFixed(2)} s · Output {sourceToEdited(time, settings.cuts).toFixed(2)} / {sourceToEdited(duration, settings.cuts).toFixed(2)} s</output>
        <label className="ml-auto flex items-center gap-1 text-xs">Zoom<input aria-label="Timeline zoom" type="range" min={1} max={10} step={0.5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-20" /></label>
        <label className="hidden text-xs lg:block">Height<input aria-label="Timeline height" type="range" min={160} max={400} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="ml-1 w-16" /></label></>}
    </div>
    {open && <div className="overflow-auto px-3 pb-2" style={{ height }}>
      <input aria-label="Output playhead" type="range" min={0} max={outputDuration} step={0.01} value={Math.min(outputTime, outputDuration)} onChange={(e) => seek(editedToSource(Number(e.target.value), settings.cuts))} className="sticky left-0 w-full" />
      <div className="relative min-w-full" style={{ width: `${zoom * 100}%` }}>
        <div className="relative h-6 border-b border-line text-[10px] text-muted">{Array.from({ length: 11 }, (_, i) => <span key={i} className="absolute border-l border-line pl-1" style={{ left: `${i * 10}%` }}>{(outputDuration * i / 10).toFixed(1)}s</span>)}</div>
        <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-red-500" data-testid="timeline-playhead" style={{ left: `${outputDuration ? outputTime / outputDuration * 100 : 0}%` }} />
        <Track name="Video">{segments.map((clip) => <Block key={clip.id} label="Video clip" start={clip.outputStart} end={clip.outputEnd} duration={outputDuration} selected={selected?.kind === "video" && selected.id === clip.id} color="bg-slate-200 text-slate-900" onSelect={() => { s.setSelection({ kind: "video", id: clip.id }); seek(clip.start); }} onChange={(outputStart, outputEnd) => { const [start, end] = toSource(outputStart, outputEnd); if (start > clip.start) s.applyEdit([{ type: "cut", start: clip.start, end: start }]); else if (end < clip.end) s.applyEdit([{ type: "cut", start: end, end: clip.end }]); }} edgesOnly />)}{gaps.map((gap) => <button key={gap.id} aria-label={`Select gap ${gap.start.toFixed(2)}–${gap.end.toFixed(2)}`} aria-pressed={selected?.kind === "gap" && selected.id === gap.id} title={`Source ${gap.start.toFixed(2)}–${gap.end.toFixed(2)} s; output ${gap.outputStart.toFixed(2)}–${gap.outputEnd.toFixed(2)} s`} className={`absolute h-8 truncate rounded border-2 border-dashed border-amber-600 bg-amber-50 text-xs text-amber-950 ${selected?.kind === "gap" && selected.id === gap.id ? "outline-2 outline-blue-600" : ""}`} style={{ left: `${gap.outputStart / outputDuration * 100}%`, width: `${(gap.outputEnd - gap.outputStart) / outputDuration * 100}%` }} onClick={() => { s.setSelection({ kind: "gap", id: gap.id }); seek(gap.start); }}>Gap · {(gap.end - gap.start).toFixed(2)} s</button>)}</Track>
        <Track name="Captions">{s.captionSegments.filter((caption) => retainedPieces(caption.start, caption.end, settings.cuts).length).map((caption) => <Block key={caption.id} label={caption.words.map((w) => w.text).join(" ")} start={sourceToEdited(caption.start, settings.cuts)} end={sourceToEdited(caption.end, settings.cuts)} duration={outputDuration} selected={selected?.kind === "caption" && selected.id === caption.id} color="bg-amber-200 text-amber-950" locked={caption.locked} hidden={caption.hidden} onSelect={() => { s.setSelection({ kind: "caption", id: caption.id }); seek(caption.start); }} onChange={(outputStart, outputEnd) => { const [start, end] = toSource(outputStart, outputEnd); s.applyEdit([{ type: "caption_time", id: caption.id, start, end }]); }} />)}</Track>
        <Track name="Text">{settings.overlays.filter((overlay) => retainedPieces(overlay.start, overlay.end, settings.cuts).length).map((overlay) => <Block key={overlay.id} label={overlay.text} start={sourceToEdited(overlay.start, settings.cuts)} end={sourceToEdited(overlay.end, settings.cuts)} duration={outputDuration} selected={selected?.kind === "overlay" && selected.id === overlay.id} color="bg-violet-200 text-violet-950" locked={overlay.locked} hidden={overlay.hidden} onSelect={() => { s.setSelection({ kind: "overlay", id: overlay.id }); seek(overlay.start); }} onChange={(outputStart, outputEnd) => { const [start, end] = toSource(outputStart, outputEnd); s.editing.update({ overlays: settings.overlays.map((item) => item.id === overlay.id ? { ...item, start, end } : item) }); }} />)}</Track>
        <Track name="Audio"><button className="absolute inset-0 rounded border border-line bg-slate-100 text-xs text-slate-800" aria-label="Select audio track" onClick={() => s.setSelection({ kind: "audio" })}>
          {s.silenceReview?.windows.length ? <svg viewBox="0 0 1000 30" preserveAspectRatio="none" className="h-full w-full" aria-label="Measured source waveform">{s.silenceReview.windows.filter((_, i) => i % Math.max(1, Math.ceil(s.silenceReview!.windows.length / 1000)) === 0).filter((w) => !inInterval(w.start, settings.cuts) && !inInterval(w.start, settings.gaps)).map((w, i) => <line key={i} x1={sourceToEdited(w.start, settings.cuts) / outputDuration * 1000} x2={sourceToEdited(w.start, settings.cuts) / outputDuration * 1000} y1={15 - Math.max(1, (w.db + 80) / 80 * 14)} y2={15 + Math.max(1, (w.db + 80) / 80 * 14)} stroke="currentColor" />)}</svg> : `${settings.audio.muted ? "Muted · " : ""}Source audio · select to analyze waveform`}
        </button></Track>
        {s.previewSuggestions && s.silenceReview?.cuts.filter((x) => x.selected).map((cut, i) => <div key={i} className="pointer-events-none absolute inset-y-6 border-x border-red-600 bg-red-500/20" style={{ left: `${sourceToEdited(cut.start, settings.cuts) / outputDuration * 100}%`, width: `${(sourceToEdited(cut.end, settings.cuts) - sourceToEdited(cut.start, settings.cuts)) / outputDuration * 100}%` }} />)}
      </div>
      <p className="mt-2 text-xs text-muted">Output-time timeline. Dashed gaps play black and silent until removed. Delete clip leaves a gap; Ripple delete closes it immediately. Drag edges to trim. Properties show original source times.</p>
    </div>}
  </section>;
}
function Track({ name, children }: { name: string; children: React.ReactNode }) { return <div className="relative mt-1 h-8" aria-label={`${name} track`}><span className="pointer-events-none absolute inset-y-0 left-1 z-10 text-[9px] opacity-60">{name}</span>{children}</div>; }
function Block({ label, start, end, duration, selected, color, locked, hidden, onSelect, onChange, edgesOnly = false }: { label: string; start: number; end: number; duration: number; selected: boolean; color: string; locked?: boolean; hidden?: boolean; onSelect: () => void; onChange: (start: number, end: number) => void; edgesOnly?: boolean }) {
  return <div className={`absolute h-8 touch-none rounded border ${color} ${selected ? "outline-2 outline-blue-600" : "border-black/15"} ${hidden ? "opacity-40" : ""}`} style={{ left: `${start / duration * 100}%`, width: `${(end - start) / duration * 100}%`, minWidth: 8 }}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      onSelect(); if (locked) return;
      const element = event.currentTarget;
      const box = element.getBoundingClientRect();
      const edge = event.clientX - box.left < 9 ? "start" : box.right - event.clientX < 9 ? "end" : "move";
      if (edgesOnly && edge === "move") return;
      const origin = event.clientX; const width = element.parentElement!.getBoundingClientRect().width;
      element.setPointerCapture(event.pointerId);
      const update = (e: PointerEvent) => {
        const delta = (e.clientX - origin) / width * duration;
        let a = start, b = end;
        if (edge === "start") a = Math.min(end - 0.05, Math.max(edgesOnly ? start : 0, start + delta));
        else if (edge === "end") b = Math.max(start + 0.05, Math.min(edgesOnly ? end : duration, end + delta));
        else { a = Math.max(0, Math.min(duration - (end - start), start + delta)); b = a + end - start; }
        return [a, b];
      };
      const move = (e: PointerEvent) => { const [a, b] = update(e); element.style.left = `${a / duration * 100}%`; element.style.width = `${(b - a) / duration * 100}%`; };
      const finish = (e: PointerEvent) => { element.removeEventListener("pointermove", move); element.removeEventListener("pointerup", finish); element.removeEventListener("pointercancel", cancel); element.style.left = `${start / duration * 100}%`; element.style.width = `${(end - start) / duration * 100}%`; if (Math.abs(e.clientX - origin) > 2) { const [a, b] = update(e); onChange(a, b); } };
      const cancel = () => { element.removeEventListener("pointermove", move); element.removeEventListener("pointerup", finish); element.removeEventListener("pointercancel", cancel); element.style.left = `${start / duration * 100}%`; element.style.width = `${(end - start) / duration * 100}%`; };
      element.addEventListener("pointermove", move); element.addEventListener("pointerup", finish); element.addEventListener("pointercancel", cancel);
    }}>
    <button className="h-full w-full truncate px-2 text-xs text-left" onClick={(e) => { if (e.detail === 0) onSelect(); }} aria-label={`Select ${label}`} aria-pressed={selected}>{locked ? "🔒 " : ""}{label}</button>
    {!locked && <><span className="pointer-events-none absolute inset-y-1 left-0 w-1 rounded bg-black/30" /><span className="pointer-events-none absolute inset-y-1 right-0 w-1 rounded bg-black/30" /></>}
  </div>;
}

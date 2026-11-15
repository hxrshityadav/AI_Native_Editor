"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { Maximize2, Play, Square, ZoomIn, ZoomOut } from "lucide-react";
import type { Peaks } from "@/lib/mediatools/engine";
import { runMediaTask } from "@/lib/mediatools/client";
import { maxZoom, nudge, nudgeStep, reducePeaks, viewFor, zoomAround, type View } from "@/lib/media/waveformView";
import styles from "./ZoomWaveform.module.css";

/*
 * Zoomable, scrollable waveform for the Audio Cutter. The file is decoded once at load into fine peaks (about 50 per
 * second); zooming reduces those in the page. Only when the visible window holds fewer fine peaks than bars on screen is
 * the worker asked for that window alone (start/end), debounced, so long files are never decoded again in full.
 */

const BARS = 600;
/** Media seeks live outside the component so the props stay read-only. */
const seek = (element: HTMLMediaElement | null, seconds: number) => { if (element) element.currentTime = seconds; };
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;

export function ZoomWaveform({ file, fine, start, end, onChange, media, disabled }: {
  file: File; fine: Peaks; start: number; end: number; onChange: (start: number, end: number) => void;
  media: RefObject<HTMLMediaElement | null>; disabled: boolean;
}) {
  const duration = fine.duration;
  const [zoom, setZoom] = useState(1), [view, setView] = useState<View>({ start: 0, end: duration });
  const [detail, setDetail] = useState<Peaks>(), [playhead, setPlayhead] = useState(0), [playingSelection, setPlayingSelection] = useState(false);
  const surface = useRef<HTMLDivElement>(null), drag = useRef<"start" | "end" | null>(null), request = useRef<AbortController | null>(null);
  const scale = Math.max(0.01, fine.peak);

  const reduced = useMemo(() => reducePeaks(fine.peaks, fine.start, fine.end, view, BARS), [fine, view]);
  const detailFits = !!detail && Math.abs(detail.start - view.start) < 1e-3 && Math.abs(detail.end - view.end) < 1e-3;
  // While a detailed window is loading, stretch the coarse peaks so the picture never jumps to empty.
  const bars = reduced ?? (detailFits ? detail!.peaks : Array.from({ length: BARS }, (_, b) => {
    const t = view.start + (b + 0.5) / BARS * (view.end - view.start), i = Math.min(fine.peaks.length - 1, Math.floor((t - fine.start) / (fine.end - fine.start) * fine.peaks.length));
    return fine.peaks[Math.max(0, i)] ?? 0;
  }));

  // Exact peaks for a short window come from the worker, which decodes only that window.
  useEffect(() => {
    if (reduced || detailFits) return;
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    const timer = setTimeout(() => {
      runMediaTask({ kind: "peaks", file, window: { start: view.start, end: view.end, buckets: BARS } }, controller.signal)
        .then(result => { if (!controller.signal.aborted) setDetail(result); })
        .catch(() => { /* keep the stretched coarse peaks; the next view change retries */ });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [file, view, reduced, detailFits]);
  useEffect(() => () => request.current?.abort(), []);

  // Playhead follows the media element; "Play selection" stops exactly at the end of the selection.
  useEffect(() => {
    const element = media.current; if (!element) return;
    let frame = 0;
    const tick = () => { setPlayhead(element.currentTime); if (playingSelection && element.currentTime >= end) { element.pause(); seek(element, end); setPlayingSelection(false); } if (!element.paused) frame = requestAnimationFrame(tick); };
    const start = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(tick); };
    const stop = () => { cancelAnimationFrame(frame); setPlayhead(element.currentTime); };
    // A seek during playback (Play selection seeks, then plays) must not stop the playhead loop.
    const seeked = () => { if (element.paused) stop(); else start(); };
    // timeupdate is a backstop for when animation frames are throttled (background tab).
    const update = () => { if (playingSelection && element.currentTime >= end) { element.pause(); seek(element, end); setPlayingSelection(false); } };
    element.addEventListener("play", start); element.addEventListener("playing", start); element.addEventListener("pause", stop); element.addEventListener("seeked", seeked); element.addEventListener("timeupdate", update);
    if (!element.paused) start();
    return () => { cancelAnimationFrame(frame); element.removeEventListener("play", start); element.removeEventListener("playing", start); element.removeEventListener("pause", stop); element.removeEventListener("seeked", seeked); element.removeEventListener("timeupdate", update); };
  }, [media, end, playingSelection]);

  const loading = !reduced && !detailFits;
  const span = view.end - view.start;
  const at = (t: number) => (t - view.start) / span * 100;
  const timeAt = useCallback((clientX: number) => { const box = surface.current!.getBoundingClientRect(); return view.start + Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * span; }, [view, span]);

  const applyZoom = (next: number, anchor = (view.start + view.end) / 2) => { const result = zoomAround(duration, view, next, anchor); setZoom(result.zoom); setView(result.view); };
  const fitSelection = () => { const pad = (end - start) * 0.1, next = duration / Math.max(0.5, end - start + 2 * pad); setZoom(Math.min(next, maxZoom(duration))); setView(viewFor(duration, next, start - pad)); };
  const scrollTo = (value: number) => setView(viewFor(duration, zoom, value));

  function onKey(edge: "start" | "end", event: KeyboardEvent) {
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      onChange(...(edge === "start" ? nudge(start, end, "start", event.key === "Home" ? -duration : duration, duration) : nudge(start, end, "end", event.key === "Home" ? -duration : duration, duration)));
      return;
    }
    const delta = nudgeStep(event.key, event.shiftKey, event.altKey); if (!delta) return;
    event.preventDefault(); onChange(...nudge(start, end, edge, delta, duration));
  }
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return;
    const handle = (event.target as HTMLElement).dataset.edge as "start" | "end" | undefined;
    if (handle) { drag.current = handle; surface.current!.setPointerCapture(event.pointerId); return; }
    const t = timeAt(event.clientX); seek(media.current, t); setPlayhead(t);
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const t = timeAt(event.clientX);
    onChange(...nudge(start, end, drag.current, t - (drag.current === "start" ? start : end), duration));
  }
  function endDrag() { drag.current = null; }
  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey) { event.preventDefault(); applyZoom(zoom * (event.deltaY < 0 ? 1.25 : 0.8), timeAt(event.clientX)); return; }
    if (zoom > 1 && (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY))) { event.preventDefault(); scrollTo(view.start + (event.deltaX || event.deltaY) / 600 * span); }
  }
  function playSelection() {
    const element = media.current; if (!element) return;
    if (playingSelection) { element.pause(); setPlayingSelection(false); return; }
    seek(element, start); setPlayingSelection(true); void element.play().catch(() => setPlayingSelection(false));
  }

  const handle = (edge: "start" | "end", value: number) => <div role="slider" tabIndex={disabled ? -1 : 0} data-edge={edge} aria-label={edge === "start" ? "Selection start" : "Selection end"}
    aria-valuemin={0} aria-valuemax={Math.round(duration * 100) / 100} aria-valuenow={Math.round(value * 100) / 100} aria-valuetext={time(value)} aria-disabled={disabled || undefined}
    className={styles.handle} style={{ left: `${at(value)}%` }} hidden={value < view.start || value > view.end} onKeyDown={event => !disabled && onKey(edge, event)} />;

  return <div className={styles.root}>
    <div className={styles.toolbar}>
      <div className={styles.buttons} role="group" aria-label="Waveform zoom">
        <button type="button" className={styles.icon} aria-label="Zoom in" title="Zoom in (Ctrl + scroll)" disabled={zoom >= maxZoom(duration)} onClick={() => applyZoom(zoom * 2)}><ZoomIn aria-hidden size={16} /></button>
        <button type="button" className={styles.icon} aria-label="Zoom out" title="Zoom out" disabled={zoom <= 1} onClick={() => applyZoom(zoom / 2)}><ZoomOut aria-hidden size={16} /></button>
        <button type="button" className={styles.icon} aria-label="Show the whole file" title="Show the whole file" disabled={zoom <= 1} onClick={() => applyZoom(1)}><Maximize2 aria-hidden size={16} /></button>
        <button type="button" className={styles.text} onClick={fitSelection}>Zoom to selection</button>
      </div>
      <p className={styles.range} aria-live="polite"><span>{time(view.start)} – {time(view.end)}</span><span>{zoom < 10 ? zoom.toFixed(1) : Math.round(zoom)}×</span>{loading && <span>Loading detail</span>}</p>
    </div>
    <div ref={surface} className={styles.surface} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onWheel={onWheel}
      data-testid="zoom-waveform" data-view-start={view.start.toFixed(3)} data-view-end={view.end.toFixed(3)}>
      <svg aria-hidden viewBox={`0 0 ${BARS} 100`} preserveAspectRatio="none" className={styles.svg}>
        <rect x={Math.max(0, at(start)) * BARS / 100} y={0} width={Math.max(0, (Math.min(100, at(end)) - Math.max(0, at(start)))) * BARS / 100} height={100} className={styles.selection} />
        {bars.map((value, index) => { const t = view.start + (index + 0.5) / BARS * span, h = Math.max(1, value / scale * 92); return <rect key={index} x={index} y={50 - h / 2} width={0.8} height={h} className={t >= start && t <= end ? styles.barOn : styles.bar} />; })}
      </svg>
      {handle("start", start)}{handle("end", end)}
      {playhead >= view.start && playhead <= view.end && <span className={styles.playhead} style={{ left: `${at(playhead)}%` }} aria-hidden />}
    </div>
    {zoom > 1 && <label className={styles.scroll}><span className="sr-only">Waveform scroll position</span>
      <input type="range" min={0} max={Math.max(0, duration - span)} step="any" value={view.start} onChange={event => scrollTo(Number(event.target.value))} /></label>}
    <div className={styles.footer}>
      <button type="button" className={styles.text} disabled={disabled} onClick={playSelection}>{playingSelection ? <Square aria-hidden size={14} /> : <Play aria-hidden size={14} />}{playingSelection ? "Stop" : "Play selection"}</button>
      <p className={styles.hint}>Drag the edges, or focus one and use the arrow keys: 0.1 s, Shift 1 s, Alt 0.01 s.</p>
    </div>
  </div>;
}

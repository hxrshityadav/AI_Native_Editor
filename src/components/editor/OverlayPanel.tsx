"use client";
import type { ReelSession } from "./useReelSession";
import type { TextOverlay } from "@/lib/editor/project";

export function OverlayPanel({ session: s }: { session: ReelSession }) {
  const overlays = s.editing.settings.overlays;
  const update = (id: string, patch: Partial<TextOverlay>) => s.editing.update({ overlays: overlays.map((overlay) => overlay.id === id ? { ...overlay, ...patch } : overlay) });
  const duration = s.probe?.durationSec ?? 0;
  return <details open className="border-t border-line pt-3" data-testid="overlay-panel"><summary className="cursor-pointer font-medium">Text overlays</summary>
    <div className="mt-3 flex flex-col gap-3 text-sm">
      <p>Select a title for independent font, animation and lock controls. Times refer to the original source; applied cuts keep titles synchronized.</p>
      <button type="button" className="min-h-10 rounded border px-3 disabled:opacity-40" disabled={!s.ready || overlays.length >= 20} onClick={() => s.editing.update({ overlays: [...overlays,
        { id: crypto.randomUUID(), text: "Your title", start: 0, end: Math.min(3, duration), x: 0.5, y: 0.25, size: 0.07, color: "#FFFFFF", opacity: 1, locked: false, hidden: false }] })}>Add title</button>
      {overlays.map((overlay, index) => <fieldset disabled={overlay.locked} key={overlay.id} className="flex flex-col gap-2 rounded border border-line p-2"><legend>Title {index + 1}</legend><button type="button" className="min-h-10 underline" onClick={() => s.setSelection({ kind: "overlay", id: overlay.id })}>Select title {index + 1}</button>
        <input aria-label={`Title ${index + 1} text`} value={overlay.text} maxLength={200} onChange={(e) => update(overlay.id, { text: e.target.value })} className="min-h-10 rounded border bg-panel p-2" />
        <div className="flex gap-2">{(["start", "end"] as const).map((key) => <label key={key}>{key}<input className="ml-1 w-20 rounded border bg-panel p-1" type="number" aria-label={`Title ${index + 1} ${key}`} min={key === "end" ? overlay.start + 0.01 : 0} max={key === "start" ? overlay.end - 0.01 : duration} step={0.01} value={overlay[key]}
          onChange={(e) => { const value = Number(e.target.value); if (value >= 0 && value <= duration && (key === "start" ? value < overlay.end : value > overlay.start)) update(overlay.id, { [key]: value }); }} /></label>)}</div>
        {([ ["x", "Horizontal", 0.05, 0.95], ["y", "Vertical", 0.05, 0.95], ["size", "Size", 0.015, 0.2], ["opacity", "Opacity", 0, 1] ] as const).map(([key, label, min, max]) =>
          <label key={key}>{label}<input type="range" aria-label={`Title ${index + 1} ${label}`} min={min} max={max} step={0.005} value={overlay[key]} className="block w-full" onChange={(e) => update(overlay.id, { [key]: Number(e.target.value) })} /></label>)}
        <label className="flex items-center justify-between">Color<input aria-label={`Title ${index + 1} color`} type="color" value={overlay.color} onChange={(e) => update(overlay.id, { color: e.target.value })} /></label>
        <button type="button" className="min-h-10 underline" onClick={() => { if (window.confirm("Remove this title? Undo settings can restore it.")) s.editing.update({ overlays: overlays.filter((item) => item.id !== overlay.id) }); }}>Remove title</button>
      </fieldset>)}
      <div className="rounded bg-surface p-3"><p className="font-medium">Text behind a subject — staged, unavailable</p>
        <p className="mt-1 text-xs text-muted">These are ordinary foreground titles. Subject masking is not enabled: it needs a verified video segmentation model, temporal-stability checks, and identical worker export. No model is downloaded and no video is uploaded.</p></div>
    </div>
  </details>;
}

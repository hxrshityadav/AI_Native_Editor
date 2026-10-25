"use client";
import { useEffect } from "react";
import { timelineGaps, videoSegments } from "@/lib/editor/operations";
import type { Appearance, TextOverlay } from "@/lib/editor/project";
import { ANIMATIONS } from "@/lib/captions/animation";
import type { ReelSession } from "./useReelSession";

const button = "min-h-10 rounded border border-line px-3 text-sm disabled:opacity-40";
export function AddCaption({ session: s }: { session: ReelSession }) {
  return <button className={button} data-testid="add-caption" disabled={!s.ready} onClick={() => {
    const duration = s.probe?.durationSec ?? 0;
    let start = s.videoRef.current?.currentTime ?? 0;
    for (const caption of s.captionSegments) if (start >= caption.start && start < caption.end) start = caption.end;
    const next = s.captionSegments.find((caption) => caption.start > start);
    const end = Math.min(duration, start + 2, next?.start ?? duration);
    if (s.applyEdit([{ type: "caption_add", text: "Your caption", start, end }])) s.seek(start);
  }}>Add manual caption</button>;
}
export function SelectionProperties({ session: s }: { session: ReelSession }) {
  const selection = s.selection;
  const settings = s.editing.settings;
  const caption = selection?.kind === "caption" ? s.captionSegments.find((x) => x.id === selection.id) : null;
  const overlay = selection?.kind === "overlay" ? settings.overlays.find((x) => x.id === selection.id) : null;
  const clip = selection?.kind === "video" ? videoSegments(settings, s.probe?.durationSec ?? 0).find((x) => x.id === selection.id) : null;
  const gap = selection?.kind === "gap" ? timelineGaps(settings, s.probe?.durationSec ?? 0).find((x) => x.id === selection.id) : null;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.closest("input, textarea, select, button") || event.target.isContentEditable)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) s.editing.redo(); else s.editing.undo(); }
      if (event.code === "Space") { event.preventDefault(); const v = s.videoRef.current; if (v?.paused) void v.play().catch(() => s.setPreviewFailed(true)); else v?.pause(); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [s]);
  if (!selection) return null;
  const updateOverlay = (patch: Partial<TextOverlay>) => { if (overlay) s.editing.update({ overlays: settings.overlays.map((x) => x.id === overlay.id ? { ...x, ...patch } : x) }); };
  const updateCaption = (patch: Partial<NonNullable<typeof caption>>) => { if (caption) s.editing.update({ captions: s.captionSegments.map((x) => x.id === caption.id ? { ...x, ...patch } : x), wordEdits: null }); };
  const appearance = caption?.appearance ?? overlay?.appearance ?? {};
  const style = (patch: Appearance) => { if (caption) s.applyEdit([{ type: "caption_style", id: caption.id, appearance: patch }]); else if (overlay) updateOverlay({ appearance: { ...appearance, ...patch } }); };
  return <section aria-label="Selection properties" className="flex flex-col gap-3 rounded-lg border border-line p-3 text-sm">
    <div className="flex justify-between"><h3 className="font-semibold">{caption ? "Caption properties" : overlay ? "Text properties" : clip ? "Clip properties" : gap ? "Gap properties" : selection.kind === "audio" ? "Audio properties" : "Selection unavailable"}</h3><button className="underline" onClick={() => s.setSelection(null)}>Deselect</button></div>
    {(caption || overlay) && <>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!(caption ?? overlay)?.locked} onChange={(e) => caption ? updateCaption({ locked: e.target.checked }) : updateOverlay({ locked: e.target.checked })} />Lock item</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!(caption ?? overlay)?.hidden} onChange={(e) => caption ? updateCaption({ hidden: e.target.checked }) : updateOverlay({ hidden: e.target.checked })} />Hide item</label>
      <fieldset disabled={(caption ?? overlay)?.locked} className="flex flex-col gap-3 disabled:opacity-50">
        <label>Text<textarea key={(caption?.id ?? overlay?.id ?? "") + (caption?.words.map((x) => x.text).join(" ") ?? overlay?.text ?? "")} aria-label="Selected text" defaultValue={caption?.words.map((x) => x.text).join(" ") ?? overlay?.text} onBlur={(e) => { if (caption && e.target.value !== caption.words.map((x) => x.text).join(" ")) s.applyEdit([{ type: "caption_text", id: caption.id, text: e.target.value }]); else if (overlay) updateOverlay({ text: e.target.value.slice(0, 200) }); }} className="mt-1 min-h-20 w-full rounded border bg-panel p-2" /></label>
        <div className="grid grid-cols-2 gap-2">{(["start", "end"] as const).map((key) => <NumberField key={`${key}-${(caption?.[key] ?? overlay?.[key] ?? 0)}`} label={`Selected ${key}`} value={caption?.[key] ?? overlay?.[key] ?? 0} min={0} max={s.probe?.durationSec ?? 600} onCommit={(value) => { if (caption) s.applyEdit([{ type: "caption_time", id: caption.id, start: caption.start, end: caption.end, [key]: value }]); else if (overlay && (key === "start" ? value < overlay.end : value > overlay.start)) updateOverlay({ [key]: value }); }} />)}</div>
        <label>Font<select aria-label="Selected font" value={caption ? appearance.font ?? "" : overlay?.font ?? ""} className="block min-h-10 w-full rounded border bg-panel" onChange={(e) => caption ? (e.target.value ? style({ font: e.target.value }) : updateCaption({ appearance: { ...appearance, font: undefined } })) : updateOverlay({ font: e.target.value || undefined })}><option value="">Use global font</option>{s.fonts.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label>
        <label>Font weight<select aria-label="Selected weight" className="ml-2 min-h-10 rounded border bg-panel" value={caption ? appearance.weight ?? "" : overlay?.weight ?? ""} onChange={(e) => caption ? style({ weight: Number(e.target.value) }) : updateOverlay({ weight: Number(e.target.value) })}><option value="" disabled>Global weight</option>{[100,200,300,400,500,600,700,800,900].map((weight) => <option key={weight}>{weight}</option>)}</select></label>
        <NumberField label="Selected opacity" value={caption ? appearance.opacity ?? 1 : overlay!.opacity} min={0} max={1} onCommit={(value) => caption ? style({ opacity: value }) : updateOverlay({ opacity: value })} />
        {caption && <><label><input type="checkbox" checked={appearance.highlightEnabled ?? s.style.highlight.kind !== "none"} onChange={(e) => style({ highlightEnabled: e.target.checked })} /> Highlight spoken word</label><label>Highlight color<input aria-label="Selected highlight color" type="color" value={appearance.highlightColor ?? "#FFD60A"} onChange={(e) => style({ highlightColor: e.target.value })} /></label></>}
        <label>Text color<input aria-label="Selected text color" className="ml-2" type="color" value={caption ? appearance.textColor ?? s.style.textColor : overlay!.color} onChange={(e) => caption ? style({ textColor: e.target.value }) : updateOverlay({ color: e.target.value })} /></label>
        <NumberField label="Selected size" value={caption ? appearance.fontSizeRatio ?? s.style.fontSizeRatio : overlay!.size} min={0.015} max={0.15} onCommit={(value) => caption ? style({ fontSizeRatio: value }) : updateOverlay({ size: value })} />
        <div className="grid grid-cols-2 gap-2">{(["x", "y"] as const).map((axis) => { const key = axis === "x" ? "horizontalPosition" : "verticalPosition"; return <NumberField key={axis + (caption ? appearance[key] ?? s.style[key] ?? 0.5 : overlay![axis])} label={`Selected ${axis}`} value={caption ? appearance[key] ?? s.style[key] ?? 0.5 : overlay![axis]} min={0.05} max={0.95} onCommit={(value) => caption ? style({ [key]: value }) : updateOverlay({ [axis]: value })} />; })}</div>
        <label>Animation<select aria-label="Selected animation" className="block min-h-10 w-full rounded border bg-panel" value={(caption ?? overlay)?.animation?.effect ?? "inherit"} onChange={(e) => { const animation = e.target.value === "inherit" ? undefined : { ...settings.animation, effect: e.target.value as typeof settings.animation.effect }; if (caption) updateCaption({ animation }); else updateOverlay({ animation }); }}><option value="inherit">{caption ? "Global animation" : "No animation"}</option>{ANIMATIONS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <button className={button} onClick={() => caption ? updateCaption({ appearance: {}, animation: undefined }) : updateOverlay({ x: 0.5, y: 0.5, appearance: {}, font: undefined, animation: undefined })}>Reset overrides</button>
        {caption && <><p className="text-xs text-muted">{caption.estimated ? "Word times are evenly estimated from manually edited text." : "Original word timing retained."} Global styles preserve these overrides.</p><button className={button} onClick={() => s.applyEdit([{ type: "caption_split", id: caption.id, time: s.videoRef.current?.currentTime ?? 0 }])}>Split caption at playhead</button><button className={button} onClick={() => s.applyEdit([{ type: "caption_merge", id: caption.id }])}>Merge with next caption</button><button className={button} onClick={() => s.applyEdit([{ type: "caption_delete", id: caption.id }])}>Delete caption</button></>}
        {overlay && <button className={button} onClick={() => s.editing.update({ overlays: settings.overlays.filter((x) => x.id !== overlay.id) })}>Delete text</button>}
      </fieldset>
    </>}
    {gap && <><p>Gap {(gap.end - gap.start).toFixed(2)} s · Source {gap.start.toFixed(2)}–{gap.end.toFixed(2)} s · Output {gap.outputStart.toFixed(2)}–{gap.outputEnd.toFixed(2)} s</p><button className={button} onClick={() => s.applyEdit([{ type: "remove_gap", id: gap.id }])}>Remove selected gap</button></>}
    {clip && <><p>Source {clip.start.toFixed(2)}–{clip.end.toFixed(2)} s. Edits preserve the original file.</p><NumberField label="Trim clip start" value={clip.start} min={clip.start} max={clip.end - 0.05} onCommit={(value) => { if (value > clip.start) s.applyEdit([{ type: "cut", start: clip.start, end: value }]); }} /><NumberField label="Trim clip end" value={clip.end} min={clip.start + 0.05} max={clip.end} onCommit={(value) => { if (value < clip.end) s.applyEdit([{ type: "cut", start: value, end: clip.end }]); }} /><button className={button} onClick={() => s.applyEdit([{ type: "video_split", time: s.videoRef.current?.currentTime ?? 0 }])}>Split video at playhead</button><button className={button} onClick={() => s.applyEdit([{ type: "video_delete", id: clip.id, ripple: false }])}>Delete clip</button></>}
    {selection.kind === "audio" && <><label><input type="checkbox" checked={settings.audio.muted} onChange={(e) => s.applyEdit([{ type: "audio", ...settings.audio, muted: e.target.checked }])} /> Mute audio</label><label>Volume {Math.round(settings.audio.volume * 100)}%<input aria-label="Audio volume" type="range" min={0} max={1} step={0.01} value={settings.audio.volume} onChange={(e) => s.applyEdit([{ type: "audio", ...settings.audio, volume: Number(e.target.value) }])} className="block w-full" /></label><button className={button} disabled={s.analysisProgress !== null} onClick={() => void s.analyzeSilence()}>Analyze source waveform</button>{s.analysisProgress !== null && <progress aria-label="Waveform analysis" value={s.analysisProgress} max={1} />}</>}
  </section>;
}
function NumberField({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (value: number) => void }) { return <label>{label}<input key={value} aria-label={label} type="number" step={0.01} min={min} max={max} defaultValue={Number(value.toFixed(4))} className="block min-h-10 w-full rounded border bg-panel px-2" onBlur={(e) => { const n = Number(e.target.value); if (e.target.value && Number.isFinite(n) && n >= min && n <= max) onCommit(n); else e.target.value = String(value); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>; }

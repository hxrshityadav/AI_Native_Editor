"use client";
import { useEffect, useState } from "react";
import type { Appearance } from "@/lib/editor/project";
import { editingSchema } from "@/lib/editor/project";
import { localDb } from "@/lib/localDb";
import type { ReelSession } from "./useReelSession";
import { FontBrowser } from "./FontBrowser";
import { AnimationPanel } from "./AnimationPanel";

const PRESETS = [
  { name: "Clean Minimal", styleId: "clean", appearance: { strokeRatio: 0.08, highlightEnabled: false }, effect: "fade" },
  { name: "Bold Creator", styleId: "bold-yellow", appearance: { fontSizeRatio: 0.06 }, effect: "pop" },
  { name: "Podcast", styleId: "boxed", appearance: { maxWidthRatio: 0.9, lineSpacing: 1.5 }, effect: "none" },
  { name: "Karaoke Highlight", styleId: "pop", appearance: { highlightEnabled: true }, effect: "none" },
  { name: "Editorial", styleId: "subtitle", appearance: { font: "asset:notoserif", weight: 600, boxOpacity: 0.7, boxColor: "#141414" }, effect: "fade" },
  { name: "High Contrast", styleId: "boxed", appearance: { textColor: "#FFFFFF", boxColor: "#000000", boxOpacity: 1 }, effect: "none" },
  { name: "Gaming", styleId: "bold-yellow", appearance: { textColor: "#75FF88", strokeRatio: 0.2, transform: "uppercase" }, effect: "bounce" },
  { name: "Cinematic", styleId: "subtitle", appearance: { font: "asset:notoserif", weight: 400, letterSpacing: 0.08, highlightEnabled: false }, effect: "fade" },
  { name: "Educational", styleId: "clean", appearance: { textColor: "#FFFFFF", boxColor: "#10243A", boxOpacity: 0.9 }, effect: "reveal" },
] as const;
type SavedPreset = { name: string; styleId: string; appearance: Appearance; animation: ReelSession["editing"]["settings"]["animation"] };
const ranges: { key: keyof Appearance; label: string; min: number; max: number; step: number; fallback: number }[] = [
  { key: "fontSizeRatio", label: "Font size (frame height)", min: 0.015, max: 0.15, step: 0.001, fallback: 0.045 },
  { key: "opacity", label: "Text opacity", min: 0, max: 1, step: 0.01, fallback: 1 },
  { key: "letterSpacing", label: "Letter spacing (em)", min: -0.05, max: 0.3, step: 0.01, fallback: 0 },
  { key: "lineSpacing", label: "Line spacing", min: 0.9, max: 2, step: 0.05, fallback: 1.3 },
  { key: "maxWidthRatio", label: "Maximum text width", min: 0.2, max: 0.96, step: 0.01, fallback: 0.84 },
  { key: "maxLines", label: "Maximum lines", min: 1, max: 5, step: 1, fallback: 5 },
  { key: "strokeRatio", label: "Outline thickness", min: 0, max: 0.3, step: 0.01, fallback: 0.16 },
  { key: "shadowBlur", label: "Shadow blur", min: 0, max: 1, step: 0.01, fallback: 0.3 },
  { key: "shadowX", label: "Shadow horizontal offset", min: -1, max: 1, step: 0.01, fallback: 0 },
  { key: "shadowY", label: "Shadow vertical offset", min: -1, max: 1, step: 0.01, fallback: 0.06 },
  { key: "boxOpacity", label: "Background opacity (zero disables)", min: 0, max: 1, step: 0.01, fallback: 0 },
  { key: "boxPadding", label: "Background padding", min: 0, max: 1, step: 0.01, fallback: 0.35 },
  { key: "boxRadius", label: "Background corner radius", min: 0, max: 1, step: 0.01, fallback: 0.25 },
];

export function TypographyPanel({ session: s }: { session: ReelSession }) {
  const a = s.editing.settings.appearance;
  const set = (patch: Partial<Appearance>) => s.editing.update({ appearance: { ...a, ...patch } });
  const [saved, setSaved] = useState<SavedPreset[]>([]);
  const [problem, setProblem] = useState("");
  useEffect(() => { void localDb().then(async (db) => {
    const value = await db.get("settings", "subtitlePresets");
    if (Array.isArray(value)) setSaved(value.flatMap((preset) => {
      const parsed = editingSchema.safeParse(preset);
      return parsed.success && typeof preset.name === "string" ? [{ name: preset.name, styleId: parsed.data.styleId, appearance: parsed.data.appearance, animation: parsed.data.animation }] : [];
    }));
  }).catch(() => setProblem("Couldn't restore saved presets. Browser storage may be unavailable.")); }, []);
  return <div className="flex flex-col gap-4">
    <details className="border-t border-line pt-3"><summary className="cursor-pointer font-medium">Professional presets</summary>
      <div className="mt-3 grid grid-cols-2 gap-2">{PRESETS.map((preset) => <button key={preset.name} type="button" className="min-h-10 rounded border border-line px-2 text-left text-sm"
        onClick={() => s.editing.update({ styleId: preset.styleId, appearance: preset.appearance, animation: { ...s.editing.settings.animation, effect: preset.effect } })}>{preset.name}</button>)}</div>
      {saved.map((preset, index) => <div key={index} className="flex items-center justify-between gap-2 text-sm">
        <button type="button" className="min-h-10 underline" onClick={() => s.editing.update({ styleId: preset.styleId, appearance: preset.appearance, animation: preset.animation })}>{preset.name}</button>
        <button type="button" className="min-h-10 underline" onClick={() => {
          if (!window.confirm(`Delete preset ${preset.name}?`)) return;
          const next = saved.filter((_, i) => i !== index);
          void localDb().then((db) => db.put("settings", next, "subtitlePresets")).then(() => setSaved(next)).catch(() => setProblem("Couldn't delete this preset."));
        }}>Delete</button>
      </div>)}
      <button type="button" className="mt-2 min-h-10 underline text-sm" onClick={() => {
        const name = window.prompt("Name your subtitle preset"); if (!name?.trim()) return;
        const next = [...saved, { name: name.trim().slice(0, 60), styleId: s.styleId, appearance: a, animation: s.editing.settings.animation }].slice(-30);
        void localDb().then((db) => db.put("settings", next, "subtitlePresets")).then(() => setSaved(next)).catch(() => setProblem("Couldn't save this preset. Check browser storage."));
      }}>Save current subtitle preset</button>
    </details>
    <FontBrowser session={s} />
    <details className="border-t border-line pt-3" open><summary className="cursor-pointer font-medium">Subtitle appearance</summary>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        <label className="flex gap-2"><input type="checkbox" checked={a.italic ?? false} onChange={(e) => set({ italic: e.target.checked })} />Italic (browser slant)</label>
        <label>Text alignment <select aria-label="Text alignment" value={a.align ?? "center"} onChange={(e) => set({ align: e.target.value as Appearance["align"] })} className="ml-2 min-h-10 rounded border bg-panel p-2">{["left", "center", "right"].map((v) => <option key={v}>{v}</option>)}</select></label>
        <label>Capitalization <select aria-label="Text transformation" value={a.transform ?? "none"} onChange={(e) => set({ transform: e.target.value as Appearance["transform"] })} className="ml-2 min-h-10 rounded border bg-panel p-2">{["none", "uppercase", "lowercase"].map((v) => <option key={v}>{v}</option>)}</select></label>
        {([ ["textColor", "Text color", s.style.textColor], ["strokeColor", "Outline color", s.style.strokeColor], ["shadowColor", "Shadow color", "#000000"], ["boxColor", "Subtitle background color", "#000000"], ["highlightColor", "Spoken-word highlight color", "#FFD60A"] ] as const).map(([key, label, fallback]) =>
          <label key={key} className="flex items-center justify-between gap-2">{label}<input aria-label={label} type="color" value={a[key] ?? fallback} onChange={(e) => set({ [key]: e.target.value })} /></label>)}
        <label className="flex gap-2"><input type="checkbox" checked={s.style.shadow} onChange={(e) => set({ shadow: e.target.checked })} />Shadow</label>
        <label className="flex gap-2"><input type="checkbox" checked={s.style.highlight.kind !== "none"} onChange={(e) => set({ highlightEnabled: e.target.checked })} />Spoken-word highlight</label>
        {ranges.map(({ key, label, min, max, step, fallback }) => {
          const value = typeof a[key] === "number" ? a[key] as number : typeof s.style[key as keyof typeof s.style] === "number" ? s.style[key as keyof typeof s.style] as number : fallback;
          return <label key={key}>{label} <output>{value.toFixed(step === 1 ? 0 : 2)}</output>
            <input type="range" className="block w-full" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => set({ [key]: Number(e.target.value) })} /></label>;
        })}
      </div>
    </details>
    <PositionPanel session={s} />
    <AnimationPanel session={s} />
    {problem && <p role="alert" className="text-sm text-red-700">{problem}</p>}
  </div>;
}

function PositionPanel({ session: s }: { session: ReelSession }) {
  const a = s.editing.settings.appearance;
  return <fieldset className="flex flex-col gap-3 border-t border-line pt-3 text-sm"><legend className="font-medium">Caption placement</legend>
    <div className="flex flex-wrap gap-2">{([ ["Top", 0.15], ["Upper middle", 0.3], ["Center", 0.5], ["Lower middle", 0.7], ["Bottom", 0.85] ] as const).map(([label, value]) =>
      <button key={label} type="button" className="min-h-10 rounded border px-2" onClick={() => s.editing.update({ appearance: { ...a, verticalPosition: value } })}>{label}</button>)}</div>
    {([ ["horizontalPosition", "Caption horizontal position", s.style.horizontalPosition ?? 0.5], ["verticalPosition", "Caption vertical position", s.style.verticalPosition] ] as const).map(([key, label, value]) =>
      <label key={key}>{label}<input type="range" aria-label={label} min={0.05} max={0.95} step={0.001} value={value} className="block w-full"
        onChange={(e) => s.editing.update({ appearance: { ...a, [key]: Number(e.target.value) } })} /></label>)}
    <label className="flex gap-2"><input type="checkbox" checked={s.showGuides} onChange={(e) => s.setShowGuides(e.target.checked)} />Show safe areas and drag captions on the preview</label>
    <label className="flex gap-2"><input type="checkbox" checked={s.editing.settings.captionPositionLocked} onChange={(e) => s.editing.update({ captionPositionLocked: e.target.checked })} />Lock all caption positions on preview</label>
    <p className="text-xs text-muted">Safe guides reserve 10% at the sides and 15% top/bottom. Platform overlays vary. Drag near the center to snap; sliders support keyboard arrows.</p>
  </fieldset>;
}

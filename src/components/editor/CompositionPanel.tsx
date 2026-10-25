"use client";
import { ASPECT_RATIOS } from "@/lib/media/composition";
import type { Composition } from "@/lib/editor/project";
import type { ReelSession } from "./useReelSession";

export function CompositionPanel({ session: s }: { session: ReelSession }) {
  const c = s.editing.settings.composition;
  const update = (patch: Partial<Composition>) => s.editing.update({ composition: { ...c, ...patch } });
  return <fieldset className="flex flex-col gap-3 border-t border-line pt-3" data-testid="composition-panel">
    <legend className="font-medium">Composition</legend>
    <label className="text-sm">Aspect ratio
      <select className="mt-1 min-h-10 w-full rounded border bg-panel p-2" aria-label="Aspect ratio" value={c.ratio}
        onChange={(e) => update({ ratio: e.target.value as Composition["ratio"] })}>
        <option value="preset">Use export preset</option>
        {ASPECT_RATIOS.map((ratio) => <option key={ratio}>{ratio}</option>)}
        <option value="original">Original dimensions</option>
      </select>
    </label>
    <label className="text-sm">Framing
      <select aria-label="Composition framing" className="mt-1 min-h-10 w-full rounded border bg-panel p-2" value={s.framing}
        onChange={(e) => s.setFraming(e.target.value as "fill" | "fit")}>
        <option value="fill">Fill — crop overflow</option><option value="fit">Fit — keep whole video</option>
      </select>
    </label>
    {([ ["x", "Horizontal crop position", 0, 1], ["y", "Vertical crop position", 0, 1], ["scale", "Video scale", 0.5, 3] ] as const).map(([key, label, min, max]) =>
      <label className="text-sm" key={key}>{label} <output>{c[key].toFixed(2)}</output>
        <input className="block w-full" type="range" aria-label={label} min={min} max={max} step={0.01} value={c[key]}
          onChange={(e) => update({ [key]: Number(e.target.value) })} />
      </label>)}
    <label className="flex items-center justify-between text-sm">Background color <input aria-label="Letterbox color" type="color" value={c.background}
      onChange={(e) => update({ background: e.target.value })} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.blur} onChange={(e) => update({ blur: e.target.checked })} />Blurred source background (more processing)</label>
    <p className="text-xs text-muted">The preview and MP4 use the same composition. Caption edits and style are kept when changing ratio.</p>
  </fieldset>;
}

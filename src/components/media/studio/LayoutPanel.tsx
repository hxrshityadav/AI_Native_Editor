"use client";
import type { CaptionStyle } from "@/lib/subtitles/captions";
import { ASPECT_LABELS, outputSize, type Aspect, type Composition, type Fit } from "@/lib/subtitles/compose";
import { SegmentedChoice, styles } from "../../tools/surface/ToolSurface";
import css from "../SubtitleStudio.module.css";

/* Output frame (aspect ratio, fit, crop framing, size) and caption placement. */

export function LayoutPanel({ composition, setComposition, style, setStyle, source }: {
  composition: Composition; setComposition: (next: Composition) => void; style: CaptionStyle; setStyle: (patch: Partial<CaptionStyle>) => void; source: { width: number; height: number };
}) {
  const size = outputSize(source.width, source.height, composition);
  const set = (patch: Partial<Composition>) => setComposition({ ...composition, ...patch });
  return <div className={css.styleBody}>
    <fieldset className={css.aspectGrid}><legend className={styles.label}>Aspect ratio</legend>
      {(Object.keys(ASPECT_LABELS) as Aspect[]).map(aspect => { const s = outputSize(source.width, source.height, { aspect, scale: 1 }); return <label key={aspect} className={css.aspectCard} data-checked={composition.aspect === aspect || undefined}>
        <input type="radio" name="aspect" className="sr-only" checked={composition.aspect === aspect} onChange={() => set({ aspect, fit: aspect === "source" ? "contain" : composition.fit })} />
        <span className={css.aspectShape} style={{ aspectRatio: `${s.width} / ${s.height}` }} aria-hidden />
        <span className={css.presetName}>{ASPECT_LABELS[aspect]}</span><span className={css.presetNote}>{s.width} × {s.height}</span></label>; })}
    </fieldset>
    {composition.aspect !== "source" && <SegmentedChoice legend="Fit the video" name="fit" options={[{ value: "contain", label: "Whole picture" }, { value: "cover", label: "Fill frame" }, { value: "crop", label: "Crop and frame" }]} value={composition.fit} onChange={(fit: Fit) => set({ fit })}
      hint={composition.fit === "contain" ? "The whole picture is shown; empty space uses the background colour." : composition.fit === "cover" ? "The frame is filled from the centre; edges are cropped. The original video is not changed." : "Drag the picture in the preview, or use the controls, to choose what stays in frame."} />}
    {composition.fit === "contain" && composition.aspect !== "source" && <label className={styles.group}><span className={styles.label}>Background colour</span><input className={css.color} type="color" aria-label="Frame background colour" value={composition.background} onChange={event => set({ background: event.target.value })} /></label>}
    {composition.fit === "crop" && <>
      <Range label="Zoom" value={composition.framing.zoom} min={1} max={3} step={0.05} unit="×" onChange={zoom => set({ framing: { ...composition.framing, zoom } })} />
      <Range label="Horizontal framing" value={composition.framing.x} min={0} max={1} step={0.01} onChange={x => set({ framing: { ...composition.framing, x } })} />
      <Range label="Vertical framing" value={composition.framing.y} min={0} max={1} step={0.01} onChange={y => set({ framing: { ...composition.framing, y } })} />
    </>}
    <SegmentedChoice legend="Export size" name="scale" options={[{ value: "1", label: "Full" }, { value: "0.75", label: "75%" }, { value: "0.5", label: "Half" }]} value={String(composition.scale) as "1" | "0.75" | "0.5"} onChange={value => set({ scale: Number(value) })}
      hint={`${size.width} × ${size.height} H.264. Smaller sizes export faster on slower devices.`} />

    <fieldset className={css.positionBox}><legend className={styles.label}>Caption position</legend>
      <div className={css.actions}>
        {([["Top", 0.15], ["Centre", 0.5], ["Bottom", 0.8]] as const).map(([label, y]) => <button key={label} type="button" className={styles.secondary} aria-pressed={Math.abs(style.y - y) < 0.02} onClick={() => setStyle({ y })}>{label}</button>)}
        <button type="button" className={styles.secondary} onClick={() => setStyle({ x: 0.5, align: "center" })}>Centre horizontally</button>
      </div>
      <p className={styles.help}>Or drag the caption in the preview; it snaps to the centre line and always stays inside the safe area.</p>
      <Range label="Horizontal position" value={style.x} min={0} max={1} step={0.01} onChange={x => setStyle({ x })} />
      <Range label="Vertical position" value={style.y} min={0} max={1} step={0.01} onChange={y => setStyle({ y })} />
      <Range label="Caption box width" value={style.width} min={0.3} max={1} step={0.05} unit="×" onChange={width => setStyle({ width })} />
      <Range label="Safe-area margin" value={style.safeMargin} min={0.5} max={1.5} step={0.05} unit="×" onChange={safeMargin => setStyle({ safeMargin })} />
      <button type="button" className={css.text} onClick={() => setStyle({ x: 0.5, y: 0.78, width: 1, safeMargin: 1, align: "center" })}>Reset position</button>
    </fieldset>
  </div>;
}

function Range({ label, value, min, max, step, unit = "", onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (value: number) => void }) {
  return <label className={styles.group}><span className={styles.label}>{label}<span className={styles.value}>{value.toFixed(2)}{unit}</span></span>
    <input className={styles.range} type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></label>;
}

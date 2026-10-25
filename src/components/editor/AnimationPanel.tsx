"use client";
import { useEffect, useRef, useState } from "react";
import { ANIMATIONS } from "@/lib/captions/animation";
import { drawCaption } from "@/lib/captions/draw";
import type { Animation } from "@/lib/editor/project";
import type { ReelSession } from "./useReelSession";

export function AnimationPanel({ session: s, expanded = false }: { session: ReelSession; expanded?: boolean }) {
  const [query, setQuery] = useState("");
  const [sampleTime, setSampleTime] = useState(0.15);
  const a = s.editing.settings.animation;
  const hasDuration = !["none", "reveal", "typewriter"].includes(a.effect);
  const hasIntensity = ["slide", "scale", "pop", "bounce"].includes(a.effect);
  return <details open={expanded} className="border-t border-line pt-3"><summary className="cursor-pointer font-medium">Subtitle animations</summary>
    <div className="mt-3 flex flex-col gap-3 text-sm">
      <input aria-label="Search animations" placeholder="Search effects" value={query} onChange={(e) => setQuery(e.target.value)} className="min-h-10 rounded border bg-panel px-2" />
      <label>Sample animation time <input type="range" aria-label="Animation sample time" min={0} max={1} step={0.01} value={sampleTime} onChange={(e) => setSampleTime(Number(e.target.value))} className="block w-full" /></label>
      <div className="grid grid-cols-2 gap-2">{ANIMATIONS.filter((effect) => effect.name.toLowerCase().includes(query.toLowerCase())).map((effect) =>
        <button className="min-h-10 rounded border border-line p-2 text-left" type="button" key={effect.id} aria-label={effect.name} aria-pressed={a.effect === effect.id}
          onClick={() => s.editing.update({ animation: { ...a, effect: effect.id } })} title={effect.description}>
          <span className="font-medium">{effect.name}</span><EffectSample session={s} effect={effect.id} time={sampleTime} />
        </button>)}</div>
      <label>Entrance duration <output>{a.duration.toFixed(2)} s</output><input disabled={!hasDuration} type="range" aria-label="Animation duration" min={0.05} max={1} step={0.01} value={a.duration}
        onChange={(e) => s.editing.update({ animation: { ...a, duration: Number(e.target.value) } })} className="block w-full" /></label>
      <label>Motion intensity <input disabled={!hasIntensity} type="range" aria-label="Animation intensity" min={0} max={1} step={0.01} value={a.intensity}
        onChange={(e) => s.editing.update({ animation: { ...a, intensity: Number(e.target.value) } })} className="block w-full" /></label>
      <p className="text-xs text-muted">Samples are scrubbed manually; nothing auto-animates in this browser. Reveal and Typewriter follow each word&apos;s timing. Motion intensity applies to Slide, Scale, Pop and Bounce. Video effects use timestamp-based Canvas rendering in preview and export.</p>
    </div>
  </details>;
}
function EffectSample({ session: s, effect, time }: { session: ReelSession; effect: Animation["effect"]; time: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d"); if (!ctx || !s.fontReady) return;
    ctx.clearRect(0, 0, 240, 90);
    drawCaption(ctx, { text: "Your story", start: 0, end: 1, words: [{ text: "Your", start: 0, end: 0.5 }, { text: "story", start: 0.5, end: 1 }] }, time,
      { ...s.style, textColor: "#FFFFFF", fontSizeRatio: 0.24, verticalPosition: 0.5, horizontalPosition: 0.5, animation: { ...s.editing.settings.animation, effect } }, 240, 90);
  }, [s.style, s.fontReady, s.editing.settings.animation, effect, time]);
  return <canvas ref={ref} width={240} height={90} className="mt-1 w-full rounded bg-zinc-900" aria-label={`${effect} animation sample`} />;
}

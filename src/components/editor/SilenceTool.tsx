"use client";

import { useEffect, useRef } from "react";
import { DEFAULT_SILENCE_SETTINGS, FRAME_SEC, type SilenceSettings } from "@/lib/edit/silence";
import { replaceOrigin } from "@/lib/edit/timeline";
import { btn, btnSecondary, DataFlow, ProblemBox, Progress } from "./parts";
import type { ReelSession } from "./useReelSession";

/**
 * Remove Silence: analyse on this device, review suggested cuts on a timeline, adjust, apply.
 * Nothing is cut until the user applies, and every apply can be undone.
 */
export function SilenceTool({ session: s }: { session: ReelSession }) {
  const tool = s.silence;
  const { analysis, detection } = tool;
  const duration = s.probe?.durationSec ?? 0;
  const appliedSilence = s.cuts.value.intervals.filter((i) => i.origin === "silence" && i.action === "remove");

  return (
    <div data-testid="silence-tool" className="flex flex-col gap-3">
      <DataFlow testId="silence-flow">
        The audio is measured here to find quiet stretches; nothing is uploaded. Your original file is never changed:
        cuts are a list you can undo, and only the export contains them.
      </DataFlow>

      {analysis.status !== "running" && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" data-testid="silence-analyze" className={analysis.status === "ready" ? btnSecondary : btn} onClick={() => void tool.analyze()}>
            {analysis.status === "ready" ? "Analyse again" : "Find silences"}
          </button>
          {analysis.status === "ready" && !tool.reviewing && (
            <button type="button" data-testid="silence-review" className={btnSecondary} onClick={tool.review}>
              Review cuts
            </button>
          )}
        </div>
      )}
      {analysis.status === "running" &&
        (s.audio.status === "running" ? (
          <Progress testId="silence-progress" label="Preparing the audio on this device" value={s.audio.progress} />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Progress testId="silence-progress" label="Measuring audio levels" value={analysis.progress} />
            <button type="button" data-testid="silence-cancel-analysis" className={btnSecondary} onClick={tool.cancelAnalysis}>
              Cancel
            </button>
          </div>
        ))}
      {analysis.status === "error" && <ProblemBox testId="silence-error" problem={analysis.problem} />}

      {analysis.status === "ready" && detection && (
        <>
          <p data-testid="silence-levels" className="text-sm text-zinc-600 dark:text-zinc-400">
            Quiet parts of this clip sit around {detection.stats.floorDb} dB and speech around {detection.stats.speechDb} dB.
            Anything below {detection.thresholdDb} dB counts as silence.
          </p>
          <Timeline session={s} />
          {tool.reviewing ? (
            <Review session={s} />
          ) : (
            <p data-testid="silence-applied" className="text-sm">
              {appliedSilence.length
                ? `${appliedSilence.length} silence cut${appliedSilence.length === 1 ? "" : "s"} applied: ${formatTime(duration)} → ${formatTime(s.appliedMap.outputDuration)}.`
                : "No silence cuts applied."}
            </p>
          )}
        </>
      )}

      {(s.cuts.canUndo || s.cuts.canRedo || appliedSilence.length > 0) && !tool.reviewing && (
        <div className="flex flex-wrap gap-2">
          <button type="button" data-testid="silence-undo" className={btnSecondary + " disabled:opacity-40"} disabled={!s.cuts.canUndo} onClick={s.cuts.undo}>
            Undo
          </button>
          <button type="button" data-testid="silence-redo" className={btnSecondary + " disabled:opacity-40"} disabled={!s.cuts.canRedo} onClick={s.cuts.redo}>
            Redo
          </button>
          {appliedSilence.length > 0 && (
            <button
              type="button"
              data-testid="silence-remove-all"
              className={btnSecondary}
              onClick={() => s.cuts.set(replaceOrigin(s.cuts.value, "silence", []))}
            >
              Remove all silence cuts
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Review({ session: s }: { session: ReelSession }) {
  const tool = s.silence;
  const duration = s.probe?.durationSec ?? 0;
  const selected = tool.proposed.filter((i) => i.action === "remove");
  const removedSec = selected.reduce((n, i) => n + i.end - i.start, 0);
  const output = tool.reviewMap?.outputDuration ?? duration;
  return (
    <div className="flex flex-col gap-3">
      <p data-testid="silence-summary" className="text-sm font-medium">
        {tool.proposed.length === 0
          ? "No silences match these settings. Lower the shortest silence, or raise the threshold."
          : `${selected.length} of ${tool.proposed.length} suggested cuts selected: removes ${removedSec.toFixed(1)} s (${formatTime(duration)} → ${formatTime(output)}).`}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid="silence-apply" className={btn + " disabled:opacity-40"} disabled={selected.length === 0} onClick={tool.apply}>
          Apply {selected.length} cut{selected.length === 1 ? "" : "s"}
        </button>
        <button type="button" data-testid="silence-cancel-review" className={btnSecondary} onClick={tool.cancelReview}>
          Cancel
        </button>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        The preview now plays the proposed result, jumping over the selected cuts. The export cuts them out of the file.
        Untick a cut, or tap it on the timeline, to keep that part.
      </p>
      {tool.proposed.length > 0 && (
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm" aria-label="Suggested cuts">
          {tool.proposed.map((cut, i) => (
            <li key={`${cut.start}-${cut.end}`}>
              <label className="flex min-h-10 items-center gap-2">
                <input type="checkbox" data-testid={`silence-cut-${i}`} checked={cut.action === "remove"} onChange={() => tool.toggle(i)} />
                Cut {formatTime(cut.start, true)}–{formatTime(cut.end, true)} ({(cut.end - cut.start).toFixed(1)} s)
              </label>
            </li>
          ))}
        </ul>
      )}
      <Settings settings={tool.settings} onChange={tool.setSettings} onReset={tool.resetSettings} autoDb={tool.detection?.stats.autoThresholdDb ?? -40} />
    </div>
  );
}

/** Measured levels with the suggested (while reviewing) or applied cuts on top. Click a cut to keep or remove it. */
function Timeline({ session: s }: { session: ReelSession }) {
  const tool = s.silence;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const duration = s.probe?.durationSec ?? 0;
  const levels = tool.analysis.status === "ready" ? tool.analysis.levels : null;
  const threshold = tool.detection?.thresholdDb ?? -40;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !levels) return;
    const width = (canvas.width = 600);
    const height = (canvas.height = 64);
    ctx.clearRect(0, 0, width, height);
    const perColumn = Math.max(1, levels.length / width);
    const y = (db: number) => height - ((Math.max(-80, Math.min(0, db)) + 80) / 80) * height;
    ctx.fillStyle = "#71717a";
    for (let x = 0; x < width; x++) {
      let peak = -100;
      for (let i = Math.floor(x * perColumn); i < Math.min(levels.length, (x + 1) * perColumn); i++) peak = Math.max(peak, levels[i]);
      ctx.fillRect(x, y(peak), 1, height - y(peak));
    }
    ctx.fillStyle = "#d97706";
    ctx.fillRect(0, y(threshold), width, 1);
  }, [levels, threshold]);

  const shown = tool.reviewing ? tool.proposed : s.cuts.value.intervals.filter((i) => i.origin === "silence");
  return (
    <div data-testid="silence-timeline" className="relative h-16 w-full overflow-hidden rounded border bg-zinc-50 dark:bg-zinc-900">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      {duration > 0 &&
        shown.map((cut, i) => (
          <button
            type="button"
            key={`${cut.start}-${cut.end}`}
            disabled={!tool.reviewing}
            onClick={() => tool.toggle(i)}
            title={`${cut.action === "remove" ? "Cut" : "Kept"}: ${formatTime(cut.start, true)}–${formatTime(cut.end, true)}`}
            aria-label={`${cut.action === "remove" ? "Cut" : "Kept"} ${formatTime(cut.start, true)} to ${formatTime(cut.end, true)}`}
            className={`absolute inset-y-0 ${cut.action === "remove" ? "bg-red-500/40 ring-1 ring-red-600" : "bg-zinc-400/20 ring-1 ring-zinc-400 ring-dashed"}`}
            style={{ left: `${(cut.start / duration) * 100}%`, width: `max(2px, ${((cut.end - cut.start) / duration) * 100}%)` }}
          />
        ))}
      <span className="sr-only">Audio levels at {FRAME_SEC * 1000} ms resolution, with cuts marked.</span>
    </div>
  );
}

function Settings({
  settings,
  onChange,
  onReset,
  autoDb,
}: {
  settings: SilenceSettings;
  onChange: (s: SilenceSettings) => void;
  onReset: () => void;
  autoDb: number;
}) {
  const set = (patch: Partial<SilenceSettings>) => onChange({ ...settings, ...patch });
  const auto = settings.thresholdDb === "auto";
  return (
    <details className="rounded border px-3 py-2 text-sm">
      <summary data-testid="silence-settings" className="cursor-pointer font-medium">
        Settings: {auto ? "automatic threshold" : `${settings.thresholdDb} dB`}, cuts{" "}
        {settings.mode === "long" ? `pauses over ${settings.longPauseSec} s` : `silences over ${settings.minSilenceSec} s`}
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="font-medium">Silence threshold</span>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="silence-threshold-auto"
              checked={auto}
              onChange={(e) => set({ thresholdDb: e.target.checked ? "auto" : autoDb })}
            />
            Automatic ({autoDb} dB for this clip)
          </label>
          {!auto && (
            <Slider testId="silence-threshold" label="Threshold" unit="dB" min={-65} max={-20} step={1} value={settings.thresholdDb as number} onChange={(v) => set({ thresholdDb: v })} />
          )}
          <Help>Quieter than this counts as silence. Automatic keeps background music and quiet speech; raise it only if a noisy room hides the pauses.</Help>
        </div>
        <div className="flex flex-col gap-1">
          <Slider testId="silence-min" label="Shortest silence to cut" unit="s" min={0.3} max={3} step={0.1} value={settings.minSilenceSec} onChange={(v) => set({ minSilenceSec: v })} />
          <Help>Shorter pauses are normal speech rhythm and are never suggested.</Help>
        </div>
        <div className="flex flex-col gap-1">
          <Slider testId="silence-keep-after" label="Keep after speech" unit="s" min={0} max={0.5} step={0.05} value={settings.keepAfterSpeechSec} onChange={(v) => set({ keepAfterSpeechSec: v })} />
          <Slider testId="silence-keep-before" label="Keep before speech" unit="s" min={0} max={0.5} step={0.05} value={settings.keepBeforeSpeechSec} onChange={(v) => set({ keepBeforeSpeechSec: v })} />
          <Help>Silence left around each cut so words don&apos;t start or end abruptly and breaths survive.</Help>
        </div>
        <div className="flex flex-col gap-1">
          <Slider testId="silence-min-pause" label="Shortest pause left" unit="s" min={0} max={1} step={0.05} value={settings.minPauseSec} onChange={(v) => set({ minPauseSec: v })} />
          <Help>A cut never shortens a pause between sentences below this, so the video keeps a natural rhythm.</Help>
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="font-medium">Which pauses</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="silence-mode" data-testid="silence-mode-all" checked={settings.mode === "all"} onChange={() => set({ mode: "all" })} />
            Every silence above the shortest length
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="silence-mode" data-testid="silence-mode-long" checked={settings.mode === "long"} onChange={() => set({ mode: "long" })} />
            Only long pauses
          </label>
          {settings.mode === "long" && (
            <Slider testId="silence-long" label="Long means at least" unit="s" min={0.5} max={5} step={0.1} value={settings.longPauseSec} onChange={(v) => set({ longPauseSec: v })} />
          )}
        </fieldset>
      </div>
      <button
        type="button"
        data-testid="silence-reset"
        className={btnSecondary + " mt-3 disabled:opacity-40"}
        disabled={JSON.stringify(settings) === JSON.stringify(DEFAULT_SILENCE_SETTINGS)}
        onClick={onReset}
      >
        Reset to defaults
      </button>
    </details>
  );
}

function Slider(props: { testId: string; label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span>
        {props.label}: <span className="tabular-nums">{props.value}</span> {props.unit}
      </span>
      <input
        type="range"
        data-testid={props.testId}
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-zinc-600 dark:text-zinc-400">{children}</p>;
}

function formatTime(sec: number, tenths = false): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${(tenths ? s.toFixed(1) : Math.round(s).toString()).padStart(tenths ? 4 : 2, "0")}`;
}

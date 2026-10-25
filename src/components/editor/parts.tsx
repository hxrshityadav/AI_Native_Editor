"use client";

import { useEffect, useRef } from "react";
import { CAPTION_STYLES, drawCaption, lineAt, type CaptionLine, type CaptionStyle } from "@/lib/captions";
import type { Problem } from "@/lib/media/errors";
import {
  EXPORT_PRESETS,
  isNineSixteen,
  type ExportPlan,
  type ExportPresetId,
  type Framing,
} from "@/lib/media/exportPresets";
import { TRANSCRIPTION_DISCLOSURE } from "@/lib/transcription/client";
import type { CaptionLanguage } from "@/lib/transcription/types";
import type { ReelSession } from "./useReelSession";

// min-h-10: 40px touch targets on phones.
export const btn =
  "inline-flex min-h-10 items-center rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:cursor-not-allowed disabled:opacity-40";
export const btnSecondary = "inline-flex min-h-10 items-center rounded-md border px-4 py-2 text-sm";

/**
 * The video as the export will frame it: the output's aspect ratio, the same crop (cover) or bars
 * (contain), and captions drawn on a canvas at the output resolution, exactly as the export draws them.
 */
export function Preview({
  src,
  lines,
  style,
  fontReady,
  videoRef,
  onError,
  frame,
  heightClassName = "[--preview-h:70vh]",
}: {
  src: string;
  lines: CaptionLine[];
  style: CaptionStyle;
  /** Until the bundled font loads, captions are not drawn rather than drawn in a misleading fallback font. */
  fontReady: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onError: () => void;
  frame: ExportPlan;
  /** Sets --preview-h, the most height the preview may take; width follows the output aspect ratio. */
  heightClassName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height, fit } = frame;

  useEffect(() => {
    let raf = 0;
    // Redraw only when the frame time or size changes: a paused preview then costs nothing,
    // instead of a full-frame clear and draw 60 times a second (measured 47% main-thread busy
    // at idle with a 4× CPU throttle). Effect deps cover lines, style, font and frame changes.
    let drawn = "";
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const key = video ? `${video.currentTime}|${video.videoWidth}` : "";
      if (video && canvas && ctx && video.videoWidth && key !== drawn) {
        drawn = key;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        ctx.clearRect(0, 0, width, height);
        const t = video.currentTime;
        const line = lineAt(lines, t);
        if (line && fontReady) drawCaption(ctx, line, t, style, width, height);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, style, fontReady, videoRef, width, height]);

  return (
    <div
      data-testid="preview-frame"
      data-frame={`${width}x${height}`}
      className={`relative overflow-hidden rounded-lg bg-black ${heightClassName}`}
      style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(var(--preview-h) * ${width / height}))` }}
    >
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        onError={onError}
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: fit === "contain" ? "contain" : fit === "cover" ? "cover" : "fill" }}
      />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

/** Choose how the video is exported; for non-vertical clips, also how it is framed. */
export function ExportPresetPicker({ session: s }: { session: ReelSession }) {
  const source = s.probe?.video;
  const preset = EXPORT_PRESETS.find((p) => p.id === s.exportPreset)!;
  const asksFraming = !!source && !!preset.box && !isNineSixteen(source.width, source.height);
  return (
    <div className="flex flex-col gap-3">
      <OptionGroup
        legend="Export for"
        name="export-preset"
        options={EXPORT_PRESETS.map((p) => ({ id: p.id, label: p.name }))}
        value={s.exportPreset}
        onChange={(id) => s.setExportPreset(id as ExportPresetId)}
        testIdPrefix="preset"
      />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{preset.description}</p>
      {asksFraming && (
        <>
          <OptionGroup
            legend="Your video isn't vertical"
            name="framing"
            options={[
              { id: "fill", label: "Fill (crop the sides)" },
              { id: "fit", label: "Fit (bars above and below)" },
            ]}
            value={s.framing}
            onChange={(id) => s.setFraming(id as Framing)}
            testIdPrefix="framing"
          />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {s.framing === "fill"
              ? "Fill keeps the centre of your video, so check the speaker stays in frame in the preview."
              : "Fit keeps everything; captions may sit on the bar below the video."}
          </p>
        </>
      )}
      {s.plan && (
        <p data-testid="export-size" className="text-sm">
          Exports at {s.plan.width}×{s.plan.height}.
        </p>
      )}
    </div>
  );
}

function OptionGroup({
  legend,
  name,
  options,
  value,
  onChange,
  testIdPrefix,
}: {
  legend: string;
  name: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  testIdPrefix: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.id}
            className="relative cursor-pointer rounded-md border px-3 py-1.5 text-sm has-checked:border-foreground has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600"
          >
            <input
              type="radio"
              name={name}
              value={o.id}
              data-testid={`${testIdPrefix}-${o.id}`}
              checked={o.id === value}
              onChange={() => onChange(o.id)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Where a step's data goes. Every step has one, so nothing leaves the device unannounced. */
export function DataFlow({ testId, leaves = false, children }: { testId: string; leaves?: boolean; children: React.ReactNode }) {
  return (
    <p data-testid={testId} data-leaves-device={leaves} className="text-sm text-zinc-600 dark:text-zinc-400">
      <span className={leaves ? "font-medium text-amber-800 dark:text-amber-300" : "font-medium text-foreground"}>
        {leaves ? "Leaves this device: " : "Stays on this device. "}
      </span>
      {children}
    </p>
  );
}

/** The exact data that transcription sends, shown before the button that sends it. */
export function TranscribeDisclosure({ audioSize }: { audioSize: number | null }) {
  const name = TRANSCRIPTION_DISCLOSURE.providerName;
  return (
    <DataFlow testId="transcribe-disclosure" leaves>
      Sends only the extracted speech audio{audioSize !== null ? ` (${formatBytes(audioSize)})` : ""}, never the video,
      to our server, which forwards it to {name} for transcription. For Hinglish, the transcribed words (text only) also
      go to {name} to be written in Roman script. Our servers don&apos;t store the audio or the transcript.{" "}
      <a className="underline" href={TRANSCRIPTION_DISCLOSURE.privacyUrl} target="_blank" rel="noreferrer">
        {name}&apos;s privacy policy
      </a>{" "}
      applies to their processing.
    </DataFlow>
  );
}

export function Status({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <p data-testid={testId} role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
      {children}
    </p>
  );
}

export function Progress({ testId, label, value }: { testId: string; label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div data-testid={testId} role="status" className="flex items-center gap-3 text-sm">
      <progress max={100} value={pct} className="w-48 max-w-full" aria-label={label} />
      <span>
        {label} {pct}%
      </span>
    </div>
  );
}

export function ProblemBox({ testId, problem }: { testId: string; problem: Problem }) {
  return (
    <div data-testid={testId} role="alert" className="rounded bg-red-100 px-3 py-2 text-sm text-red-900">
      <p className="font-medium">{problem.message}</p>
      <p>{problem.action}</p>
    </div>
  );
}

export function StylePicker({ session }: { session: ReelSession }) {
  const { style, kit, setStyleId } = session;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">Caption style</legend>
      <div className="flex flex-wrap gap-2">
        {CAPTION_STYLES.map((s) => (
          <label
            key={s.id}
            className="relative cursor-pointer rounded-md border px-3 py-1.5 text-sm has-checked:border-foreground has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600"
          >
            <input
              type="radio"
              name="caption-style"
              value={s.id}
              data-testid={`style-${s.id}`}
              checked={s.id === style.id}
              onChange={() => setStyleId(s.id)}
              className="sr-only"
            />
            {s.name}
          </label>
        ))}
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {style.description}
        {kit?.enabled ? " Your brand kit sets the font, colours, size and position." : ""}
      </p>
    </fieldset>
  );
}

export function FontError({ session }: { session: ReelSession }) {
  if (!session.fontFailed) return null;
  return (
    <div data-testid="font-error" role="alert" className="rounded bg-red-100 px-3 py-2 text-sm text-red-900">
      <p className="font-medium">Couldn&apos;t load the font for this style, so the preview and export are paused.</p>
      <p>
        Check your connection, then{" "}
        <button type="button" className="underline" onClick={session.retryFont}>
          try again
        </button>
        .
      </p>
    </div>
  );
}

export function SaveStatus({ session }: { session: ReelSession }) {
  const { realWords, saveState, restoredAt, fingerprint, startOver } = session;
  if (!realWords) return null;
  return (
    <div data-testid="save-status" role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {saveState === "error" ? (
        <span className="text-red-800 dark:text-red-300">
          Couldn&apos;t save on this device (private browsing or full storage). Your edits will be lost if you reload or
          close this tab.
        </span>
      ) : (
        (restoredAt || saveState !== "idle") && (
          <span className="text-zinc-600 dark:text-zinc-400">
            {restoredAt ? `Restored your captions saved ${new Date(restoredAt).toLocaleString()}. ` : ""}
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved in this browser only." : ""}
          </span>
        )
      )}
      {fingerprint && (
        <button type="button" data-testid="start-over" onClick={() => void startOver()} className="underline">
          Start over
        </button>
      )}
    </div>
  );
}

export function PreviewError({ session }: { session: ReelSession }) {
  if (!session.previewFailed) return null;
  return (
    <p data-testid="preview-error" role="status" className="rounded bg-amber-100 px-3 py-2 text-sm text-amber-900">
      This browser can&apos;t play the video in the preview. Editing still works, and the export doesn&apos;t use this
      player, so render and check the MP4.
    </p>
  );
}

export function LanguageSelect({ value, onChange }: { value: CaptionLanguage; onChange: (l: CaptionLanguage) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      Language
      <select
        data-testid="language-select"
        value={value}
        onChange={(e) => onChange(e.target.value as CaptionLanguage)}
        className="rounded border px-2 py-1"
      >
        <option value="hinglish">Hinglish (Roman script)</option>
        <option value="hi">Hindi (Devanagari script)</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}

export function OfflineNote({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <p data-testid="offline-note" role="status" className="text-sm text-amber-800 dark:text-amber-300">
      You&apos;re offline. Transcribing needs a connection; every other step works offline.
    </p>
  );
}

export function RenderStatus({
  session: s,
  downloadClassName = btnSecondary + " w-fit",
}: {
  session: ReelSession;
  downloadClassName?: string;
}) {
  const { render } = s;
  return (
    <>
      {render.status === "running" && (
        <>
          <Progress testId="render-progress" label="Rendering" value={render.progress} />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Keep this tab open until it finishes. On a phone, don&apos;t switch apps: Android may pause the export.
          </p>
        </>
      )}
      {render.status === "error" && <ProblemBox testId="render-error" problem={render.problem} />}
      {render.status === "done" && (
        <div data-testid="render-done" className="flex flex-col gap-2 text-sm">
          <p>
            {formatBytes(render.sizeBytes)} in {(render.ms / 1000).toFixed(1)} s. No watermark.
          </p>
          <p data-testid="render-storage" data-storage={render.storage} className="text-zinc-600 dark:text-zinc-400">
            {render.storage === "disk"
              ? "Saved to this browser's private storage on your device until your next render."
              : "This browser can't write to device storage, so the video is held in memory. Long or 4K videos may fail here; try Chrome."}
          </p>
          <a data-testid="mp4-link" href={render.url} download={s.fileBaseName + "-captioned.mp4"} className={downloadClassName}>
            Download MP4
          </a>
        </div>
      )}
    </>
  );
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

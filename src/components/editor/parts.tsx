"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { drawComposition } from "@/lib/media/composition";
import { editedToSource, inInterval, remapCaptionLines, sourceToEdited } from "@/lib/editor/timeline";
import { drawOverlays } from "@/lib/captions/overlays";
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
import type { TranscribeConfigResponse } from "@/lib/transcription/types";
import type { CaptionLanguage } from "@/lib/transcription/types";
import type { ReelSession } from "./useReelSession";
import { moveOverlay, snapPosition } from "@/lib/editor/operations";
import type { TextBounds } from "@/lib/captions/draw";

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
  guides = false,
  onPositionChange,
  editor,
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
  guides?: boolean;
  onPositionChange?: (x: number, y: number) => void;
  editor?: ReelSession;
  /** Sets --preview-h, the most height the preview may take; width follows the output aspect ratio. */
  heightClassName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height, fit } = frame;
  const controlledPlayback = !!editor || !!frame.composition || !!frame.cuts?.length;
  const mappedLines = useMemo(() => remapCaptionLines(lines, frame.cuts ?? []), [lines, frame.cuts]);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bounds, setBounds] = useState<(TextBounds & { id: string; kind: "caption" | "overlay" })[]>([]);
  useEffect(() => { const video = videoRef.current; if (video) { video.muted = frame.audio?.muted ?? false; video.volume = frame.audio?.volume ?? 1; } }, [frame.audio, src, videoRef]);

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
        const cut = frame.cuts?.find((cut) => video.currentTime >= cut.start && video.currentTime < cut.end);
        if (cut) { video.currentTime = Math.min(cut.end, video.duration); raf = requestAnimationFrame(tick); return; }
        drawn = key;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        ctx.clearRect(0, 0, width, height);
        const gap = inInterval(video.currentTime, frame.gaps ?? []);
        video.volume = gap ? 0 : frame.audio?.volume ?? 1;
        if (gap) { ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, width, height); }
        else if (frame.composition) drawComposition(ctx, video.videoWidth, video.videoHeight, frame,
          (x, y, width, height) => ctx.drawImage(video, x, y, width, height));
        const t = video.currentTime;
        const captionTime = sourceToEdited(t, frame.cuts ?? []);
        const line = lineAt(mappedLines, captionTime);
        const nextBounds: typeof bounds = [];
        if (line && fontReady) drawCaption(ctx, line, captionTime, style, width, height, (box) => { if (line.id) nextBounds.push({ ...box, id: line.id, kind: "caption" }); });
        if (fontReady) drawOverlays(ctx, frame.overlays ?? [], t, style, width, height, (id, box) => nextBounds.push({ ...box, id, kind: "overlay" }), frame.cuts ?? []);
        setBounds((previous) => JSON.stringify(previous) === JSON.stringify(nextBounds) ? previous : nextBounds);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mappedLines, style, fontReady, videoRef, width, height, frame]);

  return (
    <>
    <div
      data-testid="preview-frame"
      data-frame={`${width}x${height}`}
      className={`relative overflow-hidden rounded-lg bg-black ${heightClassName}`}
      style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(var(--preview-h) * ${width / height}))` }}
    >
      <video
        ref={videoRef}
        src={src}
        controls={!controlledPlayback}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTime(sourceToEdited(e.currentTarget.currentTime, frame.cuts ?? []))}
        playsInline
        onError={onError}
        className="absolute inset-0 h-full w-full"
        style={{ opacity: frame.composition ? 0 : 1, objectFit: fit === "contain" ? "contain" : fit === "cover" ? "cover" : "fill" }}
      />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {editor && bounds.map((box) => {
        const selected = editor.selection?.kind === box.kind && "id" in editor.selection && editor.selection.id === box.id;
        const caption = editor.captionSegments.find((x) => x.id === box.id);
        const overlay = editor.editing.settings.overlays.find((x) => x.id === box.id);
        const locked = box.kind === "caption" ? caption?.locked || editor.editing.settings.captionPositionLocked : overlay?.locked;
        const position = (x: number, y: number) => {
          if (box.kind === "overlay") editor.editing.update({ overlays: moveOverlay(editor.editing.settings.overlays, box.id, x, y) });
          else editor.applyEdit([{ type: "caption_style", id: box.id, appearance: { horizontalPosition: snapPosition(x), verticalPosition: snapPosition(y) } }]);
        };
        return <button key={box.kind + box.id} aria-label={`Move ${box.kind}: ${caption?.words.map((w) => w.text).join(" ") ?? overlay?.text ?? ""}`} aria-pressed={selected}
          className={`absolute touch-none ${locked ? "cursor-default" : "cursor-move"} ${selected ? "border-2 border-blue-400 bg-blue-400/5" : "border border-transparent hover:border-white/60"}`}
          style={{ left: `${box.x / width * 100}%`, top: `${box.y / height * 100}%`, width: `${box.width / width * 100}%`, height: `${box.height / height * 100}%` }}
          onPointerDown={(e) => {
            editor.setSelection({ kind: box.kind, id: box.id }); if (locked) return;
            e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); editor.editing.beginGesture();
            const element = e.currentTarget; const frameBox = element.parentElement!.getBoundingClientRect();
            const originX = e.clientX, originY = e.clientY;
            const x = box.kind === "overlay" ? overlay!.x : caption?.appearance.horizontalPosition ?? style.horizontalPosition ?? 0.5;
            const y = box.kind === "overlay" ? overlay!.y : caption?.appearance.verticalPosition ?? style.verticalPosition;
            // A captured gesture uses its original metadata snapshot; the latest position replaces it.
            const move = (event: PointerEvent) => position(x + (event.clientX - originX) / frameBox.width, y + (event.clientY - originY) / frameBox.height);
            const finish = () => { element.removeEventListener("pointermove", move); element.removeEventListener("pointerup", finish); element.removeEventListener("pointercancel", finish); editor.editing.endGesture(); };
            element.addEventListener("pointermove", move); element.addEventListener("pointerup", finish); element.addEventListener("pointercancel", finish);
          }}
          onKeyDown={(e) => { if (locked || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return; e.preventDefault(); const x = overlay?.x ?? caption?.appearance.horizontalPosition ?? style.horizontalPosition ?? 0.5; const y = overlay?.y ?? caption?.appearance.verticalPosition ?? style.verticalPosition; position(x + (e.key === "ArrowRight" ? 0.025 : e.key === "ArrowLeft" ? -0.025 : 0), y + (e.key === "ArrowDown" ? 0.025 : e.key === "ArrowUp" ? -0.025 : 0)); }} />;
      })}
      {guides && <div className={`absolute inset-0 ${editor ? "pointer-events-none" : "cursor-move touch-none"}`} aria-label="Drag subtitle position"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const box = e.currentTarget.getBoundingClientRect();
          const snap = (value: number) => Math.abs(value - 0.5) < 0.025 ? 0.5 : Math.max(0.05, Math.min(0.95, value));
          onPositionChange?.(snap((e.clientX - box.left) / box.width), snap((e.clientY - box.top) / box.height));
        }}>
        <div className="pointer-events-none absolute border border-dashed border-white/70" style={{ inset: "15% 10%" }} />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-yellow-300/70" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-yellow-300/70" />
        <span className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-300 bg-black/50"
          style={{ left: `${(style.horizontalPosition ?? 0.5) * 100}%`, top: `${style.verticalPosition * 100}%` }} />
      </div>}
    </div>
    {controlledPlayback && <div className="flex w-full max-w-lg items-center gap-2 text-white">
      <button className={btnSecondary} type="button" onClick={() => {
        const video = videoRef.current;
        if (video?.paused) void video.play().catch(onError); else video?.pause();
      }}>{playing ? "Pause" : "Play"}</button>
      <input aria-label="Preview time" type="range" min={0} max={Number.isFinite(duration) ? sourceToEdited(duration, frame.cuts ?? []) : 0} step={0.01} value={time}
        onChange={(e) => { if (videoRef.current) videoRef.current.currentTime = editedToSource(Number(e.target.value), frame.cuts ?? []); }} className="min-w-0 flex-1" />
      <span className="text-xs">{time.toFixed(1)} s</span>
    </div>}
    </>
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
      {s.plan && s.planEncodable === false && (
        <ProblemBox
          testId="encode-unsupported"
          problem={{
            message: `This device can't encode video at ${s.plan.width}×${s.plan.height}.`,
            action:
              preset.id === "reels"
                ? "Choose Smaller file (up to 720×1280)."
                : "Choose Reels & Shorts (up to 1080×1920) or Smaller file.",
          }}
        />
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
export function TranscribeDisclosure({
  audioSize,
  config,
}: {
  audioSize: number | null;
  /** The server's answer to where uploads go; null until it arrives. */
  config: TranscribeConfigResponse | null;
}) {
  const provider = config?.provider;
  const audio = `the extracted speech audio${audioSize !== null ? ` (${formatBytes(audioSize)})` : ""}`;
  if (!config) {
    return (
      <DataFlow testId="transcribe-disclosure" leaves>
        Sends only {audio}, never the video, to our server for transcription. Where it goes next is shown here once our
        server responds; nothing is sent before that.
      </DataFlow>
    );
  }
  if (!provider) {
    return (
      <DataFlow testId="transcribe-disclosure" leaves>
        Transcription isn&apos;t set up on this server, so nothing will be sent.
          {" "}{config.setupError ?? "Set GROQ_API_KEY in .env.local at the project root, then restart the server."}
      </DataFlow>
    );
  }
  return (
    <DataFlow testId="transcribe-disclosure" leaves>
      Sends only {audio}, never the video, to our server, which forwards it to {provider.name} for transcription.
      {config.setupError && <> {config.setupError}</>}
      {config.romanizerName && (
        <>
          {" "}
          For Hinglish, any words in Hindi script (text only) also go to {config.romanizerName} to be written in Roman
          script.
        </>
      )}{" "}
      Our servers don&apos;t store the audio or the transcript.{" "}
      <a className="underline" href={provider.privacyUrl} target="_blank" rel="noreferrer">
        {provider.name}&apos;s privacy policy
      </a>{" "}
      applies to their processing.
      {config.humanCheckSiteKey && (
        <>
          {" "}
          To stop abuse, {TRANSCRIPTION_DISCLOSURE.humanCheckName} first checks this browser isn&apos;t a bot. Cloudflare
          sees your IP address and browser details, not your video or audio (
          <a className="underline" href={TRANSCRIPTION_DISCLOSURE.humanCheckPrivacyUrl} target="_blank" rel="noreferrer">
            Turnstile privacy
          </a>
          ).
        </>
      )}
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
        <div
          data-testid="render-done"
          data-audio={render.audioCodec ?? "none"}
          data-faststart={render.fastStart}
          className="flex flex-col gap-2 text-sm"
        >
          <p>
            {formatBytes(render.sizeBytes)} in {(render.ms / 1000).toFixed(1)} s. No watermark.
          </p>
          <p data-testid="render-storage" data-storage={render.storage} className="text-zinc-600 dark:text-zinc-400">
            {render.storage === "disk"
              ? "Saved to this browser's private storage on your device until your next render."
              : "This browser can't write to device storage, so the video is held in memory. Long or 4K videos may fail here; try Chrome."}
          </p>
          {render.audioCodec && render.audioCodec !== "aac" && (
            <p data-testid="audio-compat-warning" role="status" className="rounded bg-amber-100 px-3 py-2 text-amber-900">
              This browser can&apos;t make AAC audio, so the audio is {render.audioCodec.toUpperCase()}. YouTube accepts
              that, but Instagram and WhatsApp document AAC only. If an upload fails, export again in Chrome on your phone
              or on a Windows or Mac computer.
            </p>
          )}
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

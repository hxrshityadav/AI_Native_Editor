"use client";

import { useState } from "react";
import { BrandKitPanel } from "@/components/editor/BrandKitPanel";
import { HumanCheck } from "@/components/editor/HumanCheck";
import {
  btnSecondary,
  DataFlow,
  FontError,
  formatBytes,
  LanguageSelect,
  OfflineNote,
  Preview,
  PreviewError,
  ProblemBox,
  Progress,
  RenderStatus,
  SaveStatus,
  Status,
  StylePicker,
  TranscribeDisclosure,
  ExportPresetPicker,
} from "@/components/editor/parts";
import { TranscriptEditor } from "@/components/editor/TranscriptEditor";
import { useReelSession, type ReelSession } from "@/components/editor/useReelSession";
import { EXPORT_PRESETS } from "@/lib/media/exportPresets";

type StepId = "video" | "captions" | "style" | "export";
const STEPS: { id: StepId; title: string }[] = [
  { id: "video", title: "Video" },
  { id: "captions", title: "Captions" },
  { id: "style", title: "Style" },
  { id: "export", title: "Export" },
];

const primary =
  "inline-flex min-h-10 items-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export function StudioClient() {
  const s = useReelSession({ placeholders: false });
  const [step, setStep] = useState<StepId>("video");
  const index = STEPS.findIndex((x) => x.id === step);
  const hasCaptions = !!s.realWords?.length;

  /** Why a step can't be opened yet, or null when it can. */
  const lockedBecause = (id: StepId): string | null => {
    if (id === "video") return null;
    if (!s.ready) return "Pick a video first.";
    if (id === "export" && !hasCaptions) return "Make captions first.";
    return null;
  };
  const go = (id: StepId) => lockedBecause(id) === null && setStep(id);
  const next = STEPS[index + 1];
  const prev = STEPS[index - 1];

  return (
    <div className="flex h-dvh flex-col bg-surface text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-panel px-4">
        <span className="font-semibold">Reel Finisher</span>
        <span className="text-sm text-muted">Your video stays on this device</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[14rem_minmax(0,1fr)_26rem]">
        {/* Steps: a rail on desktop, a compact header on phones. */}
        <nav aria-label="Steps" className="hidden border-r border-line bg-panel p-3 lg:block">
          <ol className="flex flex-col gap-1">
            {STEPS.map((x, i) => {
              const locked = lockedBecause(x.id);
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    data-testid={`nav-${x.id}`}
                    aria-current={x.id === step ? "step" : undefined}
                    aria-disabled={locked !== null}
                    title={locked ?? undefined}
                    onClick={() => go(x.id)}
                    className={[
                      "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-blue-600",
                      x.id === step ? "bg-surface" : "hover:bg-surface/60",
                      locked ? "cursor-not-allowed opacity-50" : "",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                        x.id === step ? "bg-accent text-accent-ink" : "border border-line",
                      ].join(" ")}
                    >
                      {i + 1}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{x.title}</span>
                      <span className="text-xs text-muted">{stepStatus(x.id, s)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex items-baseline justify-between border-b border-line bg-panel px-4 py-2 lg:hidden">
          <h1 data-testid="mobile-step-title" className="font-medium">
            {STEPS[index].title}
          </h1>
          <span className="text-sm text-muted">
            Step {index + 1} of {STEPS.length}
          </span>
        </div>

        {/* Stage: the video, framed like a phone screen. */}
        <section
          aria-label="Preview"
          className="flex shrink-0 items-center justify-center bg-stage p-3 lg:min-h-0 lg:p-6"
        >
          {s.videoUrl && s.plan ? (
            <div className="flex w-full flex-col items-center gap-2">
              <PreviewError session={s} />
              <Preview
                src={s.videoUrl}
                lines={s.lines}
                style={s.style}
                fontReady={s.fontReady}
                videoRef={s.videoRef}
                onError={() => s.setPreviewFailed(true)}
                frame={s.plan}
                heightClassName="[--preview-h:38dvh] lg:[--preview-h:calc(100dvh-8rem)]"
              />
            </div>
          ) : (
            <DropZone session={s} />
          )}
        </section>

        {/* Controls for the current step. */}
        <section
          aria-labelledby="panel-title"
          className="flex min-h-0 flex-1 flex-col border-line bg-panel lg:border-l"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <h2 id="panel-title" className="hidden text-lg font-semibold lg:block">
              {STEPS[index].title}
            </h2>
            {step === "video" && <VideoPanel session={s} onContinue={() => go("captions")} />}
            {step === "captions" && <CaptionsPanel session={s} />}
            {step === "style" && <StylePanel session={s} />}
            {step === "export" && <ExportPanel session={s} />}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line p-3">
            <button
              type="button"
              data-testid="back-button"
              className={btnSecondary + (prev ? "" : " invisible")}
              onClick={() => prev && go(prev.id)}
            >
              Back
            </button>
            {!next && <ExportAction session={s} />}
            {next && (
              <div className="flex items-center gap-3">
                {lockedBecause(next.id) && <span className="text-sm text-muted">{lockedBecause(next.id)}</span>}
                <button
                  type="button"
                  data-testid="next-button"
                  disabled={lockedBecause(next.id) !== null}
                  className={btnSecondary + " disabled:cursor-not-allowed disabled:opacity-40"}
                  onClick={() => go(next.id)}
                >
                  Next: {next.title}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/** The export button lives in the sticky bar, so it stays in reach on a phone below the options. */
function ExportAction({ session: s }: { session: ReelSession }) {
  const { render } = s;
  if (render.status === "running") {
    return (
      <button type="button" className={btnSecondary} onClick={s.cancelRender}>
        Cancel export
      </button>
    );
  }
  return (
    <button
      type="button"
      data-testid="render-button"
      disabled={!s.fontReady}
      onClick={() => void s.startRender()}
      className={render.status === "done" ? btnSecondary + " disabled:opacity-40" : primary}
    >
      {render.status === "done" ? "Export again" : "Export MP4"}
    </button>
  );
}

function stepStatus(id: StepId, s: ReelSession): string {
  switch (id) {
    case "video":
      if (s.check.status === "ready") return `${s.check.probe.durationSec.toFixed(0)} s, ${s.check.probe.video?.width}×${s.check.probe.video?.height}`;
      if (s.check.status === "checking") return "Checking";
      if (s.check.status === "rejected") return "Can't use this file";
      return "Not picked";
    case "captions":
      if (s.audio.status === "running" || s.transcript.status === "running") return "Working";
      if (s.realWords) return `${s.realWords.length} words${s.edits ? ", edited" : ""}`;
      return "Not made";
    case "style":
      return s.style.name + (s.kit?.enabled ? " with brand kit" : "");
    case "export":
      if (s.render.status === "running") return `${Math.round(s.render.progress * 100)}%`;
      if (s.render.status === "done") return "Ready to download";
      return EXPORT_PRESETS.find((p) => p.id === s.exportPreset)?.name ?? "Not exported";
  }
}

function DropZone({ session: s }: { session: ReelSession }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) void s.pickFile(dropped);
      }}
      className={[
        "relative flex w-full max-w-sm cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center text-zinc-200 has-focus-visible:outline-2 has-focus-visible:outline-blue-500",
        over ? "border-accent bg-white/5" : "border-zinc-600",
      ].join(" ")}
    >
      <input
        type="file"
        accept="video/*"
        data-testid="file-input"
        className="sr-only"
        onChange={(e) => void s.pickFile(e.target.files?.[0] ?? null)}
      />
      <span className="text-lg font-semibold text-white">Choose a video</span>
      <span className="text-sm text-zinc-400">
        or drop it here. A vertical talking-head clip, up to 3 minutes. It stays on this device.
      </span>
    </label>
  );
}

function VideoPanel({ session: s, onContinue }: { session: ReelSession; onContinue: () => void }) {
  const { check } = s;
  return (
    <>
      <DataFlow testId="flow-1">The video is read in this browser to check its format. It is never uploaded.</DataFlow>
      {check.status === "idle" && <p className="text-sm text-muted">Pick a video to start.</p>}
      {check.status === "checking" && <Status testId="check-status">Checking the file and this device…</Status>}
      {check.status === "rejected" && (
        <>
          <ProblemBox testId="check-error" problem={check.problem} />
          <ChangeVideo session={s} label="Choose another video" />
        </>
      )}
      {check.status === "ready" && (
        <div data-testid="check-ok" className="flex flex-col gap-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Length</dt>
            <dd>{check.probe.durationSec.toFixed(1)} s</dd>
            <dt className="text-muted">Size</dt>
            <dd>
              {check.probe.video?.width}×{check.probe.video?.height}, {formatBytes(check.probe.fileSizeBytes)}
            </dd>
          </dl>
          {check.warnings.map((w) => (
            <p key={w.code} className="rounded bg-amber-100 px-3 py-2 text-amber-900">
              {w.reason} {w.action}
            </p>
          ))}
          {check.device.warnings.map((w) => (
            <p key={w} className="rounded bg-amber-100 px-3 py-2 text-amber-900">
              {w}
            </p>
          ))}
          <button type="button" data-testid="continue-captions" className={primary + " w-fit"} onClick={onContinue}>
            Continue to captions
          </button>
          <ChangeVideo session={s} label="Use a different video" />
        </div>
      )}
    </>
  );
}

function ChangeVideo({ session: s, label }: { session: ReelSession; label: string }) {
  return (
    <label className="relative w-fit cursor-pointer text-sm underline has-focus-visible:outline-2 has-focus-visible:outline-blue-600">
      <input
        type="file"
        accept="video/*"
        data-testid="file-input"
        className="sr-only"
        onChange={(e) => void s.pickFile(e.target.files?.[0] ?? null)}
      />
      {label}
    </label>
  );
}

function CaptionsPanel({ session: s }: { session: ReelSession }) {
  const { audio, transcript, probe } = s;
  const working = audio.status === "running" || transcript.status === "running";
  return (
    <>
      {s.realWords ? (
        // Shown in full before the first upload; afterwards one tap away, so the word editor fits on a phone.
        <details className="text-sm">
          <summary className="cursor-pointer">
            <span className="font-medium text-amber-800 dark:text-amber-300">Leaves this device: </span>
            what was sent to make these captions
          </summary>
          <div className="mt-2">
            <TranscribeDisclosure audioSize={audio.status === "done" ? audio.blob.size : null} humanCheck={s.humanCheck.status === "on"} />
          </div>
        </details>
      ) : (
        <TranscribeDisclosure audioSize={audio.status === "done" ? audio.blob.size : null} humanCheck={s.humanCheck.status === "on"} />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <LanguageSelect value={s.language} onChange={s.setLanguage} />
        <button
          type="button"
          data-testid="make-captions"
          disabled={working || !s.online || !s.humanReady}
          onClick={() => void s.makeCaptions()}
          className={s.realWords ? btnSecondary + " disabled:opacity-40" : primary}
        >
          {s.realWords ? "Make captions again" : "Make captions"}
        </button>
      </div>
      <HumanCheck session={s} />
      {s.realWords && s.edits && !working && (
        <p className="text-sm text-amber-800 dark:text-amber-300">Making captions again replaces your edits.</p>
      )}
      <OfflineNote online={s.online} />
      {audio.status === "running" && (
        <Progress testId="extract-progress" label="Preparing speech audio on this device" value={audio.progress} />
      )}
      {audio.status === "error" && <ProblemBox testId="extract-error" problem={audio.problem} />}
      {transcript.status === "running" && (
        <div className="flex items-center gap-3">
          <Status testId="transcribe-status">Uploading speech audio and transcribing…</Status>
          <button type="button" className={btnSecondary} onClick={s.cancelTranscribe}>
            Cancel
          </button>
        </div>
      )}
      {transcript.status === "error" && <ProblemBox testId="transcribe-error" problem={transcript.problem} />}
      {transcript.status === "done" && transcript.words.length === 0 && (
        <p data-testid="no-speech" className="text-sm">
          {transcript.providerName} found no speech. Check the clip has audible speech, or pick another language and try
          again.
        </p>
      )}
      {transcript.status === "done" && transcript.warning && (
        <div data-testid="transcribe-warning" role="status" className="rounded bg-amber-100 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">{transcript.warning.message}</p>
          <p>{transcript.warning.action}</p>
        </div>
      )}
      <SaveStatus session={s} />
      {s.realWords && s.realWords.length > 0 && probe && (
        <TranscriptEditor
          words={s.words}
          onChange={s.editWords}
          onUndo={s.undoEdit}
          canUndo={s.canUndo}
          videoRef={s.videoRef}
          maxEnd={probe.durationSec}
        />
      )}
    </>
  );
}

function StylePanel({ session: s }: { session: ReelSession }) {
  return (
    <>
      <DataFlow testId="flow-style">Your style and brand kit are saved in this browser only.</DataFlow>
      {!s.realWords && <p className="text-sm text-muted">Make captions to see the style on your video.</p>}
      <StylePicker session={s} />
      <BrandKitPanel kit={s.kit} style={s.baseStyle} onChange={s.changeKit} saveFailed={s.kitSaveFailed} />
      <FontError session={s} />
    </>
  );
}

function ExportPanel({ session: s }: { session: ReelSession }) {
  return (
    <>
      <DataFlow testId="flow-5">
        The video is made in this browser and kept in its private storage until you download it. No watermark.
      </DataFlow>
      <ExportPresetPicker session={s} />
      {s.srtUrl && (
        <a data-testid="srt-link" href={s.srtUrl} download={s.fileBaseName + ".srt"} className="w-fit text-sm underline">
          Download captions (SRT)
        </a>
      )}
      {/* Once exported, downloading is the main action. */}
      <RenderStatus session={s} downloadClassName={primary + " w-fit"} />
    </>
  );
}

"use client";

import { useState } from "react";
import { Timeline } from "@/components/editor/Timeline";
import { SelectionProperties, AddCaption } from "@/components/editor/SelectionProperties";
import { AnimationPanel } from "@/components/editor/AnimationPanel";
import { AIEditorPanel } from "@/components/editor/AIEditorPanel";
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

import { CompositionPanel } from "@/components/editor/CompositionPanel";
import { TypographyPanel } from "@/components/editor/TypographyPanel";
import { SilencePanel } from "@/components/editor/SilencePanel";
import { OverlayPanel } from "@/components/editor/OverlayPanel";

type StepId = "video" | "captions" | "style" | "text" | "animations" | "silence" | "ai" | "export";
const STEPS: { id: StepId; title: string }[] = [
  { id: "video", title: "Video" }, { id: "captions", title: "Captions" }, { id: "text", title: "Text & overlays" },
  { id: "style", title: "Subtitle styles" }, { id: "animations", title: "Animations" }, { id: "silence", title: "Silence removal" }, { id: "ai", title: "AI editor" }, { id: "export", title: "Export" },
];
const primary = "inline-flex min-h-10 items-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-40";
export function StudioClient() {
  const s = useReelSession({ placeholders: false });
  const [step, setStep] = useState<StepId>("video");
  const index = STEPS.findIndex((x) => x.id === step);
  const go = (id: StepId) => { if (id === "video" || s.ready) setStep(id); };
  const next = step === "video" ? "captions" : step === "captions" ? "style" : step === "style" ? "export" : null;
  const prev = step === "export" ? "style" : step === "style" ? "captions" : step === "captions" ? "video" : null;
  return <div className="flex h-dvh flex-col overflow-hidden bg-surface text-foreground">
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-panel px-3">
      <span className="font-semibold">Reel Finisher <span className="hidden text-xs font-normal text-muted sm:inline">/ Editing studio</span></span>
      <div className="flex gap-2"><button className={btnSecondary} disabled={!s.editing.canUndo} onClick={s.editing.undo}>Undo settings</button><button className={btnSecondary} disabled={!s.editing.canRedo} onClick={s.editing.redo}>Redo</button><button className={primary} disabled={!s.ready} onClick={() => go("export")}>Export</button></div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[10rem_minmax(0,1fr)_22rem]">
      <nav aria-label="Editor tools" className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel p-2 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0">
        {STEPS.map((tool) => <button key={tool.id} data-testid={"nav-" + tool.id} aria-current={step === tool.id ? "step" : undefined} aria-disabled={tool.id !== "video" && !s.ready} onClick={() => go(tool.id)} className={"min-h-10 shrink-0 rounded-md px-3 py-2 text-left text-sm lg:shrink " + (step === tool.id ? "bg-foreground text-background" : "hover:bg-surface")}>{tool.title}<span className="hidden text-xs opacity-65 lg:block">{tool.id === "video" && s.probe?.video ? `${s.probe.video.width}×${s.probe.video.height}` : tool.id === "captions" ? `${s.realWords?.length ?? 0} words` : tool.id === "style" ? s.style.name : tool.id === "export" && s.render.status === "done" ? "Ready to download" : ""}</span></button>)}
        <p className="mt-auto hidden p-3 text-xs text-muted lg:block">Local video editing. Your original stays on this device.</p>
      </nav>
      <section aria-label="Preview" className="flex shrink-0 items-center justify-center overflow-hidden bg-stage p-3 lg:min-h-0">
        {s.videoUrl && s.previewPlan ? <div className="flex w-full flex-col items-center gap-2"><PreviewError session={s} /><Preview src={s.videoUrl} lines={s.lines} style={s.style} fontReady={s.fontReady} videoRef={s.videoRef} onError={() => s.setPreviewFailed(true)} frame={s.previewPlan} guides={s.showGuides} editor={s} heightClassName="[--preview-h:24dvh] lg:[--preview-h:calc(100dvh-26rem)]" /><label className="text-xs text-white"><input type="checkbox" checked={s.showGuides} onChange={(e) => s.setShowGuides(e.target.checked)} /> Safe area & snapping guides</label>{s.previewSuggestions && <p className="text-xs text-amber-200">Previewing proposed cuts. Export uses applied edits.</p>}</div> : <DropZone session={s} />}
      </section>
      <section aria-labelledby="panel-title" className="flex min-h-0 flex-1 flex-col border-line bg-panel lg:border-l">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <h1 id="panel-title" data-testid="mobile-step-title" className="text-lg font-semibold">{STEPS[index].title}</h1>
          {s.editProblem && <p role="alert" className="rounded border border-red-400 p-2 text-sm">{s.editProblem} <button className="underline" onClick={() => s.setEditProblem(null)}>Dismiss</button></p>}
          <SelectionProperties session={s} />
          {step === "video" && <VideoPanel session={s} onContinue={() => go("captions")} />}
          {step === "captions" && <><AddCaption session={s} /><p className="text-xs text-muted">Add and edit manual captions without an API key. Select a caption below or in the timeline for text, timing and individual styles.</p><div className="flex max-h-40 flex-col gap-1 overflow-y-auto">{s.captionSegments.map((caption) => <button className="min-h-10 rounded border border-line px-2 text-left text-sm" key={caption.id} onClick={() => { s.setSelection({ kind: "caption", id: caption.id }); if (s.videoRef.current) s.videoRef.current.currentTime = caption.start; }}>{caption.start.toFixed(2)}s · {caption.words.map((word) => word.text).join(" ")}</button>)}</div><details><summary className="min-h-10 cursor-pointer text-sm font-medium">AI transcription & word editor</summary><div className="mt-3 flex flex-col gap-3"><CaptionsPanel session={s} /></div></details></>}
          {step === "style" && <StylePanel session={s} />}
          {step === "text" && <OverlayPanel session={s} />}
          {step === "animations" && <AnimationPanel expanded session={s} />}
          {step === "silence" && <SilencePanel session={s} />}
          {step === "ai" && <AIEditorPanel session={s} onSilence={() => go("silence")} />}
          {step === "export" && <ExportPanel session={s} />}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line p-2">
          <button data-testid="back-button" className={btnSecondary + (prev ? "" : " invisible")} onClick={() => prev && go(prev)}>Back</button>
          {step === "export" ? <ExportAction session={s} /> : next && <button data-testid="next-button" className={btnSecondary} disabled={!s.ready} onClick={() => go(next)}>Next: {STEPS.find((x) => x.id === next)?.title}</button>}
        </div>
      </section>
    </div>
    <Timeline session={s} />
  </div>;
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
      disabled={!s.fontReady || s.planEncodable !== true}
      onClick={() => void s.startRender()}
      className={render.status === "done" ? btnSecondary + " disabled:opacity-40" : primary}
    >
      {render.status === "done" ? "Export again" : "Export MP4"}
    </button>
  );
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
        onChange={(e) => { void s.pickFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
      />
      <span className="text-lg font-semibold text-white">Choose a video</span>
      <span className="text-sm text-zinc-400">
        or drop it here. A vertical talking-head clip, up to 10 minutes. It stays on this device.
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
      <CompositionPanel session={s} />
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
        onChange={(e) => { void s.pickFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
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
      {transcript.status === "done" ? (
        // Shown in full before the first upload; afterwards one tap away, so the word editor fits on a phone.
        <details className="text-sm">
          <summary className="cursor-pointer">
            <span className="font-medium text-amber-800 dark:text-amber-300">Leaves this device: </span>
            what was sent to make these captions
          </summary>
          <div className="mt-2">
            <TranscribeDisclosure audioSize={audio.status === "done" ? audio.blob.size : null} config={s.uploadConfig} />
          </div>
        </details>
      ) : (
        <TranscribeDisclosure audioSize={audio.status === "done" ? audio.blob.size : null} config={s.uploadConfig} />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <LanguageSelect value={s.language} onChange={s.setLanguage} />
        <button
          type="button"
          data-testid="make-captions"
          disabled={!s.ready || !probe?.audio || working || !s.online || !s.humanReady}
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
      {s.realWords && s.realWords.length > 0 && probe && !s.editing.settings.captions && (
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
      <TypographyPanel session={s} />
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

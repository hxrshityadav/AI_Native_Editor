"use client";

import { BrandKitPanel } from "@/components/editor/BrandKitPanel";
import { HumanCheck } from "@/components/editor/HumanCheck";
import { SilenceTool } from "@/components/editor/SilenceTool";
import {
  btn,
  btnSecondary,
  DataFlow,
  FontError,
  formatBytes,
  Preview,
  PreviewError,
  ProblemBox,
  Progress,
  SaveStatus,
  Status,
  StylePicker,
  TranscribeDisclosure,
  ExportPresetPicker,
  LanguageSelect,
  OfflineNote,
  RenderStatus,
} from "@/components/editor/parts";
import { RunReportPanel } from "@/components/editor/RunReportPanel";
import { TranscriptEditor } from "@/components/editor/TranscriptEditor";
import { useReelSession } from "@/components/editor/useReelSession";

/** The internal render lab: every workflow step exposed separately, for testing and device runs. */
export function LabClient() {
  const s = useReelSession({ placeholders: true });
  const { check, audio, transcript, render, probe, ready } = s;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Render lab</h1>
        <p className="text-sm text-zinc-500">
          Internal proof-of-concept page. Your video is processed in this browser tab and is never uploaded.
        </p>
      </header>

      <Step
        n={1}
        title="Pick a video"
        flow={<DataFlow testId="flow-1">The video is read in this browser to check its format. It is never uploaded.</DataFlow>}
      >
        <input
          data-testid="file-input"
          type="file"
          accept="video/*"
          onChange={(e) => { void s.pickFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
          className="block w-full text-sm"
        />
        {check.status === "checking" && <Status testId="check-status">Checking file and device…</Status>}
        {check.status === "rejected" && <ProblemBox testId="check-error" problem={check.problem} />}
        {check.status === "ready" && (
          <div data-testid="check-ok" className="flex flex-col gap-2 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-zinc-500">Duration</dt>
              <dd>{check.probe.durationSec.toFixed(2)} s</dd>
              <dt className="text-zinc-500">Video</dt>
              <dd>
                {check.probe.video?.codec} {check.probe.video?.width}×{check.probe.video?.height}
                {check.probe.video?.rotation ? ` (rotated ${check.probe.video.rotation}°)` : ""}
              </dd>
              <dt className="text-zinc-500">Audio</dt>
              <dd>
                {check.probe.audio?.codec} {check.probe.audio?.channels} ch {check.probe.audio?.sampleRate} Hz
              </dd>
              <dt className="text-zinc-500">Size</dt>
              <dd>{formatBytes(check.probe.fileSizeBytes)}</dd>
              <dt className="text-zinc-500">Device</dt>
              <dd>
                H.264 encode ✓ (from {check.device.encodeSize.width}×{check.device.encodeSize.height}) · Opus encode ✓
                {check.device.deviceMemoryGb !== null ? ` · ${check.device.deviceMemoryGb} GB RAM` : ""}
                {check.device.cpuCores !== null ? ` · ${check.device.cpuCores} cores` : ""}
              </dd>
            </dl>
            {[...check.warnings.map((w) => `${w.reason} ${w.action}`), ...check.device.warnings].map((w) => (
              <p key={w} className="rounded bg-amber-100 px-3 py-2 text-amber-900">
                {w}
              </p>
            ))}
          </div>
        )}
      </Step>

      <Step
        n={2}
        title="Extract speech audio"
        flow={
          <DataFlow testId="flow-2">
            The speech audio is made in this browser. Nothing is sent until you press Transcribe.
          </DataFlow>
        }
      >
        <button data-testid="extract-button" disabled={!ready || audio.status === "running"} onClick={() => void s.extract()} className={btn}>
          Extract audio
        </button>
        {audio.status === "running" && <Progress testId="extract-progress" label="Extracting" value={audio.progress} />}
        {audio.status === "error" && <ProblemBox testId="extract-error" problem={audio.problem} />}
        {audio.status === "done" && (
          <div data-testid="extract-done" className="flex flex-col gap-2 text-sm">
            <p>
              Mono Opus, <span data-testid="audio-size">{formatBytes(audio.blob.size)}</span>
            </p>
            <audio controls src={audio.url} className="w-full" />
          </div>
        )}
      </Step>

      <Step n={3} title="Transcribe" flow={<TranscribeDisclosure audioSize={audio.status === "done" ? audio.blob.size : null} config={s.uploadConfig} />}>
        <div className="flex flex-wrap items-center gap-3">
          <LanguageSelect value={s.language} onChange={s.setLanguage} />
          <button
            data-testid="transcribe-button"
            disabled={audio.status !== "done" || transcript.status === "running" || !s.online || !s.humanReady}
            onClick={() => void s.transcribe()}
            className={btn}
          >
            Transcribe
          </button>
        </div>
        {audio.status !== "done" && <p className="text-sm text-zinc-500">Extract the audio first.</p>}
        <HumanCheck session={s} />
        {audio.status === "done" && s.edits && (
          <p data-testid="retranscribe-warning" className="text-sm text-amber-800 dark:text-amber-300">
            Transcribing again replaces your caption edits.
          </p>
        )}
        <OfflineNote online={s.online} />
        {transcript.status === "running" && (
          <div className="flex items-center gap-3">
            <Status testId="transcribe-status">Uploading audio and transcribing…</Status>
            <button type="button" className={btnSecondary} onClick={s.cancelTranscribe}>
              Cancel
            </button>
          </div>
        )}
        {transcript.status === "error" && <ProblemBox testId="transcribe-error" problem={transcript.problem} />}
        {transcript.status === "done" && (
          <p data-testid="transcribe-done" className="text-sm">
            {transcript.words.length > 0
              ? `${transcript.words.length} words from ${transcript.providerName}. Review them in step 4.`
              : `${transcript.providerName} found no speech. Check the clip has audible speech, or pick the language manually and try again.`}
          </p>
        )}
        {transcript.status === "done" && transcript.warning && (
          <div data-testid="transcribe-warning" role="status" className="rounded bg-amber-100 px-3 py-2 text-sm text-amber-900">
            <p className="font-medium">{transcript.warning.message}</p>
            <p>{transcript.warning.action}</p>
          </div>
        )}
      </Step>

      <Step n={4} title="Remove silence" flow={null}>
        {ready ? <SilenceTool session={s} /> : <p className="text-sm text-zinc-500">Pick a video first.</p>}
      </Step>

      <Step
        n={5}
        title="Edit captions and preview"
        flow={<DataFlow testId="flow-4">Your transcript, edits, style and brand kit are saved in this browser only.</DataFlow>}
      >
        <p data-testid="caption-source" className="text-sm">
          {s.realWords
            ? `Captions from the transcript${s.edits ? ", with your edits" : ""} (${s.lines.length} lines).`
            : "Captions are placeholder test words. They do not match the speech. Transcribe to use real captions."}
        </p>
        <SaveStatus session={s} />
        <StylePicker session={s} />
        <BrandKitPanel kit={s.kit} style={s.baseStyle} onChange={s.changeKit} saveFailed={s.kitSaveFailed} />
        <FontError session={s} />
        {s.videoUrl && probe && s.plan && (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <PreviewError session={s} />
              <Preview
                src={s.videoUrl}
                lines={s.previewLines}
                timeMap={s.previewMap}
                style={s.style}
                fontReady={s.fontReady}
                videoRef={s.videoRef}
                onError={() => s.setPreviewFailed(true)}
                frame={s.plan}
              />
            </div>
            <TranscriptEditor
              words={s.words}
              onChange={s.editWords}
              onUndo={s.undoEdit}
              canUndo={s.canUndo}
              videoRef={s.videoRef}
              maxEnd={probe.durationSec}
            />
          </div>
        )}
      </Step>

      <Step
        n={6}
        title="Export"
        flow={
          <DataFlow testId="flow-5">
            The video is made in this browser and kept in its private storage until you download it. No watermark.
          </DataFlow>
        }
      >
        <ExportPresetPicker session={s} />
        <div className="flex flex-wrap gap-3">
          <button
            data-testid="render-button"
            disabled={!ready || !s.fontReady || render.status === "running" || !!s.exportBlocked}
            onClick={() => void s.startRender()}
            className={btn}
          >
            Render MP4
          </button>
          {render.status === "running" && (
            <button onClick={s.cancelRender} className={btnSecondary}>
              Cancel
            </button>
          )}
          {ready && s.srtUrl && (
            <a data-testid="srt-link" href={s.srtUrl} download={s.fileBaseName + ".srt"} className={btnSecondary}>
              Download SRT
            </a>
          )}
        </div>
        <RenderStatus session={s} />
      </Step>
      {s.runReport && <RunReportPanel report={s.runReport} />}
    </main>
  );
}

function Step({ n, title, flow, children }: { n: number; title: string; flow: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="font-medium">
        {n}. {title}
      </h2>
      {flow}
      {children}
    </section>
  );
}

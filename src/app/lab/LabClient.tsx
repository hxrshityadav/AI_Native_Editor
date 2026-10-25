"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CAPTION_STYLES,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_GROUP_OPTIONS,
  drawCaption,
  getCaptionStyle,
  groupWords,
  loadCaptionFont,
  type CaptionFontId,
  type CaptionStyle,
  lineAt,
  makeTestWords,
  toSrt,
  type Word,
} from "@/lib/captions";
import { checkDevice, type DeviceReport } from "@/lib/media/capabilities";
import { extractSpeechAudio } from "@/lib/media/extractAudio";
import { probeFile } from "@/lib/media/probe";
import { RenderCanceledError, renderInWorker, type RenderHandle, type RenderStorage } from "@/lib/media/renderInWorker";
import type { Issue, ProbeResult } from "@/lib/media/types";
import { issue, validateFileBasics, validateProbe } from "@/lib/media/validate";
import { requestTranscription, TRANSCRIPTION_DISCLOSURE } from "@/lib/transcription/client";
import type { CaptionLanguage, TranscribeResponse } from "@/lib/transcription/types";
import { applyBrandKit, loadBrandKit, saveBrandKit, type BrandKit } from "@/lib/brandKit";
import { deleteDraft, fingerprintFile, loadDraft, saveDraft } from "@/lib/drafts";
import { BrandKitPanel } from "./BrandKitPanel";
import { TranscriptEditor } from "./TranscriptEditor";

type Problem = { message: string; action: string };

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "rejected"; problem: Problem }
  | { status: "ready"; probe: ProbeResult; warnings: Issue[]; device: DeviceReport };

type AudioState =
  | { status: "idle" }
  | { status: "running"; progress: number }
  | { status: "done"; blob: Blob; url: string }
  | { status: "error"; problem: Problem };

type TranscriptState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; words: Word[]; providerName: string; warning?: TranscribeResponse["warning"] }
  | { status: "error"; problem: Problem };

/** User edits on top of the transcript (or placeholder words), with undo history. */
type Edits = { words: Word[]; history: Word[][] };

type SaveState = "idle" | "saving" | "saved" | "error";

type RenderState =
  | { status: "idle" }
  | { status: "running"; progress: number }
  | { status: "done"; url: string; sizeBytes: number; ms: number; storage: RenderStorage }
  | { status: "error"; problem: Problem };

export function LabClient() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [check, setCheck] = useState<CheckState>({ status: "idle" });
  const [audio, setAudio] = useState<AudioState>({ status: "idle" });
  const [language, setLanguage] = useState<CaptionLanguage>("hinglish");
  const [transcript, setTranscript] = useState<TranscriptState>({ status: "idle" });
  const [render, setRender] = useState<RenderState>({ status: "idle" });
  const [edits, setEdits] = useState<Edits | null>(null);
  /** Content hash of the current file, used as the draft key. Null when autosave is unavailable. */
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  /** Increments on every pick, so results from an older pick are ignored. */
  const pickId = useRef(0);
  const [styleId, setStyleId] = useState(DEFAULT_CAPTION_STYLE.id);
  const baseStyle = getCaptionStyle(styleId);
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [kitSaveFailed, setKitSaveFailed] = useState(false);
  // The style everything uses: the picked preset with the brand kit on top.
  const style = useMemo(() => (kit?.enabled ? applyBrandKit(baseStyle, kit) : baseStyle), [baseStyle, kit]);

  useEffect(() => {
    loadBrandKit().then(
      (saved) => saved && setKit(saved),
      () => setKitSaveFailed(true),
    );
  }, []);

  function changeKit(next: BrandKit) {
    setKit(next);
    // Saved immediately: a kit is a few bytes, and losing a brand setup is worse than an extra write.
    saveBrandKit(next).then(
      () => setKitSaveFailed(false),
      () => setKitSaveFailed(true),
    );
  }
  const [fontLoad, setFontLoad] = useState<{ font: CaptionFontId; ok: boolean } | null>(null);
  const [fontRetry, setFontRetry] = useState(0);
  const fontReady = fontLoad?.font === style.font && fontLoad.ok;
  const fontFailed = fontLoad?.font === style.font && !fontLoad.ok;

  // Load the selected style's bundled font for the preview (the render worker loads its own copy).
  useEffect(() => {
    let current = true;
    loadCaptionFont(style.font, document.fonts).then(
      () => current && setFontLoad({ font: style.font, ok: true }),
      () => current && setFontLoad({ font: style.font, ok: false }),
    );
    return () => {
      current = false;
    };
  }, [style.font, fontRetry]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const renderHandle = useRef<RenderHandle | null>(null);
  const urls = useRef(new Set<string>());

  const makeUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  };
  const revokeAll = () => {
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
  };
  useEffect(() => revokeAll, []);

  const probe = check.status === "ready" ? check.probe : null;
  const realWords = transcript.status === "done" ? transcript.words : null;
  const sourceWords = useMemo(
    () => realWords ?? (probe ? makeTestWords(probe.durationSec) : []),
    [realWords, probe],
  );
  const words = edits?.words ?? sourceWords;

  function editWords(next: Word[]) {
    setEdits({ words: next, history: [...(edits?.history ?? []), words].slice(-100) });
  }
  function undoEdit() {
    if (!edits?.history.length) return;
    const history = edits.history.slice(0, -1);
    setEdits({ words: edits.history[edits.history.length - 1], history });
  }
  const lines = useMemo(() => groupWords(words, { ...DEFAULT_GROUP_OPTIONS, ...style.group }), [words, style]);

  // Autosave the real transcript and edits, debounced so a burst of nudges is one write.
  const savedTranscript = transcript.status === "done" ? transcript : null;
  useEffect(() => {
    if (!fingerprint || !savedTranscript) return;
    const timer = setTimeout(() => {
      setSaveState("saving");
      saveDraft({
        version: 1,
        fingerprint,
        savedAt: Date.now(),
        providerName: savedTranscript.providerName,
        transcript: savedTranscript.words,
        edited: edits?.words ?? null,
        styleId,
      }).then(
        () => setSaveState("saved"),
        () => setSaveState("error"),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [fingerprint, savedTranscript, edits, styleId]);
  const srtUrl = useMemo(
    () => (lines.length ? URL.createObjectURL(new Blob([toSrt(lines)], { type: "application/x-subrip" })) : null),
    [lines],
  );
  useEffect(() => () => void (srtUrl && URL.revokeObjectURL(srtUrl)), [srtUrl]);

  async function onPick(picked: File | null) {
    const id = ++pickId.current;
    const stale = () => id !== pickId.current;
    setFingerprint(null);
    setSaveState("idle");
    setRestoredAt(null);
    renderHandle.current?.cancel();
    revokeAll();
    setFile(picked);
    setAudio({ status: "idle" });
    setTranscript({ status: "idle" });
    setEdits(null);
    setRender({ status: "idle" });
    setVideoUrl(null);
    if (!picked) return setCheck({ status: "idle" });

    const basics = validateFileBasics(picked);
    if (!basics.ok) return setCheck({ status: "rejected", problem: toProblem(basics.error) });

    setCheck({ status: "checking" });
    let probed: ProbeResult;
    try {
      probed = await probeFile(picked);
    } catch {
      if (stale()) return;
      return setCheck({ status: "rejected", problem: toProblem(issue("UNSUPPORTED_FORMAT")) });
    }
    if (stale()) return;
    const result = validateProbe(probed);
    if (!result.ok) return setCheck({ status: "rejected", problem: toProblem(result.error) });

    const device = await checkDevice({ width: probed.video!.width, height: probed.video!.height });
    if (stale()) return;
    if (device.blockers.length) {
      return setCheck({
        status: "rejected",
        problem: { message: "This device can't process the video locally.", action: device.blockers.join(" ") },
      });
    }
    setVideoUrl(makeUrl(picked));
    setCheck({ status: "ready", probe: probed, warnings: result.warnings, device });

    try {
      const fp = await fingerprintFile(picked);
      const draft = await loadDraft(fp);
      if (stale()) return;
      setFingerprint(fp);
      if (draft) {
        setTranscript({ status: "done", words: draft.transcript, providerName: draft.providerName });
        setEdits(draft.edited ? { words: draft.edited, history: [] } : null);
        setRestoredAt(draft.savedAt);
        setStyleId(getCaptionStyle(draft.styleId).id);
        setSaveState("saved");
      }
    } catch {
      if (!stale()) setSaveState("error");
    }
  }

  async function onStartOver() {
    if (!fingerprint || !window.confirm("Delete the saved transcript and your edits for this video?")) return;
    try {
      await deleteDraft(fingerprint);
    } catch {
      // The in-memory reset below still applies; a leftover draft is overwritten on the next save.
    }
    setTranscript({ status: "idle" });
    setEdits(null);
    setRestoredAt(null);
    setSaveState("idle");
  }

  async function onExtract() {
    if (!file) return;
    // Same file, same audio: keep the transcript and the user's edits.
    setAudio({ status: "running", progress: 0 });
    try {
      const blob = await extractSpeechAudio(file, (p) => setAudio({ status: "running", progress: p }));
      setAudio({ status: "done", blob, url: makeUrl(blob) });
    } catch (err) {
      setAudio({
        status: "error",
        problem: {
          message: `Couldn't extract the speech audio on this device (${err instanceof Error ? err.message : "unknown error"}).`,
          action: "Try Chrome or Edge, or re-export the video with AAC audio.",
        },
      });
    }
  }

  async function onTranscribe() {
    if (audio.status !== "done") return;
    setTranscript({ status: "running" });
    const result = await requestTranscription(audio.blob, language);
    if (result.ok) {
      setTranscript({ status: "done", words: result.words, providerName: result.providerName, warning: result.warning });
      setEdits(null);
    } else {
      setTranscript({ status: "error", problem: { message: result.message, action: result.action } });
    }
  }

  async function onRender() {
    if (!file) return;
    setRender({ status: "running", progress: 0 });
    const started = performance.now();
    const handle = renderInWorker({ file, lines, style }, (p) =>
      setRender({ status: "running", progress: p }),
    );
    renderHandle.current = handle;
    try {
      const { blob, storage } = await handle.result;
      const ms = performance.now() - started;
      setRender({ status: "done", url: makeUrl(blob), sizeBytes: blob.size, ms, storage });
    } catch (err) {
      const canceled = err instanceof RenderCanceledError;
      setRender(
        canceled
          ? { status: "idle" }
          : {
              status: "error",
              problem: {
                message: err instanceof Error ? err.message : "Render failed.",
                action: "Close other tabs and apps and try again. If it fails again, try a 1080p version.",
              },
            },
      );
    } finally {
      renderHandle.current = null;
    }
  }

  const ready = check.status === "ready";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Render lab</h1>
        <p className="text-sm text-zinc-500">
          Internal proof-of-concept page. Your video is processed in this browser tab and is never uploaded.
        </p>
      </header>

      <Step n={1} title="Pick a video">
        <input
          data-testid="file-input"
          type="file"
          accept="video/*"
          onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
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
                H.264 encode ✓ · Opus encode ✓
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

      <Step n={2} title="Extract speech audio (on this device)">
        <button data-testid="extract-button" disabled={!ready || audio.status === "running"} onClick={() => void onExtract()} className={btn}>
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

      <Step n={3} title="Transcribe">
        <p data-testid="transcribe-disclosure" className="text-sm text-zinc-600 dark:text-zinc-400">
          Sends only the extracted speech audio
          {audio.status === "done" ? ` (${formatBytes(audio.blob.size)})` : ""}, never the video, to our server, which
          forwards it to {TRANSCRIPTION_DISCLOSURE.providerName} for transcription. For Hinglish, the transcribed words
          (text only) also go to {TRANSCRIPTION_DISCLOSURE.providerName} to be written in Roman script. Our servers
          don&apos;t store the audio or the transcript.{" "}
          <a className="underline" href={TRANSCRIPTION_DISCLOSURE.privacyUrl} target="_blank" rel="noreferrer">
            {TRANSCRIPTION_DISCLOSURE.providerName}&apos;s privacy policy
          </a>{" "}
          applies to their processing.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            Language
            <select
              data-testid="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as CaptionLanguage)}
              className="rounded border px-2 py-1"
            >
              <option value="hinglish">Hinglish (Roman script)</option>
              <option value="hi">Hindi (Devanagari script)</option>
              <option value="en">English</option>
            </select>
          </label>
          <button
            data-testid="transcribe-button"
            disabled={audio.status !== "done" || transcript.status === "running"}
            onClick={() => void onTranscribe()}
            className={btn}
          >
            Transcribe
          </button>
        </div>
        {audio.status !== "done" && <p className="text-sm text-zinc-500">Extract the audio first.</p>}
        {audio.status === "done" && edits && (
          <p data-testid="retranscribe-warning" className="text-sm text-amber-800 dark:text-amber-300">
            Transcribing again replaces your caption edits.
          </p>
        )}
        {transcript.status === "running" && <Status testId="transcribe-status">Uploading audio and transcribing…</Status>}
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

      <Step n={4} title="Edit captions and preview">
        <p data-testid="caption-source" className="text-sm">
          {realWords
            ? `Captions from the transcript${edits ? ", with your edits" : ""} (${lines.length} lines).`
            : "Captions are placeholder test words. They do not match the speech. Transcribe to use real captions."}
        </p>
        {realWords && (
          <div data-testid="save-status" role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {saveState === "error" ? (
              <span className="text-red-800 dark:text-red-300">
                Couldn&apos;t save on this device (private browsing or full storage). Your edits will be lost if you
                reload or close this tab.
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
              <button type="button" data-testid="start-over" onClick={() => void onStartOver()} className="underline">
                Start over
              </button>
            )}
          </div>
        )}
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
          <BrandKitPanel kit={kit} style={baseStyle} onChange={changeKit} saveFailed={kitSaveFailed} />
          {fontFailed && (
            <div data-testid="font-error" role="alert" className="rounded bg-red-100 px-3 py-2 text-sm text-red-900">
              <p className="font-medium">Couldn&apos;t load the font for this style, so the preview and export are paused.</p>
              <p>
                Check your connection, then{" "}
                <button type="button" className="underline" onClick={() => setFontRetry((n) => n + 1)}>
                  try again
                </button>
                .
              </p>
            </div>
          )}
        </fieldset>
        {videoUrl && probe && (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)]">
            <Preview src={videoUrl} lines={lines} style={style} fontReady={fontReady} videoRef={videoRef} />
            <TranscriptEditor
              words={words}
              onChange={editWords}
              onUndo={undoEdit}
              canUndo={!!edits?.history.length}
              videoRef={videoRef}
              maxEnd={probe.durationSec}
            />
          </div>
        )}
      </Step>

      <Step n={5} title="Export">
        <div className="flex flex-wrap gap-3">
          <button data-testid="render-button" disabled={!ready || !fontReady || render.status === "running"} onClick={() => void onRender()} className={btn}>
            Render MP4
          </button>
          {render.status === "running" && (
            <button onClick={() => renderHandle.current?.cancel()} className={btnSecondary}>
              Cancel
            </button>
          )}
          {ready && srtUrl && (
            <a data-testid="srt-link" href={srtUrl} download={baseName(file) + ".srt"} className={btnSecondary}>
              Download SRT
            </a>
          )}
        </div>
        {render.status === "running" && <Progress testId="render-progress" label="Rendering" value={render.progress} />}
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
            <a data-testid="mp4-link" href={render.url} download={baseName(file) + "-captioned.mp4"} className={btnSecondary + " w-fit"}>
              Download MP4
            </a>
          </div>
        )}
      </Step>
    </main>
  );
}

function Preview({
  src,
  lines,
  style,
  fontReady,
  videoRef,
}: {
  src: string;
  lines: ReturnType<typeof groupWords>;
  style: CaptionStyle;
  /** Until the bundled font loads, captions are not drawn rather than drawn in a misleading fallback font. */
  fontReady: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (video && canvas && ctx && video.videoWidth) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const t = video.currentTime;
        const line = lineAt(lines, t);
        if (line && fontReady) drawCaption(ctx, line, t, style, canvas.width, canvas.height);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, style, fontReady, videoRef]);

  return (
    <div className="relative mx-auto w-fit max-w-full">
      <video ref={videoRef} src={src} controls playsInline className="block max-h-[70vh] max-w-full" />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

const btn =
  "rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:cursor-not-allowed disabled:opacity-40";
const btnSecondary = "rounded-md border px-4 py-2 text-sm";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="font-medium">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

function Status({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <p data-testid={testId} role="status" className="text-sm text-zinc-600">
      {children}
    </p>
  );
}

function Progress({ testId, label, value }: { testId: string; label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div data-testid={testId} role="status" className="flex items-center gap-3 text-sm">
      <progress max={100} value={pct} className="w-48" aria-label={label} />
      <span>
        {label} {pct}%
      </span>
    </div>
  );
}

function ProblemBox({ testId, problem }: { testId: string; problem: Problem }) {
  return (
    <div data-testid={testId} role="alert" className="rounded bg-red-100 px-3 py-2 text-sm text-red-900">
      <p className="font-medium">{problem.message}</p>
      <p>{problem.action}</p>
    </div>
  );
}

function toProblem(i: Issue): Problem {
  return { message: i.reason, action: i.action };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function baseName(file: File | null): string {
  return file?.name.replace(/\.[^.]+$/, "") || "video";
}

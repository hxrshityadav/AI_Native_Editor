"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_CAPTION_STYLE,
  drawCaption,
  groupWords,
  lineAt,
  makeTestWords,
  toSrt,
  type Word,
} from "@/lib/captions";
import { checkDevice, type DeviceReport } from "@/lib/media/capabilities";
import { extractSpeechAudio } from "@/lib/media/extractAudio";
import { probeFile } from "@/lib/media/probe";
import { renderCaptionedMp4, type RenderHandle } from "@/lib/media/render";
import type { Issue, ProbeResult } from "@/lib/media/types";
import { issue, validateFileBasics, validateProbe } from "@/lib/media/validate";
import { requestTranscription, TRANSCRIPTION_DISCLOSURE } from "@/lib/transcription/client";
import type { TranscriptionLanguage } from "@/lib/transcription/types";

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
  | { status: "done"; words: Word[]; providerName: string }
  | { status: "error"; problem: Problem };

type RenderState =
  | { status: "idle" }
  | { status: "running"; progress: number }
  | { status: "done"; url: string; sizeBytes: number; ms: number }
  | { status: "error"; problem: Problem };

export function LabClient() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [check, setCheck] = useState<CheckState>({ status: "idle" });
  const [audio, setAudio] = useState<AudioState>({ status: "idle" });
  const [language, setLanguage] = useState<TranscriptionLanguage>("auto");
  const [transcript, setTranscript] = useState<TranscriptState>({ status: "idle" });
  const [render, setRender] = useState<RenderState>({ status: "idle" });
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
  const words = useMemo(
    () => realWords ?? (probe ? makeTestWords(probe.durationSec) : []),
    [realWords, probe],
  );
  const lines = useMemo(() => groupWords(words), [words]);
  const srtUrl = useMemo(
    () => (lines.length ? URL.createObjectURL(new Blob([toSrt(lines)], { type: "application/x-subrip" })) : null),
    [lines],
  );
  useEffect(() => () => void (srtUrl && URL.revokeObjectURL(srtUrl)), [srtUrl]);

  async function onPick(picked: File | null) {
    await renderHandle.current?.cancel();
    revokeAll();
    setFile(picked);
    setAudio({ status: "idle" });
    setTranscript({ status: "idle" });
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
      return setCheck({ status: "rejected", problem: toProblem(issue("UNSUPPORTED_FORMAT")) });
    }
    const result = validateProbe(probed);
    if (!result.ok) return setCheck({ status: "rejected", problem: toProblem(result.error) });

    const device = await checkDevice({ width: probed.video!.width, height: probed.video!.height });
    if (device.blockers.length) {
      return setCheck({
        status: "rejected",
        problem: { message: "This device can't process the video locally.", action: device.blockers.join(" ") },
      });
    }
    setVideoUrl(makeUrl(picked));
    setCheck({ status: "ready", probe: probed, warnings: result.warnings, device });
  }

  async function onExtract() {
    if (!file) return;
    setAudio({ status: "running", progress: 0 });
    setTranscript({ status: "idle" });
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
      setTranscript({ status: "done", words: result.words, providerName: result.providerName });
    } else {
      setTranscript({ status: "error", problem: { message: result.message, action: result.action } });
    }
  }

  async function onRender() {
    if (!file) return;
    setRender({ status: "running", progress: 0 });
    const started = performance.now();
    const handle = renderCaptionedMp4(file, lines, DEFAULT_CAPTION_STYLE, (p) =>
      setRender({ status: "running", progress: p }),
    );
    renderHandle.current = handle;
    try {
      const blob = await handle.result;
      setRender({ status: "done", url: makeUrl(blob), sizeBytes: blob.size, ms: performance.now() - started });
    } catch (err) {
      const canceled = err instanceof Error && /cancel/i.test(err.name + err.message);
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
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
          forwards it to {TRANSCRIPTION_DISCLOSURE.providerName} for transcription. We don&apos;t store the audio or
          the transcript.{" "}
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
              onChange={(e) => setLanguage(e.target.value as TranscriptionLanguage)}
              className="rounded border px-2 py-1"
            >
              <option value="auto">Auto-detect</option>
              <option value="hi">Hindi (Devanagari script)</option>
              <option value="en">English (Latin script)</option>
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
        {transcript.status === "running" && <Status testId="transcribe-status">Uploading audio and transcribing…</Status>}
        {transcript.status === "error" && <ProblemBox testId="transcribe-error" problem={transcript.problem} />}
        {transcript.status === "done" && (
          <div data-testid="transcribe-done" className="flex flex-col gap-1 text-sm">
            <p>
              {transcript.words.length} words from {transcript.providerName}.
            </p>
            <p data-testid="transcript-text" className="rounded bg-zinc-100 p-3 dark:bg-zinc-900">
              {transcript.words.map((w) => w.text).join(" ") || "(no speech detected)"}
            </p>
          </div>
        )}
      </Step>

      <Step n={4} title="Preview">
        <p data-testid="caption-source" className="text-sm">
          {realWords
            ? `Captions from the real transcript (${lines.length} lines).`
            : "Captions are placeholder test words. They do not match the speech. Transcribe to use real captions."}
        </p>
        {videoUrl && <Preview src={videoUrl} lines={lines} />}
      </Step>

      <Step n={5} title="Export">
        <div className="flex flex-wrap gap-3">
          <button data-testid="render-button" disabled={!ready || render.status === "running"} onClick={() => void onRender()} className={btn}>
            Render MP4
          </button>
          {render.status === "running" && (
            <button onClick={() => void renderHandle.current?.cancel()} className={btnSecondary}>
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
            <a data-testid="mp4-link" href={render.url} download={baseName(file) + "-captioned.mp4"} className={btnSecondary + " w-fit"}>
              Download MP4
            </a>
          </div>
        )}
      </Step>
    </main>
  );
}

function Preview({ src, lines }: { src: string; lines: ReturnType<typeof groupWords> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
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
        if (line) drawCaption(ctx, line, t, DEFAULT_CAPTION_STYLE, canvas.width, canvas.height);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines]);

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

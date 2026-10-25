"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_CAPTION_STYLE,
  DEFAULT_GROUP_OPTIONS,
  getCaptionStyle,
  groupWords,
  loadCaptionFont,
  makeTestWords,
  toSrt,
  type CaptionFontId,
  type Word,
} from "@/lib/captions";
import { applyBrandKit, loadBrandKit, saveBrandKit, type BrandKit } from "@/lib/brandKit";
import { buildRunReport, readDeviceInfo, type DeviceInfo, type RunSteps } from "@/lib/deviceReport";
import { deleteDraft, fingerprintFile, loadDraft, saveDraft } from "@/lib/drafts";
import { checkDevice, type DeviceReport } from "@/lib/media/capabilities";
import { describeMediaError, type Problem } from "@/lib/media/errors";
import { planExport, type ExportPresetId, type Framing } from "@/lib/media/exportPresets";
import { extractSpeechAudio } from "@/lib/media/extractAudio";
import { probeFile } from "@/lib/media/probe";
import { RenderCanceledError, renderInWorker, type RenderHandle, type RenderStorage } from "@/lib/media/renderInWorker";
import type { Issue, ProbeResult } from "@/lib/media/types";
import { issue, validateFileBasics, validateProbe } from "@/lib/media/validate";
import { requestTranscription } from "@/lib/transcription/client";
import type { CaptionLanguage, TranscribeResponse } from "@/lib/transcription/types";

export type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "rejected"; problem: Problem }
  | { status: "ready"; probe: ProbeResult; warnings: Issue[]; device: DeviceReport };

export type AudioState =
  | { status: "idle" }
  | { status: "running"; progress: number }
  | { status: "done"; blob: Blob; url: string }
  | { status: "error"; problem: Problem };

export type TranscriptState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; words: Word[]; providerName: string; warning?: TranscribeResponse["warning"] }
  | { status: "error"; problem: Problem };

/** User edits on top of the transcript (or placeholder words), with undo history. */
type Edits = { words: Word[]; history: Word[][] };

export type SaveState = "idle" | "saving" | "saved" | "error";

export type RenderState =
  | { status: "idle" }
  | { status: "running"; progress: number }
  | { status: "done"; url: string; sizeBytes: number; ms: number; storage: RenderStorage }
  | { status: "error"; problem: Problem };

/**
 * The whole caption workflow for one video: check, extract, transcribe, edit,
 * style, render, autosave. Layout-free, so the lab and the studio share it.
 *
 * `placeholders`: show labelled test words before a transcript exists (the lab
 * uses this to exercise rendering without an API key; the studio does not).
 */
export function useReelSession({ placeholders }: { placeholders: boolean }) {
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
  // Step timings and problems for the device report; reset on every pick.
  const [run, setRun] = useState<{ steps: RunSteps; problems: string[] }>({ steps: {}, problems: [] });
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const recordStep = (patch: RunSteps) => setRun((r) => ({ ...r, steps: { ...r.steps, ...patch } }));
  const recordProblem = (problem: string) => setRun((r) => ({ ...r, problems: [...r.problems, problem] }));
  useEffect(() => {
    readDeviceInfo().then(setDeviceInfo, () => {});
  }, []);
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
  const transcribeAbort = useRef<AbortController | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const online = useOnline();
  const busy = audio.status === "running" || transcript.status === "running" || render.status === "running";
  useLeaveWarning(busy);
  // Keep a phone's screen on during long local work; a sleeping screen can pause the tab.
  useWakeLock(audio.status === "running" || render.status === "running");
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
  const [exportPreset, setExportPreset] = useState<ExportPresetId>("reels");
  const [framing, setFraming] = useState<Framing>("fill");
  /** The exact output frame; the preview shows the same crop or bars. */
  const plan = useMemo(
    () => (probe?.video ? planExport(probe.video, exportPreset, framing) : null),
    [probe, exportPreset, framing],
  );
  const realWords = transcript.status === "done" ? transcript.words : null;
  const sourceWords = useMemo(
    () => realWords ?? (placeholders && probe ? makeTestWords(probe.durationSec) : []),
    [realWords, probe, placeholders],
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

  async function pickFile(picked: File | null) {
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
    setPreviewFailed(false);
    transcribeAbort.current?.abort();
    setRun({ steps: {}, problems: [] });
    if (!picked) return setCheck({ status: "idle" });
    const checkStarted = performance.now();

    const basics = validateFileBasics(picked);
    if (!basics.ok) {
      recordProblem(`CHECK: ${basics.error.code}`);
      return setCheck({ status: "rejected", problem: toProblem(basics.error) });
    }

    setCheck({ status: "checking" });
    let probed: ProbeResult;
    try {
      probed = await probeFile(picked);
    } catch {
      if (stale()) return;
      recordProblem("CHECK: UNSUPPORTED_FORMAT");
      return setCheck({ status: "rejected", problem: toProblem(issue("UNSUPPORTED_FORMAT")) });
    }
    if (stale()) return;
    const result = validateProbe(probed);
    if (!result.ok) {
      recordProblem(`CHECK: ${result.error.code}`);
      return setCheck({ status: "rejected", problem: toProblem(result.error) });
    }

    let device: DeviceReport;
    try {
      device = await checkDevice({ width: probed.video!.width, height: probed.video!.height });
    } catch {
      if (stale()) return;
      recordProblem("DEVICE: check failed");
      return setCheck({
        status: "rejected",
        problem: {
          message: "We couldn't check what this device supports.",
          action: "Reload the page and pick the video again. If it keeps happening, update Chrome.",
        },
      });
    }
    if (stale()) return;
    if (device.blockers.length) {
      recordProblem(`DEVICE: ${device.blockers.join(" ")}`);
      return setCheck({
        status: "rejected",
        problem: { message: "This device can't process the video locally.", action: device.blockers.join(" ") },
      });
    }
    setVideoUrl(makeUrl(picked));
    setCheck({ status: "ready", probe: probed, warnings: result.warnings, device });
    recordStep({ checkMs: performance.now() - checkStarted });

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

  async function startOver() {
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

  /** Extracts speech audio on this device. Resolves to the audio, or null if it failed. */
  async function extract(): Promise<Blob | null> {
    if (!file) return null;
    // Same file, same audio: keep the transcript and the user's edits.
    setAudio({ status: "running", progress: 0 });
    const started = performance.now();
    try {
      const blob = await extractSpeechAudio(file, (p) => setAudio({ status: "running", progress: p }));
      setAudio({ status: "done", blob, url: makeUrl(blob) });
      recordStep({ extractMs: performance.now() - started, audioKb: Math.round(blob.size / 1024) });
      return blob;
    } catch (err) {
      recordProblem(`EXTRACT: ${errorLabel(err)}`);
      setAudio({ status: "error", problem: describeMediaError("extract", err) });
      return null;
    }
  }

  async function transcribe(blob = audio.status === "done" ? audio.blob : null) {
    if (!blob) return;
    setTranscript({ status: "running" });
    const started = performance.now();
    const abort = new AbortController();
    transcribeAbort.current = abort;
    const result = await requestTranscription(blob, language, abort.signal);
    if (abort.signal.aborted) return setTranscript({ status: "idle" });
    if (result.ok) {
      recordStep({ transcribeMs: performance.now() - started });
      if (result.warning) recordProblem("TRANSCRIBE: Hinglish fell back to Hindi script");
      setTranscript({ status: "done", words: result.words, providerName: result.providerName, warning: result.warning });
      setEdits(null);
    } else {
      recordProblem(`TRANSCRIBE: ${result.code}`);
      setTranscript({ status: "error", problem: { message: result.message, action: result.action } });
    }
  }

  /** One user action: extract the speech audio here (if not done yet), then transcribe it. */
  async function makeCaptions() {
    const blob = audio.status === "done" ? audio.blob : await extract();
    if (blob) await transcribe(blob);
  }

  async function startRender() {
    if (!file || !plan) return;
    setRender({ status: "running", progress: 0 });
    const started = performance.now();
    const handle = renderInWorker({ file, lines, style, plan }, (p) => setRender({ status: "running", progress: p }));
    renderHandle.current = handle;
    try {
      const { blob, storage } = await handle.result;
      const ms = performance.now() - started;
      setRender({ status: "done", url: makeUrl(blob), sizeBytes: blob.size, ms, storage });
      recordStep({ renderMs: ms, renderStorage: storage, outputMb: Math.round((blob.size / 1024 / 1024) * 10) / 10 });
    } catch (err) {
      const canceled = err instanceof RenderCanceledError;
      if (!canceled) recordProblem(`RENDER: ${errorLabel(err)}`);
      setRender(canceled ? { status: "idle" } : { status: "error", problem: describeMediaError("render", err) });
    } finally {
      renderHandle.current = null;
    }
  }

  const runReport = deviceInfo
    ? buildRunReport({
        device: deviceInfo,
        capabilities: check.status === "ready" ? check.device : null,
        probe,
        steps: run.steps,
        problems: run.problems,
      })
    : null;

  return {
    file,
    fileBaseName: file?.name.replace(/\.[^.]+$/, "") || "video",
    videoUrl,
    videoRef,
    check,
    probe,
    ready: check.status === "ready",
    audio,
    language,
    setLanguage,
    transcript,
    realWords,
    words,
    lines,
    edits,
    editWords,
    undoEdit,
    canUndo: !!edits?.history.length,
    saveState,
    restoredAt,
    fingerprint,
    startOver,
    styleId,
    setStyleId,
    baseStyle,
    style,
    kit,
    changeKit,
    kitSaveFailed,
    fontReady,
    fontFailed,
    retryFont: () => setFontRetry((n) => n + 1),
    render,
    srtUrl,
    exportPreset,
    setExportPreset,
    framing,
    setFraming,
    plan,
    online,
    previewFailed,
    setPreviewFailed,
    runReport,
    pickFile,
    extract,
    transcribe,
    cancelTranscribe: () => transcribeAbort.current?.abort(),
    makeCaptions,
    startRender,
    cancelRender: () => renderHandle.current?.cancel(),
  };
}

export type ReelSession = ReturnType<typeof useReelSession>;

function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** Asks the browser to confirm before closing or reloading while local work would be lost. */
function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}

/** Holds a screen wake lock while `active`, where supported (Chrome on Android). Best effort. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    navigator.wakeLock.request("screen").then(
      (l) => (released ? void l.release() : (lock = l)),
      () => {},
    );
    return () => {
      released = true;
      void lock?.release();
    };
  }, [active]);
}

function errorLabel(err: unknown): string {
  return err instanceof Error || err instanceof DOMException ? `${err.name}: ${err.message}` : String(err);
}

function toProblem(i: Issue): Problem {
  return { message: i.reason, action: i.action };
}

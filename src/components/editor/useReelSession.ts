"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_GROUP_OPTIONS,
  getCaptionStyle,
  groupWords,
  loadCaptionFont,
  makeTestWords,
  toSrt,
  type Word,
} from "@/lib/captions";
import { applyBrandKit, loadBrandKit, saveBrandKit, type BrandKit } from "@/lib/brandKit";
import { localDb } from "@/lib/localDb";
import { useEditingSettings } from "./useEditingSettings";
import type { EditorProject, EditorSelection, CaptionSegment } from "@/lib/editor/project";
import { applyOperations, captionsFromLines, captionLines, type EditOperation } from "@/lib/editor/operations";
import { FONT_CATALOG, listLocalFonts, loadLibraryFont, type FontRecord } from "@/lib/editor/fontLibrary";
import { applyAppearance } from "@/lib/captions/appearance";
import { retainedPieces, normalizeCuts, remapCaptionLines, type SilenceOptions, type EnergyWindow } from "@/lib/editor/timeline";
import { buildRunReport, readDeviceInfo, type DeviceInfo, type RunSteps } from "@/lib/deviceReport";
import { deleteDraft, fingerprintFile, loadDraft, saveDraft } from "@/lib/drafts";
import { canEncodeH264At, checkDevice, type DeviceReport } from "@/lib/media/capabilities";
import { describeMediaError, type Problem } from "@/lib/media/errors";
import { planExport, type ExportPresetId, type Framing } from "@/lib/media/exportPresets";
import { planComposition } from "@/lib/media/composition";
import { extractSpeechAudio } from "@/lib/media/extractAudio";
import { probeFile } from "@/lib/media/probe";
import { RenderCanceledError, renderInWorker, type RenderHandle, type RenderStorage } from "@/lib/media/renderInWorker";
import type { Issue, ProbeResult } from "@/lib/media/types";
import { issue, validateFileBasics, validateProbe } from "@/lib/media/validate";
import { validateVideoDuration } from "@/lib/media/duration";
import { fetchTranscribeConfig, requestTranscription } from "@/lib/transcription/client";
import type { CaptionLanguage, TranscribeConfigResponse, TranscribeResponse } from "@/lib/transcription/types";

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

/** The server's bot check (Turnstile). `round` changes after each upload, since a token is single use. */
export type HumanCheckState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "off" }
  | { status: "on"; siteKey: string; token: string | null; round: number };

/** User edits on top of the transcript (or placeholder words), with undo history. */

export type SaveState = "idle" | "saving" | "saved" | "error";

export type RenderState =
  | { status: "idle" }
  | { status: "running"; progress: number }
  | { status: "done"; url: string; sizeBytes: number; ms: number; storage: RenderStorage; fastStart: boolean; audioCodec: string | null }
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
  /** Content hash of the current file, used as the draft key. Null when autosave is unavailable. */
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  /** Increments on every pick, so results from an older pick are ignored. */
  const pickId = useRef(0);
  const extracting = useRef(false);
  const captioning = useRef(false);
  const editing = useEditingSettings(() => { setSaveState("saving"); invalidateRender(); });
  const { styleId, exportPreset, framing } = editing.settings;
  const setStyleId = (styleId: string) => editing.update({ styleId, appearance: {}, animation: { effect: "none", duration: 0.25, intensity: 0.5 } });
  const setExportPreset = (exportPreset: ExportPresetId) => editing.update({ exportPreset });
  const setFraming = (framing: Framing) => editing.update({ framing });
  const baseStyle = getCaptionStyle(styleId);
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [editProblem, setEditProblem] = useState<string | null>(null);
  const [silenceReview, setSilenceReview] = useState<{ file: File | null; cuts: { start: number; end: number; selected: boolean }[]; windows: import("@/lib/editor/timeline").EnergyWindow[] } | null>(null);
  const [previewSuggestions, setPreviewSuggestions] = useState(false);
  const [silenceOptions, setSilenceOptions] = useState<SilenceOptions>({ threshold: -40, minimum: 0.6, padding: 0.08, keep: 0.2 });
  const [analysisProgress, setAnalysisProgress] = useState<number | null>(null);
  const [analysisProblem, setAnalysisProblem] = useState<string | null>(null);
  const analysisWorker = useRef<Worker | null>(null);
  const analysisGeneration = useRef(0);
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
  const [fonts, setFonts] = useState<FontRecord[]>(FONT_CATALOG);
  const refreshFonts = useCallback(() => listLocalFonts().then((local) => setFonts([...FONT_CATALOG, ...local])), []);
  useEffect(() => { void refreshFonts().catch(() => setSaveState("error")); }, [refreshFonts]);
  const requiredFontIds = useMemo(() => [editing.settings.appearance.font,
    ...editing.settings.captions?.map((caption) => caption.appearance.font) ?? [],
    ...editing.settings.overlays.map((overlay) => overlay.font ?? overlay.appearance?.font)].filter((id): id is string => !!id), [editing.settings.appearance.font, editing.settings.captions, editing.settings.overlays]);
  const additionalFonts = useMemo(() => fonts.filter((font) => requiredFontIds.includes(font.id)), [fonts, requiredFontIds]);
  const style = useMemo(() => ({ ...applyAppearance(kit?.enabled ? applyBrandKit(baseStyle, kit) : baseStyle,
    editing.settings.appearance, editing.settings.animation, fonts), additionalFonts }), [baseStyle, kit, editing.settings.appearance, editing.settings.animation, fonts, additionalFonts]);

  useEffect(() => {
    loadBrandKit().then(
      (saved) => saved && setKit(saved),
      () => setKitSaveFailed(true),
    );
  }, []);

  function changeKit(next: BrandKit) {
    invalidateRender();
    setKit(next);
    // Saved immediately: a kit is a few bytes, and losing a brand setup is worse than an extra write.
    saveBrandKit(next).then(
      () => setKitSaveFailed(false),
      () => setKitSaveFailed(true),
    );
  }
  const [fontLoad, setFontLoad] = useState<{ font: string; ok: boolean } | null>(null);
  const [fontRetry, setFontRetry] = useState(0);
  const fontKey = `${style.font}:${style.customFont?.id ?? ""}:${requiredFontIds.join("|")}`;
  const fontReady = fontLoad?.font === fontKey && fontLoad.ok;
  const fontFailed = fontLoad?.font === fontKey && !fontLoad.ok;

  // Load the selected style's bundled font for the preview (the render worker loads its own copy).
  useEffect(() => {
    let current = true;
    const missing = requiredFontIds.some((selected) => !fonts.some((font) => font.id === selected));
    Promise.all([loadCaptionFont(style.font, document.fonts),
      missing ? Promise.reject(new Error("Font removed from browser storage")) : Promise.all(additionalFonts.map((font) => loadLibraryFont(font, document.fonts)))]).then(
      () => current && setFontLoad({ font: fontKey, ok: true }),
      () => current && setFontLoad({ font: fontKey, ok: false }),
    );
    return () => {
      current = false;
    };
  }, [style.font, style.customFont, fontKey, fonts, requiredFontIds, additionalFonts, fontRetry]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const renderHandle = useRef<RenderHandle | null>(null);
  const renderId = useRef(0);
  const renderOutputUrl = useRef<string | null>(null);
  const transcribeAbort = useRef<AbortController | null>(null);
  const [humanCheck, setHumanCheck] = useState<HumanCheckState>({ status: "loading" });
  /** Where uploads go, from the server; null until it answers. */
  const [uploadConfig, setUploadConfig] = useState<TranscribeConfigResponse | null>(null);
  const applyServerConfig = useCallback((config: TranscribeConfigResponse | null) => {
    setUploadConfig(config);
    setHumanCheck(
      config === null
        ? { status: "error" }
        : config.humanCheckSiteKey
          ? { status: "on", siteKey: config.humanCheckSiteKey, token: null, round: 0 }
          : { status: "off" },
    );
  }, []);
  // The latest token, read at upload time: extraction can take long enough for a token to be replaced.
  const humanToken = useRef<string | null>(null);
  const humanReady = humanCheck.status === "off" || (humanCheck.status === "on" && humanCheck.token !== null);
  useEffect(() => {
    void fetchTranscribeConfig().then(applyServerConfig);
  }, [applyServerConfig]);
  const setHumanCheckToken = useCallback((token: string | null) => {
    humanToken.current = token;
    setHumanCheck((h) => (h.status === "on" ? { ...h, token } : h));
  }, []);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
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
  function invalidateRender() {
    renderId.current++;
    renderHandle.current?.cancel();
    renderHandle.current = null;
    if (renderOutputUrl.current) {
      URL.revokeObjectURL(renderOutputUrl.current);
      urls.current.delete(renderOutputUrl.current);
      renderOutputUrl.current = null;
    }
    setRender({ status: "idle" });
  }
  useEffect(() => () => {
    pickId.current++;
    analysisGeneration.current++; analysisWorker.current?.terminate();
    transcribeAbort.current?.abort();
    renderHandle.current?.cancel();
    revokeAll();
  }, []);

  const probe = check.status === "ready" ? check.probe : null;
  /** The exact output frame; the preview shows the same crop or bars. */
  const plan = useMemo(
    () => (probe?.video ? { ...planComposition(probe.video, exportPreset, framing, editing.settings.composition),
      ...(editing.settings.cuts.length ? { cuts: normalizeCuts(editing.settings.cuts, probe.durationSec) } : {}),
      ...(editing.settings.overlays.length ? { overlays: editing.settings.overlays } : {}), audio: editing.settings.audio, gaps: editing.settings.gaps } : null),
    [probe, exportPreset, framing, editing.settings.composition, editing.settings.cuts, editing.settings.overlays, editing.settings.audio, editing.settings.gaps],
  );
  const previewPlan = useMemo(() => plan && previewSuggestions && silenceReview?.file === file && probe
    ? { ...plan, cuts: normalizeCuts([...editing.settings.cuts, ...silenceReview.cuts.filter((cut) => cut.selected)], probe.durationSec) } : plan,
    [plan, previewSuggestions, silenceReview, file, probe, editing.settings.cuts]);
  // Can this device encode the chosen export size? Null while checking.
  const [encodeCheck, setEncodeCheck] = useState<{ size: string; ok: boolean } | null>(null);
  const planSize = plan ? `${plan.width}×${plan.height}` : null;
  useEffect(() => {
    if (!plan) return;
    let current = true;
    const size = `${plan.width}×${plan.height}`;
    canEncodeH264At(plan).then((ok) => current && setEncodeCheck({ size, ok }));
    return () => {
      current = false;
    };
  }, [plan]);
  const planEncodable = planSize !== null && encodeCheck?.size === planSize ? encodeCheck.ok : null;
  const manualWords = useMemo(() => editing.settings.captions?.flatMap((caption) => caption.words) ?? editing.settings.wordEdits, [editing.settings.captions, editing.settings.wordEdits]);
  const realWords = transcript.status === "done" ? transcript.words : manualWords;
  const sourceWords = useMemo(
    () => realWords ?? (placeholders && probe ? makeTestWords(probe.durationSec) : []),
    [realWords, probe, placeholders],
  );
  const words = manualWords ?? sourceWords;
  const edits = manualWords ? { words: manualWords } : null;

  function editWords(next: Word[]) {
    if (editing.settings.captions) { setEditProblem("Use the selected caption properties to edit text and timing while preserving individual styles."); return; }
    editing.update({ wordEdits: next, captions: null });
  }
  function undoEdit() {
    editing.undo();
  }
  const grouped = useMemo(() => groupWords(words, { ...DEFAULT_GROUP_OPTIONS, ...style.group }), [words, style]);
  const captionSegments: CaptionSegment[] = useMemo(() => editing.settings.captions ?? captionsFromLines(grouped), [editing.settings.captions, grouped]);
  const lines = useMemo(() => captionLines(captionSegments), [captionSegments]);
  function applyEdit(operations: EditOperation[]): boolean {
    try {
      if (!probe) throw new Error("Choose a valid video first.");
      const next = applyOperations(editing.settings, captionSegments, operations, probe.durationSec, fonts.map((font) => font.id));
      if (operations.some((op) => op.type === "caption_add")) { const added = next.captions?.find((item) => !captionSegments.some((old) => old.id === item.id)); if (added) setSelection({ kind: "caption", id: added.id }); }
      if (selection?.kind === "gap" && operations.some((op) => op.type === "remove_gap")) setSelection(null);
      const video = videoRef.current;
      if (video) { const cut = next.cuts.find((cut) => video.currentTime >= cut.start && video.currentTime < cut.end); if (cut) { const last = retainedPieces(0, probe.durationSec, next.cuts).at(-1); video.currentTime = cut.end < probe.durationSec ? cut.end : Math.max(last?.start ?? 0, (last?.end ?? 0) - 0.001); } }
      editing.update(next); setEditProblem(null); return true;
    } catch (error) { setEditProblem(error instanceof Error ? error.message : "This edit couldn't be applied."); return false; }
  }

  // Autosave the real transcript and edits, debounced so a burst of nudges is one write.
  const savedTranscript = transcript.status === "done" ? transcript : null;
  useEffect(() => {
    if (!fingerprint || !savedTranscript) return;
    const timer = setTimeout(() => {
      setSaveState("saving");
      Promise.all([saveDraft({
        version: 1,
        fingerprint,
        savedAt: Date.now(),
        providerName: savedTranscript.providerName,
        transcript: savedTranscript.words,
        edited: manualWords ?? null,
        styleId,
        editing: editing.settings,
      }), localDb().then((database) => database.put("settings", editing.settings, `project:${fingerprint}`))]).then(
        () => setSaveState("saved"),
        () => setSaveState("error"),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [fingerprint, savedTranscript, manualWords, styleId, editing.settings]);
  useEffect(() => {
    if (!fingerprint || savedTranscript) return;
    const timer = setTimeout(() => {
      void localDb().then((database) => database.put("settings", { ...editing.settings, savedAt: Date.now() }, `project:${fingerprint}`))
        .then(() => setSaveState("saved"), () => setSaveState("error"));
    }, 400);
    return () => clearTimeout(timer);
  }, [fingerprint, editing.settings, savedTranscript]);
  const srtUrl = useMemo(
    () => (lines.length ? URL.createObjectURL(new Blob([toSrt(remapCaptionLines(lines, plan?.cuts ?? []))], { type: "application/x-subrip" })) : null),
    [lines, plan?.cuts],
  );
  useEffect(() => () => void (srtUrl && URL.revokeObjectURL(srtUrl)), [srtUrl]);

  async function pickFile(picked: File | null) {
    const id = ++pickId.current;
    // Cuts and titles belong to this source; an existing project may restore them after probing.
    editing.restore({ ...editing.settings, cuts: [], gaps: [], overlays: [], captions: null, wordEdits: null, splits: [] });
    setSelection(null); setEditProblem(null); setSilenceReview(null); setPreviewSuggestions(false);
    cancelAnalysis(); setAnalysisProblem(null);
    const stale = () => id !== pickId.current;
    extracting.current = false;
    captioning.current = false;
    setFingerprint(null);
    setSaveState("idle");
    setRestoredAt(null);
    renderHandle.current?.cancel();
    revokeAll();
    setFile(picked);
    setAudio({ status: "idle" });
    setTranscript({ status: "idle" });
    setRender({ status: "idle" });
    setVideoUrl(null);
    setPreviewFailed(false);
    transcribeAbort.current?.abort();
    transcribeAbort.current = null;
    setRun({ steps: {}, problems: [] });
    if (!picked) return setCheck({ status: "idle" });
    const checkStarted = performance.now();

    const basics = validateFileBasics(picked);
    if (!basics.ok) {
      setFile(null);
      recordProblem(`CHECK: ${basics.error.code}`);
      return setCheck({ status: "rejected", problem: toProblem(basics.error) });
    }

    setCheck({ status: "checking" });
    let probed: ProbeResult;
    try {
      probed = await probeFile(picked);
    } catch {
      if (stale()) return;
      setFile(null);
      recordProblem("CHECK: UNSUPPORTED_FORMAT");
      return setCheck({ status: "rejected", problem: toProblem(issue("UNSUPPORTED_FORMAT")) });
    }
    if (stale()) return;
    const result = validateProbe(probed, { requireAudio: placeholders });
    if (!result.ok) {
      setFile(null);
      recordProblem(`CHECK: ${result.error.code}`);
      return setCheck({ status: "rejected", problem: toProblem(result.error) });
    }

    let device: DeviceReport;
    try {
      // The smallest export, so a 4K clip isn't refused on a phone that can only encode 1080p.
      device = await checkDevice(planExport(probed.video!, "small", "fill"));
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
      const savedEditing = await (await localDb()).get("settings", `project:${fp}`);
      if (stale()) return;
      if (draft?.editing || savedEditing) editing.restore(draft?.editing ?? savedEditing);
      setFingerprint(fp);
      if (draft) {
        setTranscript({ status: "done", words: draft.transcript, providerName: draft.providerName });
        setRestoredAt(draft.savedAt);
        if (!savedEditing && !draft.editing) editing.restore({ styleId: getCaptionStyle(draft.styleId).id, wordEdits: draft.edited });
        setSaveState("saved");
      }
      else if (savedEditing && typeof savedEditing === "object" && "savedAt" in savedEditing && typeof savedEditing.savedAt === "number") { setRestoredAt(savedEditing.savedAt); setSaveState("saved"); }
    } catch {
      if (!stale()) setSaveState("error");
    }
  }

  async function startOver() {
    if (!fingerprint || !window.confirm("Delete the saved transcript and your edits for this video?")) return;
    invalidateRender();
    try {
      await deleteDraft(fingerprint);
      await (await localDb()).put("settings", { ...editing.settings, captions: null, wordEdits: null }, `project:${fingerprint}`);
    } catch {
      // The in-memory reset below still applies; a leftover draft is overwritten on the next save.
    }
    setTranscript({ status: "idle" });
    editing.update({ captions: null, wordEdits: null });
    setRestoredAt(null);
    setSaveState("idle");
  }

  /** Extracts speech audio on this device. Resolves to the audio, or null if it failed. */
  async function extract(): Promise<Blob | null> {
    if (!file || check.status !== "ready" || !validateVideoDuration(probe?.durationSec) || extracting.current) return null;
    extracting.current = true;
    const id = pickId.current;
    // Same file, same audio: keep the transcript and the user's edits.
    setAudio({ status: "running", progress: 0 });
    const started = performance.now();
    try {
      const blob = await extractSpeechAudio(file, (p) => {
        if (id === pickId.current) setAudio({ status: "running", progress: p });
      });
      if (id !== pickId.current) return null;
      setAudio({ status: "done", blob, url: makeUrl(blob) });
      recordStep({ extractMs: performance.now() - started, audioKb: Math.round(blob.size / 1024) });
      return blob;
    } catch (err) {
      if (id !== pickId.current) return null;
      recordProblem(`EXTRACT: ${errorLabel(err)}`);
      setAudio({ status: "error", problem: describeMediaError("extract", err) });
      return null;
    } finally {
      if (id === pickId.current) extracting.current = false;
    }
  }

  function transcriptionConfigured() {
    if (uploadConfig?.setupError || !uploadConfig?.provider) {
      setTranscript({ status: "error", problem: {
        message: "Transcription is not configured on this server.",
        action: uploadConfig?.setupError ?? "Set GROQ_API_KEY in .env.local at the project root, then restart the server.",
      } });
      return false;
    }
    return true;
  }

  async function transcribe(blob = audio.status === "done" ? audio.blob : null) {
    if (!blob || !online || !humanReady || check.status !== "ready" || !validateVideoDuration(probe?.durationSec) || transcribeAbort.current) return;
    if (!transcriptionConfigured()) return;
    invalidateRender();
    setTranscript({ status: "running" });
    const started = performance.now();
    const abort = new AbortController();
    transcribeAbort.current = abort;
    const id = pickId.current;
    const result = await requestTranscription(blob, language, abort.signal, humanToken.current);
    if (transcribeAbort.current === abort) transcribeAbort.current = null;
    if (id !== pickId.current) return;
    // Tokens are single use: drop it and have the widget fetch a new one, whatever the outcome.
    humanToken.current = null;
    setHumanCheck((h) => (h.status === "on" ? { ...h, token: null, round: h.round + 1 } : h));
    if (abort.signal.aborted) return setTranscript({ status: "idle" });
    if (result.ok) {
      recordStep({ transcribeMs: performance.now() - started });
      if (result.warning) recordProblem("TRANSCRIBE: Hinglish fell back to Hindi script");
      setTranscript({ status: "done", words: result.words, providerName: result.providerName, warning: result.warning });
      editing.update({ captions: null, wordEdits: null });
    } else {
      recordProblem(`TRANSCRIBE: ${result.code}`);
      setTranscript({ status: "error", problem: { message: result.message, action: result.action } });
    }
  }

  function cancelAnalysis() { analysisGeneration.current++; analysisWorker.current?.terminate(); analysisWorker.current = null; setAnalysisProgress(null); }
  async function analyzeSilence(options = silenceOptions) {
    if (analysisWorker.current || analysisProgress !== null || check.status !== "ready") return;
    const generation = ++analysisGeneration.current;
    const source = file;
    setSilenceOptions(options); setAnalysisProgress(0); setAnalysisProblem(null);
    const blob = audio.status === "done" ? audio.blob : await extract();
    if (generation !== analysisGeneration.current) return;
    if (!blob) { setAnalysisProgress(null); setAnalysisProblem("Couldn't prepare audio. Retry extraction before analyzing."); return; }
    const worker = new Worker(new URL("../../lib/media/silence.worker.ts", import.meta.url), { type: "module" });
    analysisWorker.current = worker;
    worker.onmessage = ({ data }: MessageEvent<{ type: string; value: number; cuts: { start: number; end: number }[]; windows: EnergyWindow[]; message: string }>) => {
      if (generation !== analysisGeneration.current) return;
      if (data.type === "progress") { setAnalysisProgress(data.value); return; }
      worker.terminate(); analysisWorker.current = null; setAnalysisProgress(null);
      if (data.type === "done") setSilenceReview({ file: source, cuts: data.cuts.map((cut) => ({ ...cut, selected: true })), windows: data.windows });
      else setAnalysisProblem(data.message);
    };
    worker.onerror = () => { if (generation !== analysisGeneration.current) return; cancelAnalysis(); setAnalysisProblem("Audio analysis stopped. Retry or choose a smaller clip."); };
    worker.postMessage({ audio: blob, options });
  }

  /** One user action: extract the speech audio here (if not done yet), then transcribe it. */
  async function makeCaptions() {
    if (captioning.current || busy || !online || !humanReady || check.status !== "ready" || !validateVideoDuration(probe?.durationSec)) return;
    captioning.current = true;
    const id = pickId.current;
    try {
      if (!transcriptionConfigured()) return;
      const blob = audio.status === "done" ? audio.blob : await extract();
      if (blob && id === pickId.current) await transcribe(blob);
    } finally {
      if (id === pickId.current) captioning.current = false;
    }
  }

  async function startRender() {
    if (!file || !plan || planEncodable !== true || busy || renderHandle.current ||
      check.status !== "ready" || !validateVideoDuration(probe?.durationSec) || !fontReady) return;
    const id = pickId.current;
    const job = ++renderId.current;
    setRender({ status: "running", progress: 0 });
    const started = performance.now();
    const handle = renderInWorker({ file, lines, style, plan, segments: null }, (p) => {
      if (id === pickId.current && job === renderId.current) setRender({ status: "running", progress: p });
    });
    renderHandle.current = handle;
    try {
      const { blob, storage, fastStart, audioCodec } = await handle.result;
      if (id !== pickId.current || job !== renderId.current) return;
      const ms = performance.now() - started;
      const url = makeUrl(blob);
      renderOutputUrl.current = url;
      setRender({ status: "done", url, sizeBytes: blob.size, ms, storage, fastStart, audioCodec });
      recordStep({ renderMs: ms, renderStorage: storage, outputMb: Math.round((blob.size / 1024 / 1024) * 10) / 10 });
    } catch (err) {
      if (id !== pickId.current || job !== renderId.current) return;
      const canceled = err instanceof RenderCanceledError;
      if (!canceled) recordProblem(`RENDER: ${errorLabel(err)}`);
      setRender(canceled ? { status: "idle" } : { status: "error", problem: describeMediaError("render", err) });
    } finally {
      if (renderHandle.current === handle) renderHandle.current = null;
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

  const project: EditorProject = { source: probe, words, settings: editing.settings };

  return {
    previewPlan, silenceOptions, setSilenceOptions, analysisProgress, analysisProblem, analyzeSilence, cancelAnalysis,
    selection, setSelection, editProblem, setEditProblem, captionSegments, applyEdit,
    silenceReview, setSilenceReview, previewSuggestions, setPreviewSuggestions,
    showGuides, setShowGuides,
    fonts, refreshFonts,
    project,
    editing,
    file,
    fileBaseName: file?.name.replace(/\.[^.]+$/, "") || "video",
    videoUrl,
    videoRef,
    seek: (time: number) => { const video = videoRef.current; if (video && Number.isFinite(time)) video.currentTime = Math.max(0, Math.min(probe?.durationSec ?? 0, time)); },
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
    canUndo: editing.canUndo,
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
    planEncodable,
    online,
    previewFailed,
    setPreviewFailed,
    runReport,
    pickFile,
    extract,
    transcribe,
    humanCheck,
    uploadConfig,
    humanReady,
    setHumanCheckToken,
    resetHumanCheck: () => { humanToken.current = null; setHumanCheck((h) => h.status === "on" ? { ...h, token: null, round: h.round + 1 } : h); },
    retryHumanCheck: () => {
      setHumanCheck({ status: "loading" });
      void fetchTranscribeConfig().then(applyServerConfig);
    },
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

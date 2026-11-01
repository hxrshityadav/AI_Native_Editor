"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Film } from "lucide-react";
import { useBlobUrl } from "../tools/useBlobUrl";
import { runVideoTask } from "@/lib/videos/client";
import { videoPlan, videoOutputName, type VideoContainer, type VideoQuality, type VideoResolution, type VideoSettings } from "@/lib/videos/policy";
import type { VideoInfo, VideoResult, VideoSupport } from "@/lib/videos/engine";
import { AdvancedSettings, ControlGroup, DetailsTable, FileDetails, FileDropzone, FilePicker, InlineMessage, PrimaryButton, ProcessingPanel, ResultPanel, Stage, TargetSizeInput, ToolControls, ToolSurface, styles, useResultView } from "../tools/surface/ToolSurface";

/* Video Compressor: upload -> configure -> compress (with real encoding progress) -> compare -> download. */

const ACCEPT = "video/mp4,video/quicktime,video/webm";
const RESOLUTIONS = [["original", "Original dimensions"], ["1080", "1080p"], ["720", "720p"], ["480", "480p"], ["360", "360p"]] as const;
const bytesLabel = (value: number) => `${(value / 1000000).toFixed(2)} MB (${value.toLocaleString()} bytes)`;
export function VideoCompressor() {
  const [file, setFile] = useState<File>(), [info, setInfo] = useState<VideoInfo>(), [result, setResult] = useState<VideoResult>();
  const [resolution, setResolution] = useState<VideoResolution>("720"), [quality, setQuality] = useState<VideoQuality>("balanced");
  const [bitrate, setBitrate] = useState(""), [target, setTarget] = useState(""), [unit, setUnit] = useState("MB"), [mute, setMute] = useState(false);
  const [format, setFormat] = useState<"auto" | VideoContainer>("auto"), [support, setSupport] = useState<VideoSupport>();
  const [busy, setBusy] = useState(""), [progress, setProgress] = useState<number>(), [elapsed, setElapsed] = useState(0), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null), started = useRef(0);
  const originalUrl = useBlobUrl(file), outputUrl = useBlobUrl(result?.blob);
  const settings = useMemo<VideoSettings>(() => ({ resolution, quality, mute, container: format === "auto" ? "mp4" : format,
    ...(bitrate !== "" ? { bitrateKbps: Number(bitrate) } : {}), ...(target !== "" ? { targetBytes: Number(target) * (unit === "MB" ? 1000000 : 1000) } : {}) }), [resolution, quality, mute, format, bitrate, target, unit]);
  const planning = useMemo(() => { if (!info) return {}; try { return { plan: videoPlan(info, settings) }; } catch (error) { return { error: error instanceof Error ? error.message : "Choose valid compression settings." }; } }, [info, settings]);
  const container = format === "auto" ? support?.mp4 === null ? "mp4" : support?.webm === null ? "webm" : "mp4" : format;
  const capabilityError = support?.[container];

  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setElapsed((performance.now() - started.current) / 1000), 250);
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (!info || !planning.plan) return;
    const controller = new AbortController();
    void runVideoTask<VideoSupport>({ kind: "support", info, settings }, controller.signal).then(value => { if (!controller.signal.aborted) setSupport(value); }).catch(error => {
      if (!controller.signal.aborted) { const message = error instanceof Error ? error.message : "Could not check encoders. Reload and retry."; setSupport({ mp4: message, webm: message }); }
    });
    return () => controller.abort();
  }, [info, settings, planning.plan]);
  function invalidate() { setResult(undefined); setSupport(undefined); setError(""); setNotice(""); setProgress(undefined); }
  function cancel() { active.current?.abort(); active.current = null; setBusy(""); setNotice("Operation cancelled. You can retry or choose another file."); }
  function clear() { active.current?.abort(); active.current = null; setBusy(""); setFile(undefined); setInfo(undefined); invalidate(); }
  async function load(files: FileList | File[]) {
    clear();
    if (files.length !== 1) { setError("Choose one video at a time."); return; }
    const selected = files[0], controller = new AbortController(); active.current = controller;
    started.current = performance.now(); setElapsed(0); setBusy("Checking the local video");
    try {
      const source = await runVideoTask<VideoInfo>({ kind: "inspect", file: selected }, controller.signal);
      if (controller.signal.aborted) return;
      setFile(selected); setInfo(source); setMute(false); setFormat("auto");
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Cannot read this video. Try another file."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }
  async function compress() {
    if (!file || !info || !planning.plan || !support || capabilityError) return;
    const controller = new AbortController(); active.current?.abort(); active.current = controller;
    setResult(undefined); setError(""); setNotice(""); setProgress(undefined); started.current = performance.now(); setElapsed(0); setBusy("Preparing compression");
    try {
      const output = await runVideoTask<VideoResult>({ kind: "compress", file, settings: { ...settings, container } }, controller.signal, setProgress, setBusy);
      if (!controller.signal.aborted) setResult(output);
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Compression failed. Try lower resolution or another format."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); setElapsed((performance.now() - started.current) / 1000); } }
  }
  const view = useResultView(!!(result && outputUrl));
  const run = () => { view.showLatest(); void compress(); };
  const edit = <T,>(set: (value: T) => void) => (value: T) => { set(value); invalidate(); };

  if (!info || !file) return <section aria-label="Video Compressor workspace" className={styles.root}>
    <FileDropzone icon={Film} title="Drop your video here" pickLabel="Choose video" accept={ACCEPT} busy={busy} onCancel={cancel} onFiles={files => void load(files)}
      facts={<><span><b>MP4</b>, <b>MOV</b> or <b>WebM</b></span><span>Up to 512 MiB</span><span>Up to 10 minutes and 4K</span></>} />
    {notice && <InlineMessage role="status">{notice}</InlineMessage>}
    {error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}
  </section>;

  const saved = result ? 1 - result.blob.size / file.size : 0;
  const codecs = (video: VideoInfo) => `${video.videoCodec.toUpperCase()}${video.audioCodec ? ` / ${video.audioCodec.toUpperCase()}` : " / no audio"}`;
  return <section aria-label="Video Compressor workspace" className={styles.root}>
    <ToolSurface onFiles={files => void load(files)}
      file={<FileDetails name={file.name} factsLabel="Original video details" onStartOver={clear}
        thumb={originalUrl ? <video className={`${styles.thumb} ${styles.thumbVideo}`} src={originalUrl} muted playsInline preload="metadata" aria-hidden tabIndex={-1} /> : <span className={styles.thumb} />}
        picker={<FilePicker label="Replace video" inputLabel="Choose video" accept={ACCEPT} onFiles={files => void load(files)} />}
        facts={<><span>{(file.size / 1000000).toFixed(1)} MB<span className="sr-only"> ({file.size.toLocaleString()} bytes)</span></span><span>{info.width} × {info.height} px</span><span>{info.duration.toFixed(3)} seconds</span><span>{info.format}</span><span>{codecs(info)}</span></>} />}
      stage={<Stage plain busy={!!busy} processing={<ProcessingPanel title="Compressing" status={busy} detail={`${elapsed.toFixed(1)} s elapsed`} progress={progress} onCancel={cancel} />}>
        <div className={result && outputUrl ? styles.pair : "contents"}>
          <figure className={result && outputUrl ? undefined : "contents"}>{result && outputUrl && <span className={styles.tag} style={{ left: ".5rem" }} aria-hidden>Original</span>}{originalUrl && <video key={originalUrl} aria-label="Original video preview" src={originalUrl} controls playsInline preload="metadata" onError={event => { if (event.currentTarget.isConnected) setError("The original preview could not play here. Try another browser or re-export as H.264 MP4."); }} />}</figure>
          {result && outputUrl && <figure><span className={styles.tag} style={{ left: ".5rem" }} aria-hidden>Compressed</span><video key={outputUrl} aria-label="Compressed video preview" src={outputUrl} controls playsInline preload="metadata" onError={event => { if (event.currentTarget.isConnected) setError("The compressed preview could not play in this browser. Try another output format/browser and check the downloaded file independently."); }} /></figure>}
        </div>
      </Stage>}
      side={result && outputUrl && view.showResult
        ? <ResultPanel headingRef={view.heading} heading="Compression result" change={saved} onAdjust={view.adjust} note="Downloads a new file. Metadata, subtitles and extra tracks are not preserved."
          summary={<>{(file.size / 1000000).toFixed(1)} MB → {(result.blob.size / 1000000).toFixed(1)} MB. Completed in {elapsed.toFixed(1)} seconds; the final size is measured.</>}
          download={{ href: outputUrl, filename: videoOutputName(file.name, result.container), label: "Download compressed video" }}>
          {settings.targetBytes && <InlineMessage role="status" tone={result.targetMet ? "ok" : "warn"}>{result.targetMet ? "The measured result meets the target." : "The requested target was not achieved. The measured file is available; try lower resolution or bitrate, or mute audio if appropriate."}</InlineMessage>}
          {info.notes.map(note => <InlineMessage key={note} tone="warn">{note}</InlineMessage>)}
          <DetailsTable
            original={{ title: "Original", label: "Original video file", rows: [["Size", `${(file.size / 1000000).toFixed(1)} MB`, bytesLabel(file.size)], ["Dimensions", `${info.width} × ${info.height} px`], ["Duration", `${info.duration.toFixed(3)} seconds`], ["Codecs", codecs(info)]] }}
            result={{ title: "Compressed", label: "Measured video output", rows: [["Size", `${(result.blob.size / 1000000).toFixed(1)} MB`, bytesLabel(result.blob.size)], ["Container", result.blob.type], ["Dimensions", `${result.info.width} × ${result.info.height} px`], ["Duration", `${result.info.duration.toFixed(3)} seconds`], ["Codecs", codecs(result.info)], ["Change", `${(Math.abs(saved) * 100).toFixed(1)}% ${result.blob.size <= file.size ? "smaller" : "larger"}`]] }} />
        </ResultPanel>
        : <ToolControls title="Compression settings" controlsRef={view.controls} action={<>
          {planning.plan && <p aria-label="Estimated output size" className={styles.help}>Estimated output: {bytesLabel(planning.plan.estimatedBytes)} at {planning.plan.width} × {planning.plan.height}, {planning.plan.frameRate.toFixed(2)} fps. Actual output may differ.</p>}
          {planning.plan && !support && <p role="status" className={styles.help}>Checking available output encoders…</p>}
          {notice && <InlineMessage role="status">{notice}</InlineMessage>}
          {error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}
          {capabilityError && <InlineMessage role="alert" tone="error">{capabilityError}</InlineMessage>}
          {planning.error && <InlineMessage role="alert" tone="error">{planning.error}</InlineMessage>}
          <PrimaryButton label="Compress video" busyLabel="Compressing…" busy={!!busy} disabled={!planning.plan || !support || !!capabilityError} onClick={run} />
          {support && !capabilityError && <p className={styles.help}>Encoder: {container === "mp4" ? "MP4 with H.264" : "WebM with VP9"}{info.hasAudio && !mute ? container === "mp4" ? " and AAC audio" : " and Opus audio" : ", no audio"}.</p>}
          {view.adjusting && <button type="button" className={`${styles.secondary} ${styles.ghost}`} onClick={view.showLatest}>Back to result</button>}
        </>}>
          {info.notes.map(note => <InlineMessage key={note} tone="warn">{note}</InlineMessage>)}
          <ControlGroup label="Resolution">
            <select className={styles.field} aria-label="Output resolution" disabled={!!busy} value={resolution} onChange={event => edit(setResolution)(event.target.value as VideoResolution)}>{RESOLUTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <p className={styles.help}>Fits within the chosen size and never upscales. 720p suits phones and messaging apps.</p>
          </ControlGroup>
          <ControlGroup label="Quality">
            <select className={styles.field} aria-label="Quality preset" disabled={!!busy} value={quality} onChange={event => { setQuality(event.target.value as VideoQuality); setBitrate(""); invalidate(); }}><option value="high">Higher quality</option><option value="balanced">Balanced</option><option value="small">Smaller file</option></select>
          </ControlGroup>
          <ControlGroup label="Format">
            <select className={styles.field} aria-label="Video output format" disabled={!!busy} value={format} onChange={event => edit(setFormat)(event.target.value as typeof format)}><option value="auto">Automatic (verified support)</option><option value="mp4">MP4 — H.264 / AAC</option><option value="webm">WebM — VP9 / Opus</option></select>
          </ControlGroup>
          <ControlGroup label="Audio">
            <label className={styles.check}><input type="checkbox" checked={mute} disabled={!!busy || !info.hasAudio} onChange={event => edit(setMute)(event.target.checked)} />Mute audio</label>
            {!info.hasAudio && <p className={styles.help}>This source has no audio.</p>}
          </ControlGroup>
          <ControlGroup label="Target size" aside={<span className={styles.help}>Optional</span>}>
            <TargetSizeInput inputLabel="Target size" unitLabel="Target size units" value={target} unit={unit} units={["MB", "KB"]} disabled={!!busy} onValue={edit(setTarget)} onUnit={edit(setUnit)} />
            <p className={styles.help}>Decimal units: 1 MB = 1,000,000 bytes. A target lowers the requested bitrate; the final size is measured, not promised.</p>
            {planning.plan && !planning.plan.targetWithinBudget && <InlineMessage role="note" tone="warn">The target is below the estimated minimum bitrate/audio budget at these settings. It may not be met; choose lower resolution or mute if appropriate.</InlineMessage>}
          </ControlGroup>
          <AdvancedSettings>
            <label className={styles.group}><span className={styles.label}>Video bitrate (kbps)</span><input className={styles.field} aria-label="Video bitrate (kbps)" type="number" inputMode="numeric" min="100" max="50000" disabled={!!busy} value={bitrate} placeholder="Use quality preset…" onChange={event => edit(setBitrate)(event.target.value)} /></label>
            <p className={styles.help}>Requested average video bitrate. Browser encoders may deviate; this is not a guaranteed size or visual-quality percentage. Output is constant frame rate, up to 30 fps, with rotation baked in.</p>
          </AdvancedSettings>
        </ToolControls>} />
  </section>;
}

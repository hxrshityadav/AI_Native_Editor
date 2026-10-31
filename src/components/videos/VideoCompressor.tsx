"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, Film, RotateCcw, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useBlobUrl } from "../tools/useBlobUrl";
import { runVideoTask } from "@/lib/videos/client";
import { videoPlan, videoOutputName, type VideoContainer, type VideoQuality, type VideoResolution, type VideoSettings } from "@/lib/videos/policy";
import type { VideoInfo, VideoResult, VideoSupport } from "@/lib/videos/engine";
import { AdvancedDetails, Busy, Comparison, DropZone, ErrorMessage, Panel, PrimaryAction, Section, Tip, styles } from "../tools/Workspace";

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
  const loaded = !!(info && file);
  const panel = useRef<HTMLElement>(null);
  const adjust = () => { const first = panel.current?.querySelector<HTMLElement>("input, select, button"); first?.focus(); first?.scrollIntoView({ block: "center", behavior: "smooth" }); };
  const saved = result && file ? 1 - result.blob.size / file.size : 0;
  return <section aria-label="Video Compressor workspace" className={styles.workspace}>
    <DropZone icon={Film} loaded={loaded} pickLabel="Choose video" accept="video/mp4,video/quicktime,video/webm" title="Drop a video here"
      formats={["MP4", "MOV", "WebM"]} limits="One video up to 512 MiB, 10 minutes and 4K."
      fileName={file?.name} fileMeta={info && file ? [`${info.width} × ${info.height} px`, `${info.duration.toFixed(1)} s`, `${(file.size / 1000000).toFixed(1)} MB`] : []}
      onFiles={files => void load(files)} clear={<button type="button" className={styles.secondary} onClick={clear}><RotateCcw aria-hidden size={16} />Process another file</button>} />
    <div className={styles.feedback}>
      {busy && <Busy label={busy} detail={`${elapsed.toFixed(1)} s elapsed`} progress={progress} onCancel={cancel} />}
      {!busy && result && <p className={`${styles.message} ${styles.success}`}><CheckCircle2 aria-hidden />Completed in {elapsed.toFixed(1)} seconds. Final size below is measured.</p>}
      {notice && <p role="status" className={styles.message}>{notice}</p>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {info?.notes.map(note => <p key={note} className={`${styles.message} ${styles.warn}`}><TriangleAlert aria-hidden />{note}</p>)}
    </div>
    {info && file && <div className={styles.editor}>
      <div className={styles.previewArea}>
        <h2 className="sr-only">Preview</h2>
        <div className={styles.stage} data-busy={busy || undefined}>
          <div className={result && outputUrl ? styles.pair : "contents"}>
            <figure className={result && outputUrl ? undefined : "contents"}>{originalUrl && <video key={originalUrl} aria-label="Original video preview" src={originalUrl} controls preload="metadata" onError={event => { if (event.currentTarget.isConnected) setError("The original preview could not play here. Try another browser or re-export as H.264 MP4."); }} />}</figure>
            {result && outputUrl && <figure><video key={outputUrl} aria-label="Compressed video preview" src={outputUrl} controls preload="metadata" onError={event => { if (event.currentTarget.isConnected) setError("The compressed preview could not play in this browser. Try another output format/browser and check the downloaded file independently."); }} /></figure>}
          </div>
        </div>
      </div>
      <Panel title="Settings" panelRef={panel} action={<>
        {planning.plan && <p aria-label="Estimated output size" className={styles.help}>Estimated output: {bytesLabel(planning.plan.estimatedBytes)} at {planning.plan.width} × {planning.plan.height}, {planning.plan.frameRate.toFixed(2)} fps. Actual output may differ.</p>}
        {planning.plan && !support && <p role="status" className={styles.help}>Checking available output encoders…</p>}
        {capabilityError && <ErrorMessage>{capabilityError}</ErrorMessage>}
        {planning.error && <ErrorMessage>{planning.error}</ErrorMessage>}
        <PrimaryAction label="Compress video" busyLabel="Compressing…" busy={!!busy} disabled={!planning.plan || !support || !!capabilityError} onClick={() => void compress()} />
        {support && !capabilityError && <p className={styles.help}>Encoder: {container === "mp4" ? "MP4 with H.264" : "WebM with VP9"}{info.hasAudio && !mute ? container === "mp4" ? " and AAC audio" : " and Opus audio" : ", no audio"}.</p>}
      </>}>
        <Section title="Video" tip={<Tip label="About video presets" align="end">Presets fit within the selected size without upscaling. Output is constant frame rate, up to 30 fps, with rotation baked in.</Tip>}>
          <label>Output resolution<select aria-label="Output resolution" disabled={!!busy} value={resolution} onChange={event => { setResolution(event.target.value as VideoResolution); invalidate(); }}>{[ ["original", "Original dimensions"], ["1080", "1080p"], ["720", "720p"], ["480", "480p"], ["360", "360p"] ].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Quality preset<select aria-label="Quality preset" disabled={!!busy} value={quality} onChange={event => { setQuality(event.target.value as VideoQuality); setBitrate(""); invalidate(); }}><option value="high">Higher quality</option><option value="balanced">Balanced</option><option value="small">Smaller file</option></select></label>
          <label>Output format<select aria-label="Video output format" disabled={!!busy} value={format} onChange={event => { setFormat(event.target.value as typeof format); invalidate(); }}><option value="auto">Automatic (verified support)</option><option value="mp4">MP4 — H.264 / AAC</option><option value="webm">WebM — VP9 / Opus</option></select></label>
        </Section>
        <Section title="Audio">
          <label className={styles.check}><input type="checkbox" checked={mute} disabled={!!busy || !info.hasAudio} onChange={event => { setMute(event.target.checked); invalidate(); }} />Mute audio</label>
          {!info.hasAudio && <p className={styles.help}>This source has no audio.</p>}
        </Section>
        <Section title="File size" tip={<Tip label="About target size" align="end">Decimal units: 1 MB = 1,000,000 bytes. A target lowers the requested bitrate; it is not an exact size promise.</Tip>}>
          <div className={styles.row}><label>Target (optional)<input aria-label="Target size" type="number" inputMode="decimal" min="0.001" step="any" disabled={!!busy} value={target} onChange={event => { setTarget(event.target.value); invalidate(); }} /></label><label>Units<select aria-label="Target size units" disabled={!!busy} value={unit} onChange={event => { setUnit(event.target.value); invalidate(); }}><option>MB</option><option>KB</option></select></label></div>
          {planning.plan && !planning.plan.targetWithinBudget && <p role="note" className={`${styles.message} ${styles.warn}`}><TriangleAlert aria-hidden />The target is below the estimated minimum bitrate/audio budget at these settings. It may not be met; choose lower resolution or mute if appropriate.</p>}
        </Section>
        <AdvancedDetails>
          <label>Video bitrate (kbps)<input aria-label="Video bitrate (kbps)" type="number" inputMode="numeric" min="100" max="50000" disabled={!!busy} value={bitrate} placeholder="Use quality preset" onChange={event => { setBitrate(event.target.value); invalidate(); }} /></label>
          <p className={styles.help}>Requested average video bitrate. Browser encoders may deviate; this is not a guaranteed size or visual-quality percentage.</p>
        </AdvancedDetails>
      </Panel>
      <div className={styles.results}>
        <Comparison title={result ? "Result" : "File details"} originalLabel="Original video details"
          original={[["Size", `${(file.size / 1000000).toFixed(1)} MB`, bytesLabel(file.size)], ["Container", info.format], ["Dimensions", `${info.width} × ${info.height} px`], ["Duration", `${info.duration.toFixed(3)} seconds`], ["Codecs", `${info.videoCodec.toUpperCase()}${info.audioCodec ? ` / ${info.audioCodec.toUpperCase()}` : " / no audio"}`]]}
          resultTitle="Compressed" resultLabel="Measured video output"
          result={result && [["Size", `${(result.blob.size / 1000000).toFixed(1)} MB`, bytesLabel(result.blob.size)], ["Container", result.blob.type], ["Dimensions", `${result.info.width} × ${result.info.height} px`], ["Duration", `${result.info.duration.toFixed(3)} seconds`], ["Codecs", `${result.info.videoCodec.toUpperCase()}${result.info.audioCodec ? ` / ${result.info.audioCodec.toUpperCase()}` : " / no audio"}`], ["Change", `${(Math.abs(saved)*100).toFixed(1)}% ${result.blob.size <= file.size ? "smaller" : "larger"}`]]}
          change={result ? saved : undefined} />
        {result && settings.targetBytes && <p role="status" className={`${styles.message} ${result.targetMet ? styles.success : styles.warn}`}>{result.targetMet ? <CheckCircle2 aria-hidden /> : <TriangleAlert aria-hidden />}{result.targetMet ? "The measured result meets the target." : "The requested target was not achieved. The measured file is available; try lower resolution or bitrate, or mute audio if appropriate."}</p>}
        {result && outputUrl && <div className={styles.resultBar}>
          <a className={styles.download} href={outputUrl} download={videoOutputName(file.name, result.container)}><Download aria-hidden size={18} />Download compressed video</a>
          <button type="button" className={styles.secondary} onClick={adjust}><SlidersHorizontal aria-hidden size={16} />Adjust settings</button>
          <p className={styles.note}>Downloads a new file. Metadata, subtitles and extra tracks are not preserved.</p>
        </div>}
      </div>
    </div>}
  </section>;
}

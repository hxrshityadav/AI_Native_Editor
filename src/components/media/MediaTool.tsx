"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, AudioWaveform, FileAudio, FileVideo, Scissors, Volume2, VolumeX, type LucideIcon } from "lucide-react";
import type { AudioFormat, MediaInfo, MediaOperation, MediaResult, Peaks } from "@/lib/mediatools/engine";
import { runMediaTask } from "@/lib/mediatools/client";
import { useBlobUrl } from "../tools/useBlobUrl";
import { ControlGroup, DetailsTable, FileDetails, FileDropzone, FilePicker, InlineMessage, PrimaryButton, ProcessingPanel, ResultPanel, SegmentedChoice, Stage, ToolControls, ToolSurface, shortSize, styles, useResultView, type Row } from "../tools/surface/ToolSurface";

/*
 * Shared workspace for the local audio/video utilities. Each tool supplies only its controls and the operation it runs;
 * inspection, processing, progress, cancellation, validation and downloads are common (see src/lib/mediatools).
 */

export type MediaToolId = "trim" | "mute" | "mp4" | "extract" | "audio-convert" | "cutter" | "volume";
type Config = { name: string; icon: LucideIcon; expect: "video" | "audio"; drop: string; accept: string; facts: string; action: string; busyTitle: string; resultTitle: string; download: string };
const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,video/x-matroska,.mkv,.mov,.mp4,.webm";
const AUDIO_ACCEPT = "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.webm,video/mp4,video/webm,video/quicktime,.mov,.mkv";
const CONFIG: Record<MediaToolId, Config> = {
  trim: { name: "Trim Video", icon: Scissors, expect: "video", drop: "Drop a video here", accept: VIDEO_ACCEPT, facts: "MP4, MOV, WebM or MKV", action: "Trim video", busyTitle: "Trimming", resultTitle: "Trimmed", download: "Download trimmed video" },
  mute: { name: "Remove Audio", icon: VolumeX, expect: "video", drop: "Drop a video here", accept: VIDEO_ACCEPT, facts: "MP4, MOV, WebM or MKV", action: "Remove audio", busyTitle: "Removing audio", resultTitle: "Muted", download: "Download muted video" },
  mp4: { name: "Convert to MP4", icon: FileVideo, expect: "video", drop: "Drop a video here", accept: VIDEO_ACCEPT, facts: "MOV, WebM, MKV or MP4", action: "Convert to MP4", busyTitle: "Converting", resultTitle: "MP4", download: "Download MP4" },
  extract: { name: "Extract Audio", icon: AudioLines, expect: "audio", drop: "Drop a video here", accept: VIDEO_ACCEPT, facts: "MP4, MOV, WebM or MKV", action: "Extract audio", busyTitle: "Extracting audio", resultTitle: "Audio", download: "Download audio" },
  "audio-convert": { name: "Audio Converter", icon: FileAudio, expect: "audio", drop: "Drop an audio file here", accept: AUDIO_ACCEPT, facts: "MP3, WAV, M4A, AAC, Ogg, Opus or FLAC", action: "Convert audio", busyTitle: "Converting audio", resultTitle: "Converted", download: "Download audio" },
  cutter: { name: "Audio Cutter", icon: AudioWaveform, expect: "audio", drop: "Drop an audio file here", accept: AUDIO_ACCEPT, facts: "MP3, WAV, M4A, AAC, Ogg, Opus or FLAC", action: "Cut audio", busyTitle: "Cutting audio", resultTitle: "Cut", download: "Download audio" },
  volume: { name: "Increase Volume", icon: Volume2, expect: "audio", drop: "Drop an audio file here", accept: AUDIO_ACCEPT, facts: "Audio, or a video's soundtrack", action: "Change volume", busyTitle: "Processing audio", resultTitle: "Adjusted", download: "Download audio" },
};
const FORMATS: { value: AudioFormat; label: string }[] = [{ value: "m4a", label: "M4A (AAC)" }, { value: "wav", label: "WAV" }, { value: "ogg", label: "Ogg (Opus)" }];
const FORMAT_HINT: Record<AudioFormat, string> = { m4a: "Small and widely playable, including on iPhone.", wav: "Uncompressed and lossless. Large files; plays everywhere.", ogg: "Small Opus audio. Not supported by some older Apple apps." };
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
const baseName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100) || "media";
const SUFFIX: Record<MediaToolId, string> = { trim: "trimmed", mute: "muted", mp4: "converted", extract: "audio", "audio-convert": "converted", cutter: "cut", volume: "louder" };

/** Real waveform from decoded peaks, with the selected range highlighted. */
function Waveform({ peaks, start, end, duration }: { peaks: number[]; start: number; end: number; duration: number }) {
  const max = Math.max(0.01, ...peaks);
  return <svg aria-hidden viewBox={`0 0 ${peaks.length} 100`} preserveAspectRatio="none" className="h-24 w-full">
    <rect x={start / duration * peaks.length} y={0} width={(end - start) / duration * peaks.length} height={100} fill="var(--brand-soft)" />
    {peaks.map((value, index) => { const t = index / peaks.length * duration, h = Math.max(1, value / max * 92); return <rect key={index} x={index} y={50 - h / 2} width={0.8} height={h} fill={t >= start && t <= end ? "var(--brand)" : "var(--edge-strong)"} />; })}
  </svg>;
}

export function RangeControls({ duration, start, end, onChange, media, disabled }: { duration: number; start: number; end: number; onChange: (start: number, end: number) => void; media: React.RefObject<HTMLMediaElement | null>; disabled: boolean }) {
  const set = (nextStart: number, nextEnd: number) => onChange(Math.max(0, Math.min(nextStart, duration)), Math.max(0, Math.min(nextEnd, duration)));
  return <ControlGroup label="Range" aside={<span className={styles.value}>{time(end - start)} selected</span>}>
    <label className={styles.group}><span className={styles.help}>Start {time(start)}</span><input className={styles.range} type="range" aria-label="Start time" min={0} max={duration} step={0.05} value={start} disabled={disabled} onChange={event => set(Math.min(Number(event.target.value), end - 0.1), end)} /></label>
    <label className={styles.group}><span className={styles.help}>End {time(end)}</span><input className={styles.range} type="range" aria-label="End time" min={0} max={duration} step={0.05} value={end} disabled={disabled} onChange={event => set(start, Math.max(Number(event.target.value), start + 0.1))} /></label>
    <div className={styles.row}>
      <label>Start (s)<input className={styles.field} aria-label="Start seconds" type="number" step={0.1} min={0} max={duration} value={Math.round(start * 10) / 10} disabled={disabled} onChange={event => set(Number(event.target.value), end)} /></label>
      <label>End (s)<input className={styles.field} aria-label="End seconds" type="number" step={0.1} min={0} max={duration} value={Math.round(end * 10) / 10} disabled={disabled} onChange={event => set(start, Number(event.target.value))} /></label>
    </div>
    <div className={styles.row}>
      <button type="button" className={styles.secondary} disabled={disabled} onClick={() => media.current && set(Math.min(media.current.currentTime, end - 0.1), end)}>Start at playhead</button>
      <button type="button" className={styles.secondary} disabled={disabled} onClick={() => media.current && set(start, Math.max(media.current.currentTime, start + 0.1))}>End at playhead</button>
    </div>
  </ControlGroup>;
}

export function MediaTool({ tool }: { tool: MediaToolId }) {
  const config = CONFIG[tool];
  const [file, setFile] = useState<File>(), [info, setInfo] = useState<MediaInfo>(), [peaks, setPeaks] = useState<Peaks>();
  const [result, setResult] = useState<MediaResult>(), [busy, setBusy] = useState(""), [progress, setProgress] = useState<number>(), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [start, setStart] = useState(0), [end, setEnd] = useState(0), [mode, setMode] = useState<"fast" | "precise">("fast");
  const [format, setFormat] = useState<AudioFormat>(tool === "audio-convert" ? "wav" : "m4a"), [fadeIn, setFadeIn] = useState(0), [fadeOut, setFadeOut] = useState(0);
  const [gainDb, setGainDb] = useState(6), [normalize, setNormalize] = useState(false);
  const active = useRef<AbortController | null>(null), media = useRef<HTMLMediaElement>(null);
  useEffect(() => () => active.current?.abort(), []);
  const sourceUrl = useBlobUrl(file), outputUrl = useBlobUrl(result?.blob);
  const view = useResultView(!!(result && outputUrl));

  const changed = () => { setResult(undefined); setError(""); setNotice(""); setProgress(undefined); };
  function clear() { active.current?.abort(); active.current = null; setBusy(""); setFile(undefined); setInfo(undefined); setPeaks(undefined); changed(); }
  function cancel() { active.current?.abort(); active.current = null; setBusy(""); setNotice("Cancelled. Your file is unchanged; you can try again."); }
  async function load(files: FileList) {
    clear();
    if (files.length !== 1) { setError("Choose one file at a time."); return; }
    const selected = files[0], controller = new AbortController(); active.current = controller; setBusy("Reading the file…");
    try {
      const inspected = await runMediaTask({ kind: "inspect", file: selected, expect: config.expect }, controller.signal);
      if (controller.signal.aborted) return;
      if (tool !== "extract" && config.expect === "video" && !inspected.video) throw new Error("This file has no video track. Choose a video.");
      setFile(selected); setInfo(inspected); setStart(0); setEnd(inspected.duration);
      if (tool === "cutter") { setBusy("Drawing the waveform…"); const wave = await runMediaTask({ kind: "peaks", file: selected }, controller.signal); if (!controller.signal.aborted) setPeaks(wave); }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "This file could not be read."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }
  const operation = useMemo<MediaOperation>(() => {
    if (tool === "trim") return { kind: "trim", start, end, mode };
    if (tool === "mute") return { kind: "mute" };
    if (tool === "mp4") return { kind: "mp4" };
    if (tool === "cutter") return { kind: "audio", format, edit: { start, end, fadeIn, fadeOut } };
    if (tool === "volume") return { kind: "audio", format, edit: normalize ? { normalize: true } : { gainDb } };
    return { kind: "audio", format };
  }, [tool, start, end, mode, format, fadeIn, fadeOut, gainDb, normalize]);
  async function run() {
    if (!file) return;
    view.showLatest(); changed();
    const controller = new AbortController(); active.current?.abort(); active.current = controller; setBusy("Preparing…");
    try { const output = await runMediaTask({ kind: "process", file, operation }, controller.signal, setProgress, setBusy); if (!controller.signal.aborted) setResult(output); }
    catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Processing failed. Try another file or browser."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }

  if (!info || !file) return <section aria-label={`${config.name} workspace`} className={styles.root}>
    <FileDropzone icon={config.icon} title={config.drop} pickLabel="Choose file" inputLabel="Choose file" accept={config.accept} busy={busy} onCancel={cancel} onFiles={files => void load(files)}
      facts={<><span>{config.facts}</span><span>Up to 512 MiB</span><span>Up to 10 minutes</span></>} />
    {notice && <InlineMessage role="status">{notice}</InlineMessage>}
    {error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}
  </section>;

  const isVideoTool = tool === "trim" || tool === "mute" || tool === "mp4";
  const facts = (value: MediaInfo): Row[] => [["Container", value.mime], ["Duration", `${value.duration.toFixed(2)} s`], ["Size", shortSize(value.size)],
    ...(value.video ? [["Video", `${value.video.codec.toUpperCase()}, ${value.video.width} × ${value.video.height}`] as Row] : []),
    ["Audio", value.audio ? `${value.audio.codec.toUpperCase()}, ${value.audio.channels === 1 ? "mono" : `${value.audio.channels} ch`}, ${(value.audio.sampleRate / 1000).toFixed(1)} kHz` : "None"]];
  const mp4Copy = tool === "mp4" && info.video?.codec === "avc" && (!info.audio || info.audio.codec === "aac");
  const extension = result ? (result.info.mime === "audio/mp4" ? "m4a" : result.info.mime === "audio/wav" ? "wav" : result.info.mime === "audio/ogg" ? "ogg" : result.info.mime === "video/webm" ? "webm" : result.info.mime === "video/x-matroska" ? "mkv" : "mp4") : "";
  const player = (src: string, label: string) => isVideoTool ? <video key={src} ref={media as React.RefObject<HTMLVideoElement>} src={src} controls playsInline preload="metadata" aria-label={label} /> : <audio key={src} ref={media as React.RefObject<HTMLAudioElement>} src={src} controls preload="metadata" aria-label={label} className="w-full" />;

  return <section aria-label={`${config.name} workspace`} className={styles.root}>
    <ToolSurface onFiles={files => void load(files)}
      file={<FileDetails name={file.name} factsLabel="Original details" onStartOver={clear}
        thumb={<span className={`${styles.thumb} grid place-items-center text-brand`} aria-hidden><config.icon size={20} /></span>}
        picker={<FilePicker label="Replace file" inputLabel="Choose file" accept={config.accept} onFiles={files => void load(files)} />}
        facts={<><span>{time(info.duration)}</span>{info.video && <span>{info.video.width} × {info.video.height}</span>}<span>{shortSize(file.size)}<span className="sr-only"> ({file.size.toLocaleString()} bytes)</span></span><span>{info.mime}</span></>} />}
      stage={<Stage plain busy={!!busy} processing={<ProcessingPanel title={config.busyTitle} status={busy} progress={progress} onCancel={cancel} />}>
        <div className="flex w-full flex-col gap-4">
          {result && outputUrl && view.showResult ? <div className={isVideoTool ? styles.pair : "flex flex-col gap-3"}>
            <figure className="flex flex-col gap-2"><span className={styles.note}>Original</span>{sourceUrl && (isVideoTool ? <video src={sourceUrl} controls playsInline preload="metadata" aria-label="Original preview" /> : <audio src={sourceUrl} controls preload="metadata" aria-label="Original preview" className="w-full" />)}</figure>
            <figure className="flex flex-col gap-2"><span className={styles.note}>{config.resultTitle}</span>{isVideoTool ? <video src={outputUrl} controls playsInline preload="metadata" aria-label="Result preview" /> : <audio src={outputUrl} controls preload="metadata" aria-label="Result preview" className="w-full" />}</figure>
          </div> : <>
            {sourceUrl && player(sourceUrl, "Original preview")}
            {peaks && <Waveform peaks={peaks.peaks} start={start} end={end} duration={peaks.duration} />}
          </>}
        </div>
      </Stage>}
      side={result && outputUrl && view.showResult
        ? <ResultPanel headingRef={view.heading} heading={`${config.name} result`} onAdjust={view.adjust} again={{ label: "Another file", onClick: clear }} note="Downloads a new file. Your original is unchanged."
          headline={`${config.resultTitle}: ${time(result.info.duration)}`}
          summary={<>{shortSize(file.size)} → {shortSize(result.blob.size)}. {result.copied ? "Copied without re-encoding, so quality is unchanged." : "Re-encoded in this browser."}</>}
          download={{ href: outputUrl, filename: `${baseName(file.name)}-${SUFFIX[tool]}.${extension}`, label: config.download }}>
          {tool === "trim" && mode === "fast" && Math.abs(result.info.duration - (end - start)) > 0.15 && <InlineMessage role="status" tone="warn" title="Cut moved to keyframes">Fast mode can only cut at keyframes, so the clip is {time(result.info.duration)} instead of {time(end - start)}. Use Precise mode for exact cut points.</InlineMessage>}
          {(result.clipped ?? 0) > 0 && <InlineMessage role="status" tone="warn" title="Peaks were limited">Some peaks would have clipped at this gain, so a limiter softened them. Lower the gain or use Normalize if it sounds harsh.</InlineMessage>}
          {result.appliedGainDb !== undefined && normalize && <InlineMessage role="status" tone="ok" title="Normalized">The loudest peak now sits at -1 dBFS ({result.appliedGainDb > 0 ? "+" : ""}{result.appliedGainDb} dB applied).</InlineMessage>}
          <DetailsTable original={{ title: "Original", label: "Original file", rows: facts(info) }} result={{ title: config.resultTitle, label: "Output details", rows: facts(result.info) }} />
        </ResultPanel>
        : <ToolControls title={`${config.name} settings`} controlsRef={view.controls} action={<>
          {notice && <InlineMessage role="status">{notice}</InlineMessage>}
          {error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}
          <PrimaryButton label={config.action} busyLabel={`${config.busyTitle}…`} busy={!!busy} disabled={(tool === "mute" && !info.audio) || (config.expect === "audio" && !info.audio)} onClick={() => void run()} />
          {view.adjusting && <button type="button" className={`${styles.secondary} ${styles.ghost}`} onClick={view.showLatest}>Back to result</button>}
        </>}>
          {(tool === "trim" || tool === "cutter") && <RangeControls duration={info.duration} start={start} end={end} media={media} disabled={!!busy} onChange={(nextStart, nextEnd) => { setStart(nextStart); setEnd(nextEnd); changed(); }} />}
          {tool === "trim" && <SegmentedChoice legend="Cut mode" name="cut-mode" options={[{ value: "fast", label: "Fast" }, { value: "precise", label: "Precise" }]} value={mode} disabled={!!busy} onChange={value => { setMode(value); changed(); }}
            hint={mode === "fast" ? "Copies the video without re-encoding: quick and lossless, but cuts land on the nearest keyframes, so the clip can start a little early." : "Cuts at exactly the times you choose. Frames near the cuts are re-encoded in this browser, which takes longer."} />}
          {tool === "mute" && <p className={styles.help}>{info.audio ? "The audio track is dropped and the video is copied without re-encoding, so picture quality is unchanged." : "This video has no audio track, so there is nothing to remove."}</p>}
          {tool === "mp4" && <p className={styles.help}>{mp4Copy ? "This video is already H.264 with AAC audio, so it is repackaged into MP4 without re-encoding." : `This ${info.video?.codec.toUpperCase()} video will be re-encoded to H.264${info.audio ? " with AAC audio" : ""} so it plays on almost any device. This takes a while for long videos.`}</p>}
          {config.expect === "audio" && !info.audio && <InlineMessage role="alert" tone="error">This file has no audio track.</InlineMessage>}
          {tool === "volume" && <>
            <SegmentedChoice legend="Adjustment" name="volume-mode" options={[{ value: "gain", label: "Set gain" }, { value: "normalize", label: "Normalize" }]} value={normalize ? "normalize" : "gain"} disabled={!!busy} onChange={value => { setNormalize(value === "normalize"); changed(); }}
              hint={normalize ? "Raises (or lowers) the whole file so its loudest peak reaches -1 dBFS, the most it can gain without clipping." : "A limiter softens any peaks that would clip, so the result never hard-clips."} />
            {!normalize && <label className={styles.group}><span className={styles.label}>Gain<span className={styles.value}>{gainDb > 0 ? "+" : ""}{gainDb} dB</span></span>
              <input className={styles.range} type="range" aria-label="Gain in decibels" min={-12} max={24} step={1} value={gainDb} disabled={!!busy} onChange={event => { setGainDb(Number(event.target.value)); changed(); }} />
              <span className={styles.help}>+6 dB roughly doubles the peak level. Large boosts also raise background noise.</span></label>}
          </>}
          {tool === "cutter" && <div className={styles.row}>
            <label>Fade in (s)<input className={styles.field} aria-label="Fade in seconds" type="number" min={0} max={10} step={0.1} value={fadeIn} disabled={!!busy} onChange={event => { setFadeIn(Math.max(0, Math.min(10, Number(event.target.value)))); changed(); }} /></label>
            <label>Fade out (s)<input className={styles.field} aria-label="Fade out seconds" type="number" min={0} max={10} step={0.1} value={fadeOut} disabled={!!busy} onChange={event => { setFadeOut(Math.max(0, Math.min(10, Number(event.target.value)))); changed(); }} /></label>
          </div>}
          {config.expect === "audio" && <SegmentedChoice legend="Output format" name="audio-format" options={FORMATS} value={format} disabled={!!busy} onChange={value => { setFormat(value); changed(); }} hint={FORMAT_HINT[format]} />}
          {config.expect === "audio" && <p className={styles.help}>MP3 output is not offered: browsers have no MP3 encoder. MP3 files can be opened and converted to M4A, WAV or Ogg.</p>}
        </ToolControls>} />
  </section>;
}

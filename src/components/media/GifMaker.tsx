/* eslint-disable @next/next/no-img-element -- The GIF preview is a local blob URL. */
"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlay } from "lucide-react";
import type { MediaInfo } from "@/lib/mediatools/engine";
import { GIF_LIMITS, type GifOptions, type GifResult } from "@/lib/mediatools/gif";
import { runMediaTask } from "@/lib/mediatools/client";
import { useBlobUrl } from "../tools/useBlobUrl";
import { DetailsTable, FileDetails, FileDropzone, FilePicker, InlineMessage, PrimaryButton, ProcessingPanel, ResultPanel, SegmentedChoice, Stage, ToolControls, ToolSurface, shortSize, styles, useResultView } from "../tools/surface/ToolSurface";
import { RangeControls } from "./MediaTool";

/* Video to GIF: upload -> choose a clip, frame rate, width and colours -> encode frames in a worker -> preview and download. */

const ACCEPT = "video/mp4,video/quicktime,video/webm,video/x-matroska,.mkv,.mov,.mp4,.webm";
const baseName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100) || "clip";

export function GifMaker() {
  const [file, setFile] = useState<File>(), [info, setInfo] = useState<MediaInfo>(), [result, setResult] = useState<GifResult>();
  const [start, setStart] = useState(0), [end, setEnd] = useState(0), [fps, setFps] = useState("12"), [width, setWidth] = useState("480"), [colors, setColors] = useState("128");
  const [busy, setBusy] = useState(""), [progress, setProgress] = useState<number>(), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null), media = useRef<HTMLVideoElement>(null);
  useEffect(() => () => active.current?.abort(), []);
  const sourceUrl = useBlobUrl(file), gifUrl = useBlobUrl(result?.blob);
  const view = useResultView(!!(result && gifUrl));
  const changed = () => { setResult(undefined); setError(""); setNotice(""); setProgress(undefined); };
  function clear() { active.current?.abort(); active.current = null; setBusy(""); setFile(undefined); setInfo(undefined); changed(); }
  function cancel() { active.current?.abort(); active.current = null; setBusy(""); setNotice("Cancelled. Your video is unchanged; you can try again."); }
  async function load(files: FileList) {
    clear();
    if (files.length !== 1) { setError("Choose one video at a time."); return; }
    const selected = files[0], controller = new AbortController(); active.current = controller; setBusy("Reading the video…");
    try {
      const inspected = await runMediaTask({ kind: "inspect", file: selected, expect: "video" }, controller.signal);
      if (controller.signal.aborted) return;
      setFile(selected); setInfo(inspected); setStart(0); setEnd(Math.min(5, inspected.duration));
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "This video could not be read."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }
  const options: GifOptions = { start, end, fps: Number(fps), width: Number(width), colors: Number(colors) as GifOptions["colors"] };
  const frames = Math.max(1, Math.round((end - start) * options.fps));
  const tooLong = end - start > GIF_LIMITS.maxSeconds || frames > GIF_LIMITS.maxFrames;
  async function create() {
    if (!file) return;
    view.showLatest(); changed();
    const controller = new AbortController(); active.current?.abort(); active.current = controller; setBusy("Preparing frames…");
    try { const output = await runMediaTask({ kind: "gif", file, options }, controller.signal, setProgress, setBusy); if (!controller.signal.aborted) setResult(output); }
    catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "The GIF could not be created."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }

  if (!info || !file) return <section aria-label="Video to GIF workspace" className={styles.root}>
    <FileDropzone icon={ImagePlay} title="Drop a video here" pickLabel="Choose file" inputLabel="Choose file" accept={ACCEPT} busy={busy} onCancel={cancel} onFiles={files => void load(files)}
      facts={<><span>MP4, MOV, WebM or MKV</span><span>Clips up to {GIF_LIMITS.maxSeconds} s</span><span>Up to {GIF_LIMITS.maxWidth} px wide</span></>} />
    {notice && <InlineMessage role="status">{notice}</InlineMessage>}
    {error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}
  </section>;

  return <section aria-label="Video to GIF workspace" className={styles.root}>
    <ToolSurface onFiles={files => void load(files)}
      file={<FileDetails name={file.name} factsLabel="Original details" onStartOver={clear}
        thumb={<span className={`${styles.thumb} grid place-items-center text-brand`} aria-hidden><ImagePlay size={20} /></span>}
        picker={<FilePicker label="Replace file" inputLabel="Choose file" accept={ACCEPT} onFiles={files => void load(files)} />}
        facts={<><span>{info.duration.toFixed(1)} s</span><span>{info.video!.width} × {info.video!.height}</span><span>{shortSize(file.size)}</span></>} />}
      stage={<Stage plain busy={!!busy} processing={<ProcessingPanel title="Creating GIF" status={busy} progress={progress} onCancel={cancel} />}>
        {result && gifUrl && view.showResult ? <img src={gifUrl} alt="Animated GIF result" width={result.width} height={result.height} style={{ maxWidth: "100%", height: "auto" }} />
          : sourceUrl && <video ref={media} src={sourceUrl} controls playsInline preload="metadata" aria-label="Original preview" />}
      </Stage>}
      side={result && gifUrl && view.showResult
        ? <ResultPanel headingRef={view.heading} heading="GIF result" onAdjust={view.adjust} again={{ label: "Another video", onClick: clear }} note="Downloads a new file. Your video is unchanged."
          headline={`${result.frames} frames, ${shortSize(result.blob.size)}`}
          summary={<>{result.width} × {result.height} px at {result.fps} fps, loops forever.</>}
          download={{ href: gifUrl, filename: `${baseName(file.name)}.gif`, label: "Download GIF" }}>
          {result.blob.size > 10 * 1024 * 1024 && <InlineMessage role="status" tone="warn" title="Large GIF">Many sites limit GIFs to 10 MB or less. A smaller width, fewer frames per second or fewer colours will shrink it.</InlineMessage>}
          <DetailsTable original={{ title: "Video", label: "Original file", rows: [["Clip", `${start.toFixed(1)}–${end.toFixed(1)} s`], ["Dimensions", `${info.video!.width} × ${info.video!.height}`], ["Size", shortSize(file.size)]] }}
            result={{ title: "GIF", label: "Output details", rows: [["Dimensions", `${result.width} × ${result.height} px`], ["Frames", `${result.frames} at ${result.fps} fps`], ["Length", `${result.duration.toFixed(1)} s`], ["Size", shortSize(result.blob.size)]] }} />
        </ResultPanel>
        : <ToolControls title="GIF settings" controlsRef={view.controls} action={<>
          {notice && <InlineMessage role="status">{notice}</InlineMessage>}
          {error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}
          <p className={styles.help}>{frames} frames at about {Math.min(Number(width), info.video!.width)} px wide.</p>
          <PrimaryButton label="Create GIF" busyLabel="Creating…" busy={!!busy} disabled={tooLong} onClick={() => void create()} />
          {view.adjusting && <button type="button" className={`${styles.secondary} ${styles.ghost}`} onClick={view.showLatest}>Back to result</button>}
        </>}>
          <RangeControls duration={info.duration} start={start} end={end} media={media} disabled={!!busy} onChange={(nextStart, nextEnd) => { setStart(nextStart); setEnd(nextEnd); changed(); }} />
          {tooLong && <InlineMessage role="alert" tone="error">Choose at most {GIF_LIMITS.maxSeconds} seconds and {GIF_LIMITS.maxFrames} frames. Shorten the clip or lower the frame rate.</InlineMessage>}
          <SegmentedChoice legend="Frames per second" name="gif-fps" options={["8", "12", "15", "20"].map(value => ({ value, label: value }))} value={fps} disabled={!!busy} onChange={value => { setFps(value); changed(); }} hint="Higher is smoother but larger. 12 suits most clips." />
          <SegmentedChoice legend="Width" name="gif-width" options={["240", "360", "480", "640"].map(value => ({ value, label: `${value}` }))} value={width} disabled={!!busy} onChange={value => { setWidth(value); changed(); }} hint="In pixels. Smaller videos are never enlarged." />
          <SegmentedChoice legend="Colours" name="gif-colors" options={[{ value: "64", label: "64" }, { value: "128", label: "128" }, { value: "256", label: "256" }]} value={colors} disabled={!!busy} onChange={value => { setColors(value); changed(); }} hint="GIFs hold at most 256 colours per frame. Fewer colours means a smaller file with more banding." />
          <p className={styles.help}>GIF has no sound and compresses poorly; for longer or sharper clips, an MP4 is usually far smaller.</p>
        </ToolControls>} />
  </section>;
}

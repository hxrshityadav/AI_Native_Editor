"use client";
import { useEffect, useRef, useState } from "react";
import { Video } from "lucide-react";
import type { MediaInfo } from "@/lib/mediatools/engine";
import { SHAPES, type AudioVideoOptions, type AudioVideoResult } from "@/lib/mediatools/audiovideo";
import { runMediaTask } from "@/lib/mediatools/client";
import { useBlobUrl } from "../tools/useBlobUrl";
import { DetailsTable, FileDetails, FileDropzone, FilePicker, InlineMessage, PrimaryButton, ProcessingPanel, ResultPanel, SegmentedChoice, Stage, ToolControls, ToolSurface, shortSize, styles, useResultView } from "../tools/surface/ToolSurface";

/* Audio to Video: upload audio -> choose shape, background and colours -> encode an MP4 with a level visualiser -> download. */

const ACCEPT = "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,video/mp4,video/webm,video/quicktime";
const SHAPE_OPTIONS = [{ value: "square", label: "Square" }, { value: "landscape", label: "Landscape" }, { value: "portrait", label: "Portrait" }] as const;
const baseName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100) || "audio";

export function AudioToVideo() {
  const [file, setFile] = useState<File>(), [info, setInfo] = useState<MediaInfo>(), [result, setResult] = useState<AudioVideoResult>();
  const [shape, setShape] = useState<AudioVideoOptions["shape"]>("square"), [background, setBackground] = useState("#101418"), [accent, setAccent] = useState("#34d399"), [image, setImage] = useState<File>();
  const [busy, setBusy] = useState(""), [progress, setProgress] = useState<number>(), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const sourceUrl = useBlobUrl(file), imageUrl = useBlobUrl(image), videoUrl = useBlobUrl(result?.blob);
  const view = useResultView(!!(result && videoUrl));
  const changed = () => { setResult(undefined); setError(""); setNotice(""); setProgress(undefined); };
  function clear() { active.current?.abort(); active.current = null; setBusy(""); setFile(undefined); setInfo(undefined); setImage(undefined); changed(); }
  function cancel() { active.current?.abort(); active.current = null; setBusy(""); setNotice("Cancelled. Your audio is unchanged; you can try again."); }
  async function load(files: FileList) {
    clear();
    if (files.length !== 1) { setError("Choose one audio file at a time."); return; }
    const selected = files[0], controller = new AbortController(); active.current = controller; setBusy("Reading the audio…");
    try { const inspected = await runMediaTask({ kind: "inspect", file: selected, expect: "audio" }, controller.signal); if (!controller.signal.aborted) { setFile(selected); setInfo(inspected); } }
    catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "This file could not be read."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }
  async function create() {
    if (!file) return;
    view.showLatest(); changed();
    const controller = new AbortController(); active.current?.abort(); active.current = controller; setBusy("Preparing…");
    try { const output = await runMediaTask({ kind: "audiovideo", file, options: { shape, background, accent, image } }, controller.signal, setProgress, setBusy); if (!controller.signal.aborted) setResult(output); }
    catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "The video could not be created."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }

  if (!info || !file) return <section aria-label="Audio to Video workspace" className={styles.root}>
    <FileDropzone icon={Video} title="Drop an audio file here" pickLabel="Choose file" inputLabel="Choose file" accept={ACCEPT} busy={busy} onCancel={cancel} onFiles={files => void load(files)}
      facts={<><span>MP3, WAV, M4A, Ogg or FLAC</span><span>Up to 10 minutes</span><span>MP4 output</span></>} />
    {notice && <InlineMessage role="status">{notice}</InlineMessage>}
    {error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}
  </section>;

  const [width, height] = SHAPES[shape];
  return <section aria-label="Audio to Video workspace" className={styles.root}>
    <ToolSurface onFiles={files => void load(files)}
      file={<FileDetails name={file.name} factsLabel="Original details" onStartOver={clear}
        thumb={<span className={`${styles.thumb} grid place-items-center text-brand`} aria-hidden><Video size={20} /></span>}
        picker={<FilePicker label="Replace file" inputLabel="Choose file" accept={ACCEPT} onFiles={files => void load(files)} />}
        facts={<><span>{info.duration.toFixed(1)} s</span><span>{info.audio?.codec.toUpperCase()}</span><span>{shortSize(file.size)}</span></>} />}
      stage={<Stage plain busy={!!busy} processing={<ProcessingPanel title="Creating video" status={busy} progress={progress} onCancel={cancel} />}>
        {result && videoUrl && view.showResult ? <video src={videoUrl} controls playsInline preload="metadata" aria-label="Result preview" />
          : <div className="flex w-full flex-col items-center gap-4">
            {/* Static layout preview: the real bars follow the audio's measured level in the exported video. */}
            <div aria-label="Layout preview" role="img" className="relative w-full max-w-sm overflow-hidden rounded-md" style={{ aspectRatio: `${width} / ${height}`, background: imageUrl ? `center / cover url(${imageUrl})` : background }}>
              <div className="absolute inset-x-[10%] bottom-[22%] flex h-[32%] items-end gap-[1%]">{Array.from({ length: 24 }, (_, i) => <span key={i} className="flex-1 rounded-sm" style={{ height: `${20 + ((i * 37) % 70)}%`, background: accent }} />)}</div>
            </div>
            {sourceUrl && <audio src={sourceUrl} controls preload="metadata" aria-label="Original preview" className="w-full max-w-md" />}
          </div>}
      </Stage>}
      side={result && videoUrl && view.showResult
        ? <ResultPanel headingRef={view.heading} heading="Audio to video result" onAdjust={view.adjust} again={{ label: "Another file", onClick: clear }} note="Downloads a new file. Your audio is unchanged."
          headline={`MP4, ${result.width} × ${result.height}`} summary={<>{result.duration.toFixed(1)} s with H.264 video and AAC audio, {shortSize(result.blob.size)}.</>}
          download={{ href: videoUrl, filename: `${baseName(file.name)}-video.mp4`, label: "Download MP4" }}>
          <DetailsTable original={{ title: "Audio", label: "Original file", rows: [["Length", `${info.duration.toFixed(2)} s`], ["Codec", info.audio?.codec.toUpperCase() ?? "-"], ["Size", shortSize(file.size)]] }}
            result={{ title: "Video", label: "Output details", rows: [["Dimensions", `${result.width} × ${result.height}`], ["Length", `${result.duration.toFixed(2)} s`], ["Frame rate", "24 fps"], ["Size", shortSize(result.blob.size)]] }} />
        </ResultPanel>
        : <ToolControls title="Video settings" controlsRef={view.controls} action={<>
          {notice && <InlineMessage role="status">{notice}</InlineMessage>}
          {error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}
          <PrimaryButton label="Create video" busyLabel="Creating…" busy={!!busy} onClick={() => void create()} />
          {view.adjusting && <button type="button" className={`${styles.secondary} ${styles.ghost}`} onClick={view.showLatest}>Back to result</button>}
        </>}>
          <SegmentedChoice legend="Shape" name="video-shape" options={SHAPE_OPTIONS.map(option => ({ ...option }))} value={shape} disabled={!!busy} onChange={value => { setShape(value); changed(); }} hint={`${width} × ${height} pixels at 24 fps.`} />
          <label className={styles.label}>Background colour<input className={styles.field} type="color" disabled={!!busy || !!image} value={background} onChange={event => { setBackground(event.target.value); changed(); }} /></label>
          <div className={styles.group}>
            <span className={styles.label}>Background image <span className={styles.help}>Optional</span></span>
            <div className={styles.row}>
              <FilePicker label={image ? "Replace image" : "Add image"} inputLabel="Background image" accept="image/jpeg,image/png,image/webp" onFiles={files => { if (files[0]) { setImage(files[0]); changed(); } }} />
              {image && <button type="button" className={styles.secondary} onClick={() => { setImage(undefined); changed(); }}>Remove image</button>}
            </div>
            <p className={styles.help}>The image fills the frame and is cropped to fit.</p>
          </div>
          <label className={styles.label}>Visualiser colour<input className={styles.field} type="color" disabled={!!busy} value={accent} onChange={event => { setAccent(event.target.value); changed(); }} /></label>
          <p className={styles.help}>The bars follow the audio&apos;s measured loudness, frame by frame. Encoding takes roughly as long as the audio on a typical laptop.</p>
        </ToolControls>} />
  </section>;
}

/* eslint-disable @next/next/no-img-element -- Previews are local blob URLs; images never go through a server optimizer. */
"use client";
import { useRef, useState } from "react";
import { ImageUp, Link2, Link2Off } from "lucide-react";
import { IMAGE_FORMATS, fitWithin, outputName, pairedDimensions, type ImageFormat } from "@/lib/images/policy";
import { useBlobUrl } from "../tools/useBlobUrl";
import { AdvancedSettings, BeforeAfterComparison, ControlGroup, TargetSizeInput, DetailsTable, FileDetails, FileDropzone, FilePicker, InlineMessage, PrimaryButton, ProcessingPanel, QualityControl, ResultPanel, SegmentedChoice, SideBySide, Stage, ToolControls, ToolSurface, shortSize, styles, useResultView } from "../tools/surface/ToolSurface";
import { useImageJob } from "./useImageJob";

/* Image Resizer: upload -> set dimensions (previewed live) -> resize -> download. */

const sizeLabel = (size: number) => size < 1000 ? `${size} bytes` : `${(size / 1000).toFixed(2)} KB (${size.toLocaleString()} bytes)`;
const FORMATS: { value: ImageFormat | "original"; label: string }[] = [{ value: "original", label: "Original" }, { value: "image/jpeg", label: "JPEG" }, { value: "image/png", label: "PNG" }, { value: "image/webp", label: "WebP" }];
const SCALES = [25, 50, 75];
const ACCEPT = "image/jpeg,image/png,image/webp";

export function ImageResizer() {
  const job = useImageJob(), { file, info, result, busy } = job;
  const [width, setWidth] = useState(0), [height, setHeight] = useState(0), [locked, setLocked] = useState(true), [preset, setPreset] = useState("");
  const [choice, setChoice] = useState<ImageFormat | "original">("original"), [quality, setQuality] = useState(0.82);
  const [mode, setMode] = useState<"dimensions" | "percent">("dimensions"), [percent, setPercent] = useState(100);
  const [target, setTarget] = useState(""), [unit, setUnit] = useState<"KB" | "MB">("KB");
  const ratio = useRef({ width: 1, height: 1 });
  const inputUrl = useBlobUrl(info?.preview), outputUrl = useBlobUrl(result?.preview), downloadUrl = useBlobUrl(result?.blob);
  const view = useResultView(!!(result && downloadUrl));
  const format: ImageFormat = choice === "original" ? info?.format ?? "image/png" : choice;
  const targetBytes = target !== "" && format !== "image/png" ? Number(target) * (unit === "MB" ? 1000000 : 1000) : undefined;

  const load = (files: FileList) => void job.load(files, image => { setWidth(image.width); setHeight(image.height); setLocked(true); setPreset(""); setChoice("original"); setMode("dimensions"); setPercent(100); ratio.current = { width: image.width, height: image.height }; });
  function dimension(edge: "width" | "height", value: number) {
    job.invalidate(); setPreset(""); const next = pairedDimensions(locked ? ratio.current.width : width, locked ? ratio.current.height : height, edge, value, locked);
    setWidth(next.width); setHeight(next.height);
  }
  function fit(next: { width: number; height: number }) { if (!info) return; setWidth(next.width); setHeight(next.height); setLocked(true); ratio.current = { width: info.width, height: info.height }; job.invalidate(); }
  /** Percentage mode scales both sides from the original, so the shape never changes. */
  function scale(value: number) { if (!info || !Number.isFinite(value)) return; setPercent(value); setPreset(""); fit({ width: Math.max(1, Math.round(info.width * value / 100)), height: Math.max(1, Math.round(info.height * value / 100)) }); }
  function resize() { view.showLatest(); void job.run(() => {
    if (targetBytes !== undefined && (!Number.isFinite(targetBytes) || targetBytes < 1 || targetBytes > 64 * 1024 * 1024)) throw new Error("Enter a positive target size, up to 67,108 KB, or leave it empty.");
    return { width, height, quality, format, targetBytes, background: "#ffffff" };
  }, targetBytes !== undefined ? "Resizing, then searching for the best quality under your target…" : "Resizing the image and measuring the result…"); }

  if (!info || !file) return <section aria-label="Image Resizer workspace" className={styles.root}>
    <FileDropzone icon={ImageUp} title="Drop your image here" pickLabel="Choose image" accept={ACCEPT} busy={busy} onCancel={job.cancel} onFiles={load}
      facts={<><span><b>JPEG</b>, <b>PNG</b> or <b>WebP</b></span><span>Up to 25 MiB</span><span>Up to 8192 px per side</span></>} />
    {job.notice && <InlineMessage role="status">{job.notice}</InlineMessage>}
    {job.error && <InlineMessage role="alert" tone="error">{job.error}</InlineMessage>}
  </section>;

  const upscaling = width > info.width || height > info.height;
  const sameShape = !!(result && Math.abs(result.width / result.height - info.width / info.height) < 0.01);
  const validPreview = width > 0 && height > 0;
  return <section aria-label="Image Resizer workspace" className={styles.root}>
    <ToolSurface onFiles={load}
      file={<FileDetails name={file.name} factsLabel="Original details" onStartOver={job.reset}
        thumb={inputUrl ? <img className={styles.thumb} src={inputUrl} alt="" width={48} height={48} /> : <span className={styles.thumb} />}
        picker={<FilePicker label="Replace image" inputLabel="Choose image" accept={ACCEPT} onFiles={load} />}
        facts={<><span>{info.width} × {info.height} px</span><span>{shortSize(file.size)}<span className="sr-only"> ({file.size.toLocaleString()} bytes)</span></span><span>{IMAGE_FORMATS[info.format].label}</span>{info.transparent && <span>Transparency detected</span>}</>} />}
      stage={<Stage busy={!!busy} processing={<ProcessingPanel title="Resizing" status={busy} onCancel={job.cancel} />}>
        {outputUrl && inputUrl && sameShape ? <BeforeAfterComparison original={inputUrl} result={outputUrl} resultTag="Resized" resultAlt="Resized image preview" />
          : outputUrl && inputUrl ? <SideBySide original={inputUrl} result={outputUrl} resultTag="Resized" resultAlt="Resized image preview" />
          : inputUrl && <>
            {/* Live preview of the chosen shape: an unlocked ratio shows the stretch before anything is encoded. */}
            <img src={inputUrl} alt="Original image preview" style={validPreview ? { aspectRatio: `${width} / ${height}`, objectFit: "fill", width: width >= height ? "min(100%, 40rem)" : "auto", height: width >= height ? "auto" : "min(100%, 30rem)" } : undefined} />
            {validPreview && <span className={styles.badge}>{info.width} × {info.height}<span>→</span>{width} × {height} px</span>}
          </>}
      </Stage>}
      side={result && downloadUrl && view.showResult
        ? <ResultPanel headingRef={view.heading} heading="Resize result" onAdjust={view.adjust} note="Downloads a new file. Your original is unchanged."
          headline={<>{result.width} × {result.height} px</>}
          summary={<>From {info.width} × {info.height} px. File size {shortSize(file.size)} → {shortSize(result.blob.size)}.</>}
          download={{ href: downloadUrl, filename: outputName(file.name, "resizer", result.format), label: "Download resized image" }}>
          {targetBytes !== undefined && <InlineMessage role="status" tone={result.targetMet ? "ok" : "warn"} title={result.targetMet ? "Target achieved" : "Closest possible result"}>{result.targetMet ? `The measured output is within ${target} ${unit}.` : `The smallest tested output is ${sizeLabel(result.blob.size)}. Try smaller dimensions.`}</InlineMessage>}
          <DetailsTable
            original={{ title: "Original", label: "Original file", rows: [["Dimensions", `${info.width} × ${info.height} px`], ["Size", shortSize(file.size), sizeLabel(file.size)], ["Format", IMAGE_FORMATS[info.format].label]] }}
            result={{ title: "Resized", label: "Output details", rows: [["Dimensions", `${result.width} × ${result.height} px`], ["Size", shortSize(result.blob.size), sizeLabel(result.blob.size)], ["Format", IMAGE_FORMATS[result.format].label], ["Scale", `${Math.round(result.width / info.width * 100)}% wide, ${Math.round(result.height / info.height * 100)}% tall`]] }} />
        </ResultPanel>
        : <ToolControls title="Resize settings" controlsRef={view.controls} action={<>
          {job.notice && <InlineMessage role="status">{job.notice}</InlineMessage>}
          {job.error && <InlineMessage role="alert" tone="error">{job.error}</InlineMessage>}
          <PrimaryButton label="Resize image" busyLabel="Resizing…" busy={!!busy} onClick={resize} />
          {view.adjusting && <button type="button" className={`${styles.secondary} ${styles.ghost}`} onClick={view.showLatest}>Back to result</button>}
        </>}>
          <SegmentedChoice legend="Resize by" name="resize-mode" options={[{ value: "dimensions", label: "Dimensions" }, { value: "percent", label: "Percentage" }]} value={mode} disabled={!!busy}
            onChange={value => { setMode(value); if (value === "percent") scale(Math.round(width / info.width * 100) || 100); }} />
          {mode === "dimensions" ? <>
            <ControlGroup label="New size">
              <div className={styles.dims}>
                <label>Width (px)<input className={styles.field} type="number" inputMode="numeric" min={1} max={8192} step={1} disabled={!!busy} value={width || ""} onChange={event => dimension("width", Number(event.target.value))} /></label>
                <button type="button" className={styles.link} aria-pressed={locked} aria-label={`Aspect ratio ${locked ? "locked" : "unlocked"}`} title={locked ? "Unlock to set width and height independently" : "Lock to keep the original proportions"} disabled={!!busy}
                  onClick={() => { if (!locked) ratio.current = width > 0 && height > 0 ? { width, height } : { width: info.width, height: info.height }; setLocked(!locked); job.invalidate(); }}>{locked ? <Link2 aria-hidden size={18} /> : <Link2Off aria-hidden size={18} />}</button>
                <label>Height (px)<input className={styles.field} type="number" inputMode="numeric" min={1} max={8192} step={1} disabled={!!busy} value={height || ""} onChange={event => dimension("height", Number(event.target.value))} /></label>
              </div>
              <p className={styles.help}>{locked ? "Proportions locked: changing one side updates the other." : "Proportions unlocked: the image will be stretched to fit both values."}</p>
            </ControlGroup>
            <label className={styles.group}><span className={styles.label}>Fit inside a square</span>
              <select className={styles.field} aria-label="Fit preset" value={preset} disabled={!!busy} onChange={event => { setPreset(event.target.value); if (event.target.value) { const bound = Number(event.target.value); fit(fitWithin(info.width, info.height, bound, bound)); } }}>
                <option value="">Custom dimensions</option><option value="1920">Fit within 1920 × 1920</option><option value="1080">Fit within 1080 × 1080</option><option value="800">Fit within 800 × 800</option><option value="400">Fit within 400 × 400</option>
              </select>
              <span className={styles.help}>Keeps the whole image without cropping.</span>
            </label>
          </> : <ControlGroup label="Scale" aside={<span className={styles.value}>{width} × {height} px</span>}>
            <div className={styles.qualityRow}>
              <input className={styles.range} aria-label="Scale" type="range" min={1} max={200} step={1} value={percent} disabled={!!busy} onChange={event => scale(Number(event.target.value))} />
              <span className={styles.percent}><input className={styles.field} aria-label="Scale (%)" type="number" inputMode="numeric" min={1} max={400} step={1} value={percent} disabled={!!busy} onChange={event => { const value = Number(event.target.value); if (value >= 1 && value <= 400) scale(value); }} /><span aria-hidden>%</span></span>
            </div>
            <div role="group" aria-label="Common scales" className={styles.chips}>{SCALES.map(value => <button key={value} type="button" disabled={!!busy} aria-pressed={percent === value} onClick={() => scale(value)}>{value}%</button>)}</div>
            <p className={styles.help}>Both sides scale together from the original {info.width} × {info.height} px.</p>
          </ControlGroup>}
          <p className={styles.help}>Need a specific file size? The <a href="/tools/image-compressor" className="text-ink underline">Image Compressor</a> searches for a target in KB or MB.</p>
          {upscaling && <InlineMessage role="note" tone="warn">Upscaling increases dimensions but cannot restore missing detail.</InlineMessage>}
          <AdvancedSettings title="Format, quality and file size">
            <SegmentedChoice legend="Output format" name="output-format" options={FORMATS} value={choice} disabled={!!busy} onChange={value => { setChoice(value); job.invalidate(); }} hint={choice === "original" ? `Keeps ${IMAGE_FORMATS[info.format].label}.` : undefined} />
            <QualityControl value={quality} disabled={!!busy} lossless={format === "image/png"} onChange={value => { setQuality(value); job.invalidate(); }} />
            {format !== "image/png" && <ControlGroup label="Target file size" aside={<span className={styles.help}>Optional</span>}>
              <TargetSizeInput inputLabel={`Target size (${unit}, optional)`} unitLabel="Target size unit" value={target} unit={unit} units={["KB", "MB"]} disabled={!!busy} onValue={value => { setTarget(value); job.invalidate(); }} onUnit={value => { setUnit(value); job.invalidate(); }} />
              <p className={styles.help}>At the new dimensions, the tool searches for the highest quality that fits. It reports the closest result if the target can&apos;t be reached.</p>
            </ControlGroup>}
            <p className={styles.help}>Orientation is applied where the browser supports it. Other metadata is removed. Transparent areas turn white only if you choose JPEG.</p>
          </AdvancedSettings>
        </ToolControls>} />
  </section>;
}

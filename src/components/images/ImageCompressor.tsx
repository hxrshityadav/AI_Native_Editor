/* eslint-disable @next/next/no-img-element -- Previews are local blob URLs; images never go through a server optimizer. */
"use client";
import { useState } from "react";
import { ImageUp } from "lucide-react";
import { IMAGE_FORMATS, fitWithin, outputName, type ImageFormat } from "@/lib/images/policy";
import { useBlobUrl } from "../tools/useBlobUrl";
import { AdvancedSettings, BeforeAfterComparison, ControlGroup, DetailsTable, FileDetails, FileDropzone, FilePicker, InlineMessage, PrimaryButton, ProcessingPanel, QualityControl, ResultPanel, SegmentedChoice, SideBySide, Stage, TargetSizeInput, ToolControls, ToolSurface, shortSize, styles, useResultView, type Row } from "../tools/surface/ToolSurface";
import { useImageJob } from "./useImageJob";

/* Image Compressor, the reference tool page: upload -> configure -> compress -> compare -> download. */

const sizeLabel = (size: number) => size < 1000 ? `${size} bytes` : `${(size / 1000).toFixed(2)} KB (${size.toLocaleString()} bytes)`;
const FORMATS: { value: ImageFormat | "original"; label: string }[] = [{ value: "original", label: "Original" }, { value: "image/jpeg", label: "JPEG" }, { value: "image/png", label: "PNG" }, { value: "image/webp", label: "WebP" }];
const TARGETS: [number, "KB" | "MB"][] = [[50, "KB"], [100, "KB"], [200, "KB"], [500, "KB"], [1, "MB"]];
const EDGES = [3840, 2560, 1920, 1280, 1080, 800];
const ACCEPT = "image/jpeg,image/png,image/webp";

export function ImageCompressor() {
  const job = useImageJob(), { file, info, result, busy } = job;
  const [choice, setChoice] = useState<ImageFormat | "original">("image/webp");
  const [quality, setQuality] = useState(0.82), [target, setTarget] = useState(""), [unit, setUnit] = useState<"KB" | "MB">("KB");
  const [maxEdge, setMaxEdge] = useState(""), [background, setBackground] = useState("#ffffff");
  const inputUrl = useBlobUrl(info?.preview), outputUrl = useBlobUrl(result?.preview), downloadUrl = useBlobUrl(result?.blob);
  const view = useResultView(!!(result && downloadUrl));

  const format: ImageFormat = choice === "original" ? info?.format ?? "image/webp" : choice;
  const targetBytes = target !== "" ? Number(target) * (unit === "MB" ? 1000000 : 1000) : undefined;
  const load = (files: FileList) => void job.load(files, () => { setChoice("image/webp"); setMaxEdge(""); });
  const edit = <T,>(set: (value: T) => void) => (value: T) => { set(value); job.invalidate(); };
  function compress() {
    view.showLatest();
    void job.run(image => {
      if (targetBytes !== undefined && (!Number.isFinite(targetBytes) || targetBytes < 1 || targetBytes > 64 * 1024 * 1024)) throw new Error("Enter a positive target size, up to 67,108 KB, or leave it empty.");
      const size = maxEdge ? fitWithin(image.width, image.height, Number(maxEdge), Number(maxEdge)) : image;
      return { width: size.width, height: size.height, quality, format, targetBytes, background };
    }, targetBytes !== undefined && format !== "image/png" ? "Searching for the best quality under your target…" : "Encoding the image and measuring the result…");
  }

  if (!info || !file) return <section aria-label="Image Compressor workspace" className={styles.root}>
    <FileDropzone icon={ImageUp} title="Drop your image here" pickLabel="Choose image" accept={ACCEPT} busy={busy} onCancel={job.cancel} onFiles={load}
      facts={<><span><b>JPEG</b>, <b>PNG</b> or <b>WebP</b></span><span>Up to 25 MiB</span><span>Up to 16 megapixels</span></>} />
    {job.notice && <InlineMessage role="status">{job.notice}</InlineMessage>}
    {job.error && <InlineMessage role="alert" tone="error">{job.error}</InlineMessage>}
  </section>;

  const change = result ? 1 - result.blob.size / file.size : 0;
  const sameShape = !!(result && Math.abs(result.width / result.height - info.width / info.height) < 0.01);
  return <section aria-label="Image Compressor workspace" className={styles.root}>
    <ToolSurface onFiles={load}
      file={<FileDetails name={file.name} factsLabel="Original details" onStartOver={job.reset}
        thumb={inputUrl ? <img className={styles.thumb} src={inputUrl} alt="" width={48} height={48} /> : <span className={styles.thumb} />}
        picker={<FilePicker label="Replace image" inputLabel="Choose image" accept={ACCEPT} onFiles={load} />}
        facts={<><span>{shortSize(file.size)}<span className="sr-only"> ({file.size.toLocaleString()} bytes)</span></span><span>{info.width} × {info.height} px</span><span>{IMAGE_FORMATS[info.format].label}</span>{info.transparent && <span>Transparency detected</span>}</>} />}
      stage={<Stage busy={!!busy} processing={<ProcessingPanel title="Compressing" status={busy} onCancel={job.cancel} />}>
        {outputUrl && inputUrl && sameShape ? <BeforeAfterComparison original={inputUrl} result={outputUrl} resultTag="Compressed" resultAlt="Compressed image preview" />
          : outputUrl && inputUrl ? <SideBySide original={inputUrl} result={outputUrl} resultTag="Compressed" resultAlt="Compressed image preview" />
          : inputUrl && <img src={inputUrl} alt="Original image preview" />}
      </Stage>}
      side={result && downloadUrl && view.showResult
        ? <ResultPanel headingRef={view.heading} heading="Compression result" change={change} onAdjust={view.adjust} note="Downloads a new file. Your original is unchanged."
          summary={<>{shortSize(file.size)} → {shortSize(result.blob.size)}{change > 0 ? `, ${shortSize(file.size - result.blob.size)} smaller` : ""}</>}
          download={{ href: downloadUrl, filename: outputName(file.name, "compressor", result.format), label: "Download compressed image" }}>
          {targetBytes !== undefined && <InlineMessage role="status" tone={result.targetMet ? "ok" : "warn"}>{result.targetMet ? "The measured output meets your target size." : `The target size was not met. The smallest tested output is ${sizeLabel(result.blob.size)}. Try the Image Resizer or a different output format.`}</InlineMessage>}
          {change <= 0 && <InlineMessage tone="warn">This image was already well compressed. Try WebP, a lower quality or smaller dimensions.</InlineMessage>}
          <DetailsTable
            original={{ title: "Original", label: "Original file", rows: [["Size", shortSize(file.size), sizeLabel(file.size)], ["Dimensions", `${info.width} × ${info.height} px`], ["Format", IMAGE_FORMATS[info.format].label]] }}
            result={{ title: "Compressed", label: "Output details", rows: [
              ["Size", shortSize(result.blob.size), sizeLabel(result.blob.size)], ["Dimensions", `${result.width} × ${result.height} px`], ["Format", IMAGE_FORMATS[result.format].label],
              ["Change", `${Math.abs(change * 100).toFixed(1)}% ${change >= 0 ? "smaller" : "larger"}`],
              ...(result.format !== "image/png" ? [["Quality", `Encoded at ${Math.round(result.quality * 100)}% quality`] as Row] : []),
              ...(targetBytes !== undefined ? [["Target", `${target} ${unit} requested`, result.targetMet ? "Reached" : "Not reached"] as Row] : []),
            ] }} />
        </ResultPanel>
        : <ToolControls title="Compression settings" controlsRef={view.controls} action={<>
          {job.notice && <InlineMessage role="status">{job.notice}</InlineMessage>}
          {job.error && <InlineMessage role="alert" tone="error">{job.error}</InlineMessage>}
          <PrimaryButton label="Compress image" busyLabel="Compressing…" busy={!!busy} onClick={compress} />
          {view.adjusting && <button type="button" className={`${styles.secondary} ${styles.ghost}`} onClick={view.showLatest}>Back to result</button>}
        </>}>
          <SegmentedChoice legend="Output format" name="output-format" options={FORMATS} value={choice} disabled={!!busy} onChange={edit(setChoice)}
            hint={choice === "original" ? `Keeps ${IMAGE_FORMATS[info.format].label}.` : format === "image/webp" ? "Usually the smallest for photos. Keeps transparency." : format === "image/jpeg" ? "Opens everywhere. No transparency." : "Lossless. Best for screenshots and graphics; rarely smaller."} />
          <QualityControl value={quality} disabled={!!busy} lossless={format === "image/png"} onChange={edit(setQuality)} />
          {info.transparent && format === "image/jpeg" && <ControlGroup>
            <InlineMessage role="note" tone="warn">JPEG cannot preserve transparency. Transparent pixels will be blended onto the background colour below.</InlineMessage>
            <label className={styles.label}>JPEG background<input className={styles.field} type="color" disabled={!!busy} value={background} onChange={event => edit(setBackground)(event.target.value)} /></label>
          </ControlGroup>}
          <ControlGroup label="Target size" aside={<span className={styles.help}>Optional</span>}>
            <TargetSizeInput inputLabel={`Target size (${unit}, optional)`} unitLabel="Target size unit" value={target} unit={unit} units={["KB", "MB"]} presets={TARGETS} disabled={!!busy} onValue={edit(setTarget)} onUnit={edit(setUnit)} />
            <p className={styles.help}>We&apos;ll find the closest result we can at the best quality. An exact size isn&apos;t always possible.</p>
            {targetBytes !== undefined && format === "image/png" && <InlineMessage role="note" tone="warn">PNG is lossless, so a target size can&apos;t be pursued. Choose WebP or JPEG to aim for a size.</InlineMessage>}
            {targetBytes !== undefined && format !== "image/png" && targetBytes >= file.size && <p role="note" className={styles.help}>This target is larger than the original ({shortSize(file.size)}), so any compressed result will meet it.</p>}
          </ControlGroup>
          <AdvancedSettings>
            <label className={styles.group}><span className={styles.label}>Maximum dimensions</span>
              <select className={styles.field} aria-label="Maximum dimensions" disabled={!!busy} value={maxEdge} onChange={event => edit(setMaxEdge)(event.target.value)}>
                <option value="">Keep original ({info.width} × {info.height})</option>
                {EDGES.filter(edge => edge < Math.max(info.width, info.height)).map(edge => { const fit = fitWithin(info.width, info.height, edge, edge); return <option key={edge} value={edge}>Fit within {edge} px ({fit.width} × {fit.height})</option>; })}
              </select>
            </label>
            <p className={styles.help}>Aspect ratio is always preserved, and images are never enlarged. Smaller dimensions usually save more than lower quality.</p>
            <p className={styles.help}>Orientation is applied where the browser supports it. Other metadata, including camera and location tags, is removed; colour profiles may change. Encoding runs in a background worker in this tab and every size shown is measured.</p>
          </AdvancedSettings>
        </ToolControls>} />
  </section>;
}

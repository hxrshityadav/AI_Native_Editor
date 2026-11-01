/* eslint-disable @next/next/no-img-element -- Previews are local blob URLs; images never go through a server optimizer. */
"use client";
import { useState } from "react";
import { ImageUp } from "lucide-react";
import { IMAGE_FORMATS, outputName, type ImageFormat } from "@/lib/images/policy";
import { useBlobUrl } from "../tools/useBlobUrl";
import { BeforeAfterComparison, ControlGroup, DetailsTable, FileDetails, FileDropzone, FilePicker, InlineMessage, PrimaryButton, ProcessingPanel, QualityControl, ResultPanel, SegmentedChoice, SideBySide, Stage, ToolControls, ToolSurface, shortSize, styles, useResultView } from "../tools/surface/ToolSurface";
import { useImageJob } from "./useImageJob";

/* Image Format Converter: upload -> choose the format -> convert -> download. */

const sizeLabel = (size: number) => size < 1000 ? `${size} bytes` : `${(size / 1000).toFixed(2)} KB (${size.toLocaleString()} bytes)`;
const FORMATS: { value: ImageFormat; label: string }[] = [{ value: "image/jpeg", label: "JPEG" }, { value: "image/png", label: "PNG" }, { value: "image/webp", label: "WebP" }];
const TRAITS: Record<ImageFormat, { transparency: string; compression: string; best: string }> = {
  "image/jpeg": { transparency: "Not kept", compression: "Lossy", best: "Photos that must open everywhere" },
  "image/png": { transparency: "Kept", compression: "Lossless", best: "Screenshots, logos and graphics" },
  "image/webp": { transparency: "Kept", compression: "Lossy", best: "Small files for the web" },
};
const ACCEPT = "image/jpeg,image/png,image/webp";
/** Converting to the same format is rarely what someone wants, so start on the first different one. */
const firstOther = (current: ImageFormat): ImageFormat => (["image/webp", "image/jpeg", "image/png"] as ImageFormat[]).find(format => format !== current)!;

export function ImageConverter() {
  const job = useImageJob(), { file, info, result, busy } = job;
  const [format, setFormat] = useState<ImageFormat>("image/webp"), [quality, setQuality] = useState(0.9), [background, setBackground] = useState("#ffffff");
  const inputUrl = useBlobUrl(info?.preview), outputUrl = useBlobUrl(result?.preview), downloadUrl = useBlobUrl(result?.blob);
  const view = useResultView(!!(result && downloadUrl));

  const load = (files: FileList) => void job.load(files, image => setFormat(firstOther(image.format)));
  function convert() { view.showLatest(); void job.run(image => ({ width: image.width, height: image.height, quality, format, background }), `Converting to ${IMAGE_FORMATS[format].label} and checking the result…`); }

  if (!info || !file) return <section aria-label="Image Format Converter workspace" className={styles.root}>
    <FileDropzone icon={ImageUp} title="Drop your image here" pickLabel="Choose image" accept={ACCEPT} busy={busy} onCancel={job.cancel} onFiles={load}
      facts={<><span>From <b>JPEG</b>, <b>PNG</b> or <b>WebP</b></span><span>Up to 25 MiB</span><span>Up to 16 megapixels</span></>} />
    {job.notice && <InlineMessage role="status">{job.notice}</InlineMessage>}
    {job.error && <InlineMessage role="alert" tone="error">{job.error}</InlineMessage>}
  </section>;

  const traits = TRAITS[format];
  return <section aria-label="Image Format Converter workspace" className={styles.root}>
    <ToolSurface onFiles={load}
      file={<FileDetails name={file.name} factsLabel="Original details" onStartOver={job.reset}
        thumb={inputUrl ? <img className={styles.thumb} src={inputUrl} alt="" width={48} height={48} /> : <span className={styles.thumb} />}
        picker={<FilePicker label="Replace image" inputLabel="Choose image" accept={ACCEPT} onFiles={load} />}
        facts={<><span>{IMAGE_FORMATS[info.format].label}</span><span>{info.width} × {info.height} px</span><span>{shortSize(file.size)}<span className="sr-only"> ({file.size.toLocaleString()} bytes)</span></span>{info.transparent && <span>Transparency detected</span>}</>} />}
      stage={<Stage busy={!!busy} processing={<ProcessingPanel title="Converting" status={busy} onCancel={job.cancel} />}>
        {outputUrl && inputUrl && result && result.width === info.width && result.height === info.height ? <BeforeAfterComparison original={inputUrl} result={outputUrl} resultTag={IMAGE_FORMATS[result.format].label} resultAlt="Converted image preview" />
          : outputUrl && inputUrl && result ? <SideBySide original={inputUrl} result={outputUrl} resultTag={IMAGE_FORMATS[result.format].label} resultAlt="Converted image preview" />
          : inputUrl && <img src={inputUrl} alt="Original image preview" />}
      </Stage>}
      side={result && downloadUrl && view.showResult
        ? <ResultPanel headingRef={view.heading} heading="Conversion result" onAdjust={view.adjust} note="Downloads a new file. Your original is unchanged."
          headline={<>{IMAGE_FORMATS[info.format].label} → {IMAGE_FORMATS[result.format].label}</>}
          summary={<>{shortSize(file.size)} → {shortSize(result.blob.size)}, measured.</>}
          download={{ href: downloadUrl, filename: outputName(file.name, "converter", result.format), label: "Download converted image" }}>
          {info.transparent && result.format === "image/jpeg" && <InlineMessage tone="info">Transparent areas were filled with {background.toUpperCase()}.</InlineMessage>}
          <DetailsTable
            original={{ title: "Original", label: "Original file", rows: [["Format", IMAGE_FORMATS[info.format].label], ["Size", shortSize(file.size), sizeLabel(file.size)], ["Dimensions", `${info.width} × ${info.height} px`]] }}
            result={{ title: "Converted", label: "Output details", rows: [["Format", IMAGE_FORMATS[result.format].label], ["Size", shortSize(result.blob.size), sizeLabel(result.blob.size)], ["Dimensions", `${result.width} × ${result.height} px`], ...(result.format !== "image/png" ? [["Quality", `Encoded at ${Math.round(result.quality * 100)}% quality`] as [string, string]] : [])] }} />
        </ResultPanel>
        : <ToolControls title="Conversion settings" controlsRef={view.controls} action={<>
          {job.notice && <InlineMessage role="status">{job.notice}</InlineMessage>}
          {job.error && <InlineMessage role="alert" tone="error">{job.error}</InlineMessage>}
          <PrimaryButton label="Convert image" busyLabel="Converting…" busy={!!busy} onClick={convert} />
          {view.adjusting && <button type="button" className={`${styles.secondary} ${styles.ghost}`} onClick={view.showLatest}>Back to result</button>}
        </>}>
          <SegmentedChoice legend="Output format" name="output-format" options={FORMATS} value={format} disabled={!!busy} onChange={value => { setFormat(value); job.invalidate(); }}
            hint={<dl className={styles.formatHint}><dt>Transparency</dt><dd>{traits.transparency}</dd><dt>Compression</dt><dd>{traits.compression}</dd><dt>Best for</dt><dd>{traits.best}</dd></dl>} />
          {format === info.format && <p role="note" className={styles.help}>The image is already {IMAGE_FORMATS[format].label}; converting re-encodes it in the same format.</p>}
          {info.transparent && format === "image/jpeg" && <ControlGroup>
            <InlineMessage role="note" tone="warn">JPEG cannot preserve transparency. Transparent pixels will be blended onto the background colour below.</InlineMessage>
            <label className={styles.label}>JPEG background<input className={styles.field} type="color" disabled={!!busy} value={background} onChange={event => { setBackground(event.target.value); job.invalidate(); }} /></label>
          </ControlGroup>}
          {format !== "image/png" && <QualityControl value={quality} disabled={!!busy} onChange={value => { setQuality(value); job.invalidate(); }} />}
          <p className={styles.help}>Dimensions stay the same. Orientation is applied where the browser supports it; other metadata is removed. The browser&apos;s own encoder is checked, so an unsupported format is reported instead of saved with the wrong extension.</p>
        </ToolControls>} />
  </section>;
}

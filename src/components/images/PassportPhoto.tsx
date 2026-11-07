/* eslint-disable @next/next/no-img-element -- Previews are local blob URLs; images never go through a server optimizer. */
"use client";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { IdCard, Minus, Plus, RotateCcw } from "lucide-react";
import { IMAGE_FORMATS } from "@/lib/images/policy";
import { MAX_ZOOM, MIN_ZOOM, PHOTO_SIZES, clampCentre, composeSheet, cropFor, pixelSize } from "@/lib/images/passport";
import { useBlobUrl } from "../tools/useBlobUrl";
import { ControlGroup, DetailsTable, FileDetails, FileDropzone, FilePicker, InlineMessage, PrimaryButton, ProcessingPanel, ResultPanel, SegmentedChoice, Stage, ToolControls, ToolSurface, shortSize, styles, useResultView } from "../tools/surface/ToolSurface";
import { useImageJob } from "./useImageJob";

/* Passport Photo: upload -> choose a size -> position and zoom -> choose a background fill -> export the photo and a print sheet. */

const ACCEPT = "image/jpeg,image/png,image/webp";
const FILLS = [{ value: "#ffffff", label: "White" }, { value: "#eceff1", label: "Light grey" }, { value: "#dce9f5", label: "Light blue" }];
const baseName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 80) || "photo";

export function PassportPhoto() {
  const job = useImageJob(), { file, info, result, busy } = job;
  const [sizeId, setSizeId] = useState(PHOTO_SIZES[0].id), [zoom, setZoom] = useState(1), [centre, setCentre] = useState({ cx: 0, cy: 0 }), [fill, setFill] = useState("#ffffff");
  const [sheet, setSheet] = useState<Blob>(), [sheetError, setSheetError] = useState("");
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const inputUrl = useBlobUrl(info?.preview), outputUrl = useBlobUrl(result?.blob), sheetUrl = useBlobUrl(sheet);
  const view = useResultView(!!(result && outputUrl));
  const size = PHOTO_SIZES.find(entry => entry.id === sizeId)!, pixels = pixelSize(size), aspect = size.widthMm / size.heightMm;

  const load = (files: FileList) => void job.load(files, image => { setZoom(1); setCentre({ cx: image.width / 2, cy: image.height / 2 }); setSheet(undefined); setSheetError(""); });
  const changed = () => { job.invalidate(); setSheet(undefined); setSheetError(""); };
  const move = (cx: number, cy: number) => { if (!info) return; setCentre(clampCentre(info.width, info.height, cx, cy)); changed(); };
  const zoomTo = (value: number) => { setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))); changed(); };
  async function create() {
    view.showLatest();
    const output = await job.run(image => ({ ...pixels, crop: cropFor(image.width, image.height, aspect, zoom, centre.cx, centre.cy), fill, background: fill, format: "image/jpeg", quality: 0.95 }), `Creating a ${size.label} photo at ${pixels.width} × ${pixels.height} px…`);
    if (!output) return;
    try { setSheet(await composeSheet(output.blob, pixels)); } catch (error) { setSheetError(error instanceof Error ? error.message : "The print sheet could not be created."); }
  }

  if (!info || !file) return <section aria-label="Passport Photo workspace" className={styles.root}>
    <FileDropzone icon={IdCard} title="Drop a portrait photo here" pickLabel="Choose image" accept={ACCEPT} busy={busy} onCancel={job.cancel} onFiles={load}
      facts={<><span><b>JPEG</b>, <b>PNG</b> or <b>WebP</b></span><span>Up to 25 MiB</span><span>Face the camera, plain background</span></>} />
    {job.notice && <InlineMessage role="status">{job.notice}</InlineMessage>}
    {job.error && <InlineMessage role="alert" tone="error">{job.error}</InlineMessage>}
  </section>;

  const crop = cropFor(info.width, info.height, aspect, zoom, centre.cx, centre.cy);
  // Position the whole image inside the frame in percentages of the crop, so the preview matches the export exactly.
  const imageStyle = { left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%`, width: `${info.width / crop.width * 100}%`, height: `${info.height / crop.height * 100}%` };
  const step = crop.width * 0.02;
  const onKey = (event: KeyboardEvent) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[event.key]) { event.preventDefault(); move(centre.cx + moves[event.key][0], centre.cy + moves[event.key][1]); }
    else if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomTo(zoom + 0.1); }
    else if (event.key === "-") { event.preventDefault(); zoomTo(zoom - 0.1); }
    else if (event.key === "0") { event.preventDefault(); setZoom(1); move(info.width / 2, info.height / 2); }
  };
  const onDown = (event: PointerEvent<HTMLDivElement>) => { if (busy) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, ...centre }; };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const frame = event.currentTarget.getBoundingClientRect(), ratio = crop.width / frame.width;
    move(drag.current.cx - (event.clientX - drag.current.x) * ratio, drag.current.cy - (event.clientY - drag.current.y) * ratio);
  };

  return <section aria-label="Passport Photo workspace" className={styles.root}>
    <ToolSurface onFiles={load}
      file={<FileDetails name={file.name} factsLabel="Original details" onStartOver={() => { job.reset(); setSheet(undefined); }}
        thumb={inputUrl ? <img className={styles.thumb} src={inputUrl} alt="" width={48} height={48} /> : <span className={styles.thumb} />}
        picker={<FilePicker label="Replace image" inputLabel="Choose image" accept={ACCEPT} onFiles={load} />}
        facts={<><span>{info.width} × {info.height} px</span><span>{shortSize(file.size)}</span><span>{IMAGE_FORMATS[info.format].label}</span></>} />}
      stage={<Stage plain busy={!!busy} processing={<ProcessingPanel title="Creating photo" status={busy} onCancel={job.cancel} />}>
        {result && outputUrl && view.showResult
          ? <div className="flex flex-wrap items-center justify-center gap-6">
            <figure className="text-center"><img src={outputUrl} alt={`Finished ${size.label} photo`} style={{ width: "min(16rem, 60vw)", aspectRatio: `${aspect}`, objectFit: "cover", borderRadius: 4 }} /><figcaption className={styles.note}>{size.label}</figcaption></figure>
            {sheetUrl && <figure className="text-center"><img src={sheetUrl} alt="Print sheet with several copies" style={{ width: "min(20rem, 70vw)", borderRadius: 4 }} /><figcaption className={styles.note}>6 × 4 in print sheet</figcaption></figure>}
          </div>
          : <div className="flex w-full flex-col items-center gap-3">
            <div role="group" tabIndex={0} aria-label="Photo position. Drag, or use the arrow keys to move, plus and minus to zoom, and 0 to reset." onKeyDown={onKey} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
              className="relative cursor-grab touch-none overflow-hidden rounded-md outline-offset-4 active:cursor-grabbing" style={{ aspectRatio: `${aspect}`, height: "min(26rem, 60vh)", maxWidth: "100%", background: fill }}>
              {inputUrl && <img src={inputUrl} alt="Original image preview" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={imageStyle} />}
              {/* Guides only: an approximate head area and centre line, not a compliance check. */}
              <div aria-hidden className="pointer-events-none absolute left-1/2 top-[12%] h-[58%] w-[52%] -translate-x-1/2 rounded-[50%] border-2 border-dashed border-white/70 mix-blend-difference" />
              <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/40 mix-blend-difference" />
            </div>
            <p className={styles.note}>Drag to position. The dashed oval is a guide for head placement only.</p>
          </div>}
      </Stage>}
      side={result && outputUrl && view.showResult
        ? <ResultPanel headingRef={view.heading} heading="Passport photo result" onAdjust={view.adjust} again={{ label: "New photo", onClick: () => { job.reset(); setSheet(undefined); } }} note="Check your issuing authority's current photo rules before submitting."
          headline={<>{size.label}</>}
          summary={<>{result.width} × {result.height} px at 300 DPI, {shortSize(result.blob.size)} JPEG.</>}
          download={{ href: outputUrl, filename: `${baseName(file.name)}-passport-${size.id}.jpg`, label: "Download photo" }}>
          {sheetUrl && sheet && <a className={styles.secondary} href={sheetUrl} download={`${baseName(file.name)}-passport-sheet-${size.id}.jpg`}>Download 6 × 4 in print sheet</a>}
          {sheetError && <InlineMessage role="alert" tone="error">{sheetError}</InlineMessage>}
          <DetailsTable
            original={{ title: "Original", label: "Original file", rows: [["Dimensions", `${info.width} × ${info.height} px`], ["Size", shortSize(file.size)], ["Format", IMAGE_FORMATS[info.format].label]] }}
            result={{ title: "Photo", label: "Output details", rows: [["Print size", size.label], ["Dimensions", `${result.width} × ${result.height} px`], ["Format", IMAGE_FORMATS[result.format].label], ["Size", shortSize(result.blob.size)], ...(sheet ? [["Print sheet", `${shortSize(sheet.size)} JPEG`] as [string, string]] : [])] }} />
        </ResultPanel>
        : <ToolControls title="Passport photo settings" controlsRef={view.controls} action={<>
          {job.notice && <InlineMessage role="status">{job.notice}</InlineMessage>}
          {job.error && <InlineMessage role="alert" tone="error">{job.error}</InlineMessage>}
          <PrimaryButton label="Create passport photo" busyLabel="Creating…" busy={!!busy} onClick={() => void create()} />
          {view.adjusting && <button type="button" className={`${styles.secondary} ${styles.ghost}`} onClick={view.showLatest}>Back to result</button>}
        </>}>
          <label className={styles.group}><span className={styles.label}>1. Photo size</span>
            <select className={styles.field} aria-label="Photo size" disabled={!!busy} value={sizeId} onChange={event => { setSizeId(event.target.value); changed(); }}>{PHOTO_SIZES.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
            <span className={styles.help}>Exported at 300 DPI: {pixels.width} × {pixels.height} px. Sizes only; rules on head size and expression vary by authority.</span>
          </label>
          <ControlGroup label="2. Position and zoom" aside={<span className={styles.value}>{Math.round(zoom * 100)}%</span>}>
            <div className="flex items-center gap-2">
              <button type="button" className={styles.link} aria-label="Zoom out" disabled={!!busy || zoom <= MIN_ZOOM} onClick={() => zoomTo(zoom - 0.1)}><Minus aria-hidden size={16} /></button>
              <input className={styles.range} aria-label="Zoom" type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={zoom} disabled={!!busy} onChange={event => zoomTo(Number(event.target.value))} />
              <button type="button" className={styles.link} aria-label="Zoom in" disabled={!!busy || zoom >= MAX_ZOOM} onClick={() => zoomTo(zoom + 0.1)}><Plus aria-hidden size={16} /></button>
            </div>
            <button type="button" className={styles.secondary} disabled={!!busy} onClick={() => { setZoom(1); move(info.width / 2, info.height / 2); }}><RotateCcw aria-hidden size={15} />Reset position</button>
          </ControlGroup>
          <SegmentedChoice legend="3. Background fill" name="photo-fill" options={FILLS} value={fill} disabled={!!busy} onChange={value => { setFill(value); changed(); }}
            hint="Fills any area the photo does not cover when you zoom out or move it. It does not replace the background in the photo itself." />
          <label className={styles.label}>Custom fill colour<input className={styles.field} type="color" disabled={!!busy} value={fill} onChange={event => { setFill(event.target.value); changed(); }} /></label>
        </ToolControls>} />
  </section>;
}

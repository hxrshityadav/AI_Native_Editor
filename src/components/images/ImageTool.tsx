/* eslint-disable @next/next/no-img-element -- Previews are local blob URLs; images never go through a server optimizer. */
"use client";
import { useEffect, useRef, useState } from "react";
import { runImageTask } from "@/lib/images/client";
import { IMAGE_FORMATS, fitWithin, outputName, pairedDimensions, validateDimensions, type ImageFormat, type ImageTool } from "@/lib/images/policy";
import type { ImageInfo, ImageOutput } from "@/lib/images/engine";
import { PHOTO_TOOLS } from "@/lib/images/tools";
import styles from "./ImageTool.module.css";
import { useBlobUrl } from "../tools/useBlobUrl";

const sizeLabel = (size: number) => size < 1000 ? `${size} bytes` : `${(size / 1000).toFixed(2)} KB (${size.toLocaleString()} bytes)`;

export function ImageTool({ tool }: { tool: ImageTool }) {
  const [file, setFile] = useState<File>();
  const [info, setInfo] = useState<ImageInfo>();
  const [result, setResult] = useState<ImageOutput>();
  const [format, setFormat] = useState<ImageFormat>("image/webp");
  const [width, setWidth] = useState(0), [height, setHeight] = useState(0);
  const [preset, setPreset] = useState("");
  const [locked, setLocked] = useState(true), [quality, setQuality] = useState(0.82), [target, setTarget] = useState("");
  const [background, setBackground] = useState("#ffffff"), [busy, setBusy] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null);
  const ratio = useRef({ width: 1, height: 1 });
  const inputUrl = useBlobUrl(info?.preview), outputUrl = useBlobUrl(result?.preview), downloadUrl = useBlobUrl(result?.blob);
  useEffect(() => () => active.current?.abort(), []);
  const invalidate = () => { setResult(undefined); setError(""); setNotice(""); };
  function cancel() { active.current?.abort(); active.current = null; setBusy(""); setNotice("Operation cancelled. Choose an image or try again."); }
  async function load(files: FileList | File[]) {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setFile(undefined); setInfo(undefined); invalidate();
    if (files.length !== 1) { setBusy(""); setError("Choose one image at a time using the file picker or drop area."); return; }
    // FileList is live: resetting the picker must not clear an in-flight selection.
    const selected = files[0];
    setBusy("Reading and checking the image…");
    try {
      const image = await runImageTask({ kind: "inspect", file: selected }, controller.signal) as ImageInfo;
      if (controller.signal.aborted) return;
      setFile(selected); setInfo(image); setWidth(image.width); setHeight(image.height); setLocked(true); setPreset(""); ratio.current = { width: image.width, height: image.height };
      setFormat(tool === "compressor" ? "image/webp" : image.format);
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Cannot open this image. Choose another file."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }
  async function run() {
    if (!file || !info) return;
    invalidate(); const controller = new AbortController(); active.current?.abort(); active.current = controller;
    try {
      const size = tool === "resizer" ? { width, height } : info;
      validateDimensions(size.width, size.height);
      const targetBytes = tool === "compressor" && target !== "" ? Number(target) * 1000 : undefined;
      if (targetBytes !== undefined && (!Number.isFinite(targetBytes) || targetBytes < 1 || targetBytes > 64 * 1024 * 1024)) throw new Error("Enter a positive target size, up to 67,108 KB, or leave it empty.");
      setBusy("Encoding the image and measuring the result…");
      const output = await runImageTask({ kind: "process", file, width: size.width, height: size.height, quality, format, targetBytes, background }, controller.signal) as ImageOutput;
      if (!controller.signal.aborted) setResult(output);
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not process this image. Try smaller dimensions or another format."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }
  function dimension(edge: "width" | "height", value: number) {
    invalidate(); setPreset(""); const next = pairedDimensions(locked ? ratio.current.width : width, locked ? ratio.current.height : height, edge, value, locked);
    setWidth(next.width); setHeight(next.height);
  }
  const reduction = result && file ? (1 - result.blob.size / file.size) * 100 : 0;
  return <section aria-label={`${PHOTO_TOOLS[tool].title} workspace`} className={styles.workspace}>
    <div className={styles.upload} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void load(event.dataTransfer.files); }}>
      <label>Choose image<input aria-label="Choose image" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { if (event.target.files?.length) void load(event.target.files); event.target.value = ""; }} /></label>
      <p>or drop one JPEG, PNG or WebP here. Up to 25 MiB and 16 megapixels.</p>
      <p>Free, no account, no uploads. Images stay in this tab.</p>
    </div>
    <div className={styles.editor}>
      <div className={styles.controls}>
        {info && <p className="break-all">{file?.name}</p>}
        {info && tool === "resizer" && <>
          <div className={styles.row}>
            <label>Width (px)<input type="number" min={1} max={8192} step={1} disabled={!!busy} value={width || ""} onChange={event => dimension("width", Number(event.target.value))} /></label>
            <label>Height (px)<input type="number" min={1} max={8192} step={1} disabled={!!busy} value={height || ""} onChange={event => dimension("height", Number(event.target.value))} /></label>
          </div>
          <button type="button" aria-pressed={locked} disabled={!!busy} onClick={() => { if (!locked) ratio.current = width > 0 && height > 0 ? { width, height } : { width: info.width, height: info.height }; setLocked(!locked); invalidate(); }}>Aspect ratio {locked ? "locked" : "unlocked"}</button>
          <label>Fit preset<select value={preset} disabled={!!busy} onChange={event => { setPreset(event.target.value); if (!event.target.value) return; const bound = Number(event.target.value); const next = fitWithin(info.width, info.height, bound, bound); setWidth(next.width); setHeight(next.height); setLocked(true); ratio.current = { width: info.width, height: info.height }; invalidate(); }}><option value="">Custom dimensions</option><option value="1920">Fit within 1920 × 1920</option><option value="1080">Fit within 1080 × 1080</option><option value="800">Fit within 800 × 800</option><option value="400">Fit within 400 × 400</option></select></label>
          {width > info.width || height > info.height ? <p>Upscaling increases dimensions but cannot restore missing detail.</p> : null}
        </>}
        <label>Output format<select disabled={!!busy} value={format} onChange={event => { setFormat(event.target.value as ImageFormat); invalidate(); }}>{Object.entries(IMAGE_FORMATS).map(([mime, item]) => <option key={mime} value={mime}>{item.label}</option>)}</select></label>
        <label>Quality ceiling: {Math.round(quality * 100)}%<input aria-label="Quality ceiling" type="range" min={0.1} max={1} step={0.01} value={quality} disabled={!!busy || format === "image/png"} onChange={event => { setQuality(Number(event.target.value)); invalidate(); }} /></label>
        {format === "image/png" && <p>PNG is lossless. Quality settings do not reduce its size.</p>}
        {tool === "compressor" && <label>Target size (KB, optional)<input aria-label="Target size (KB, optional)" type="number" min={0.001} step="any" disabled={!!busy} value={target} placeholder="For example, 200" onChange={event => { setTarget(event.target.value); invalidate(); }} /><span className={styles.note}>1 KB = 1,000 bytes. Dimensions stay unchanged.</span></label>}
        {info?.transparent && format === "image/jpeg" && <>
          <p role="note">JPEG cannot preserve transparency. Transparent pixels will be blended onto the background colour below.</p>
          <label>JPEG background<input type="color" disabled={!!busy} value={background} onChange={event => { setBackground(event.target.value); invalidate(); }} /></label>
        </>}
        <button type="button" className={styles.primary} disabled={!info || !!busy} onClick={() => void run()}>{PHOTO_TOOLS[tool].action}</button>
        {!!busy && <button type="button" onClick={cancel}>Cancel operation</button>}
        <p>Still images only. Orientation is applied where the browser supports it. Other metadata is removed; colour profiles and fine details may change.</p>
      </div>
      <div className={styles.previews}>
        {busy && <p role="status" aria-live="polite">{busy}</p>}
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert" className={`${styles.message} ${styles.error}`}>{error}</p>}
        <div className={styles.figures}>
          <figure><figcaption>Original</figcaption><div className={styles.image}>{inputUrl ? <img src={inputUrl} alt="Original image preview" /> : <span className={styles.empty}>Choose an image to begin.</span>}</div>{info && file && <div className={styles.stats} aria-label="Original details"><span>{info.width} × {info.height} px</span><span>{IMAGE_FORMATS[info.format].label}</span><span>{sizeLabel(file.size)}</span>{info.transparent && <span>Transparency detected</span>}</div>}</figure>
          <figure><figcaption>Result</figcaption><div className={styles.image}>{outputUrl ? <img src={outputUrl} alt="Processed image preview" /> : <span className={styles.empty}>Your result will appear here.</span>}</div>{result && <div className={styles.stats} aria-label="Output details"><span>{result.width} × {result.height} px</span><span>{IMAGE_FORMATS[result.format].label}</span><span>{sizeLabel(result.blob.size)}</span><span>{Math.abs(reduction).toFixed(1)}% {reduction >= 0 ? "smaller" : "larger"}</span>{result.format !== "image/png" && <span>Encoded at {Math.round(result.quality * 100)}% quality</span>}</div>}</figure>
        </div>
        {result && tool === "compressor" && target !== "" && <p role="status" className={styles.message}>{result.targetMet ? "The measured output meets your target size." : `The target size was not met. The smallest tested output is ${sizeLabel(result.blob.size)}. Try the Image Resizer or a different output format.`}</p>}
        {result && downloadUrl && file && <div className={styles.actions}><a href={downloadUrl} download={outputName(file.name, tool, result.format)}>Download result</a><span className={styles.note}>Downloads a new file. Your original is unchanged.</span></div>}
      </div>
    </div>
  </section>;
}

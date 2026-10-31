/* eslint-disable @next/next/no-img-element -- Previews are local blob URLs; images never go through a server optimizer. */
"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, ImageUp, Link2, Link2Off, RotateCcw, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { runImageTask } from "@/lib/images/client";
import { IMAGE_FORMATS, fitWithin, outputName, pairedDimensions, validateDimensions, type ImageFormat, type ImageTool } from "@/lib/images/policy";
import type { ImageInfo, ImageOutput } from "@/lib/images/engine";
import { PHOTO_TOOLS } from "@/lib/images/tools";
import { AdvancedDetails, Busy, CompareSlider, Comparison, DropZone, ErrorMessage, Panel, PrimaryAction, Section, Segmented, Tip, styles, type Row } from "../tools/Workspace";
import { useBlobUrl } from "../tools/useBlobUrl";

const sizeLabel = (size: number) => size < 1000 ? `${size} bytes` : `${(size / 1000).toFixed(2)} KB (${size.toLocaleString()} bytes)`;
const shortSize = (size: number) => size < 1000 ? `${size} B` : size < 1000000 ? `${(size / 1000).toFixed(1)} KB` : `${(size / 1000000).toFixed(2)} MB`;
const QUALITY_PRESETS = [{ value: "0.6", label: "Smaller file" }, { value: "0.82", label: "Balanced" }, { value: "0.92", label: "Higher quality" }];
const TARGET_PRESETS: [number, "KB" | "MB"][] = [[50, "KB"], [100, "KB"], [200, "KB"], [500, "KB"], [1, "MB"], [2, "MB"]];
const VERBS: Record<ImageTool, [busy: string, again: string]> = { compressor: ["Compressing…", "Compress another image"], resizer: ["Resizing…", "Resize another image"], converter: ["Converting…", "Convert another image"] };

export function ImageTool({ tool }: { tool: ImageTool }) {
  const [file, setFile] = useState<File>();
  const [info, setInfo] = useState<ImageInfo>();
  const [result, setResult] = useState<ImageOutput>();
  const [choice, setChoice] = useState<ImageFormat | "original">("image/webp");
  const [width, setWidth] = useState(0), [height, setHeight] = useState(0);
  const [preset, setPreset] = useState("");
  const [locked, setLocked] = useState(true), [quality, setQuality] = useState(0.82), [target, setTarget] = useState(""), [unit, setUnit] = useState<"KB" | "MB">("KB");
  const [maxEdge, setMaxEdge] = useState("");
  const [background, setBackground] = useState("#ffffff"), [busy, setBusy] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null);
  const ratio = useRef({ width: 1, height: 1 });
  const panel = useRef<HTMLElement>(null);
  const inputUrl = useBlobUrl(info?.preview), outputUrl = useBlobUrl(result?.preview), downloadUrl = useBlobUrl(result?.blob);
  useEffect(() => () => active.current?.abort(), []);
  const format: ImageFormat = choice === "original" ? info?.format ?? "image/webp" : choice;
  const targetBytes = tool === "compressor" && target !== "" ? Number(target) * (unit === "MB" ? 1000000 : 1000) : undefined;
  const invalidate = () => { setResult(undefined); setError(""); setNotice(""); };
  function reset() { active.current?.abort(); active.current = null; setBusy(""); setFile(undefined); setInfo(undefined); invalidate(); }
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
      setChoice(tool === "compressor" ? "image/webp" : image.format);
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Cannot open this image. Choose another file."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }
  async function run() {
    if (!file || !info) return;
    invalidate(); const controller = new AbortController(); active.current?.abort(); active.current = controller;
    try {
      const size = tool === "resizer" ? { width, height } : tool === "compressor" && maxEdge ? fitWithin(info.width, info.height, Number(maxEdge), Number(maxEdge)) : info;
      validateDimensions(size.width, size.height);
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
  const item = PHOTO_TOOLS[tool], [busyVerb, again] = VERBS[tool];
  const loaded = !!(info && file);
  const sameShape = !!(result && info && Math.abs(result.width / result.height - info.width / info.height) < 0.01);
  const adjust = () => { const first = panel.current?.querySelector<HTMLElement>("input, select, button"); first?.focus(); first?.scrollIntoView({ block: "center", behavior: "smooth" }); };
  const qualityPreset = QUALITY_PRESETS.find(entry => Number(entry.value) === quality)?.value;

  return <section aria-label={`${item.title} workspace`} className={styles.workspace}>
    <DropZone icon={ImageUp} loaded={loaded} pickLabel="Choose image" accept="image/jpeg,image/png,image/webp" title="Drop an image here"
      formats={["JPEG", "PNG", "WebP"]} limits="One still image, up to 25 MiB and 16 megapixels."
      fileName={file?.name} fileMeta={info && file ? [`${info.width} × ${info.height} px`, IMAGE_FORMATS[info.format].label, shortSize(file.size)] : []}
      onFiles={files => void load(files)} />
    <div className={styles.feedback}>
      {busy && <Busy label={busy} onCancel={cancel} />}
      {notice && <p role="status" className={styles.message}>{notice}</p>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
    {info && file && <div className={styles.editor}>
      <div className={styles.previewArea}>
        <h2 className="sr-only">Preview</h2>
        <div className={`${styles.stage} ${styles.checker}`} data-busy={busy || undefined}>
          {outputUrl && inputUrl && sameShape ? <CompareSlider original={inputUrl} result={outputUrl} />
            : outputUrl && inputUrl ? <div className={styles.pair}>
              <figure><span className={styles.stageLabel} style={{ left: ".5rem" }} aria-hidden>Original</span><img src={inputUrl} alt="Original image preview" /></figure>
              <figure><span className={styles.stageLabel} style={{ left: ".5rem" }} aria-hidden>Result</span><img src={outputUrl} alt="Processed image preview" /></figure>
            </div>
            : inputUrl && <img src={inputUrl} alt="Original image preview" />}
        </div>
      </div>
      <Panel title="Settings" panelRef={panel} action={<>
        <PrimaryAction label={item.action} busyLabel={busyVerb} busy={!!busy} onClick={() => void run()} />
        <p className={styles.help}>{result ? "Changing a setting clears the current result." : "Nothing leaves your device while this runs."}</p>
      </>}>
        {tool === "resizer" && <Section title="Dimensions">
          <div className={styles.row}>
            <label>Width (px)<input type="number" inputMode="numeric" min={1} max={8192} step={1} disabled={!!busy} value={width || ""} onChange={event => dimension("width", Number(event.target.value))} /></label>
            <label>Height (px)<input type="number" inputMode="numeric" min={1} max={8192} step={1} disabled={!!busy} value={height || ""} onChange={event => dimension("height", Number(event.target.value))} /></label>
          </div>
          <button type="button" aria-pressed={locked} disabled={!!busy} onClick={() => { if (!locked) ratio.current = width > 0 && height > 0 ? { width, height } : { width: info.width, height: info.height }; setLocked(!locked); invalidate(); }}>{locked ? <Link2 aria-hidden size={16} /> : <Link2Off aria-hidden size={16} />}Aspect ratio {locked ? "locked" : "unlocked"}</button>
          <label>Fit preset<select value={preset} disabled={!!busy} onChange={event => { setPreset(event.target.value); if (!event.target.value) return; const bound = Number(event.target.value); const next = fitWithin(info.width, info.height, bound, bound); setWidth(next.width); setHeight(next.height); setLocked(true); ratio.current = { width: info.width, height: info.height }; invalidate(); }}><option value="">Custom dimensions</option><option value="1920">Fit within 1920 × 1920</option><option value="1080">Fit within 1080 × 1080</option><option value="800">Fit within 800 × 800</option><option value="400">Fit within 400 × 400</option></select></label>
          {width > info.width || height > info.height ? <p role="note" className={`${styles.message} ${styles.warn}`}><TriangleAlert aria-hidden />Upscaling increases dimensions but cannot restore missing detail.</p> : null}
        </Section>}
        <Section title={tool === "compressor" ? "Compression" : "Output"}>
          <label>Output format<select disabled={!!busy} value={choice} onChange={event => { setChoice(event.target.value as ImageFormat | "original"); invalidate(); }}>
            {tool === "compressor" && <option value="original">Same as original ({IMAGE_FORMATS[info.format].label})</option>}
            {Object.entries(IMAGE_FORMATS).map(([mime, entry]) => <option key={mime} value={mime}>{entry.label}</option>)}
          </select></label>
          {format === "image/png"
            ? <p className={styles.help}>PNG is lossless. Quality settings do not reduce its size.</p>
            : <div className="flex flex-col gap-2.5">
              <span className="text-sm font-[550]">Quality</span>
              <Segmented label="Quality preset" options={QUALITY_PRESETS} value={qualityPreset} disabled={!!busy} onChange={value => { setQuality(Number(value)); invalidate(); }} />
            </div>}
          <label className={format === "image/png" ? "sr-only" : undefined}><span className={styles.labelRow}><span>Exact quality</span><span className={styles.value}>{format === "image/png" ? "Lossless" : `Quality: ${Math.round(quality * 100)}%`}</span></span><input aria-label="Quality ceiling" type="range" min={0.1} max={1} step={0.01} value={quality} disabled={!!busy || format === "image/png"} onChange={event => { setQuality(Number(event.target.value)); invalidate(); }} /></label>
          {info.transparent && format === "image/jpeg" && <>
            <p role="note" className={`${styles.message} ${styles.warn}`}><TriangleAlert aria-hidden />JPEG cannot preserve transparency. Transparent pixels will be blended onto the background colour below.</p>
            <label>JPEG background<input type="color" disabled={!!busy} value={background} onChange={event => { setBackground(event.target.value); invalidate(); }} /></label>
          </>}
        </Section>
        {tool === "compressor" && <Section title="Target file size" tip={<Tip label="How target size works" align="end">The tool searches for the highest quality, up to the quality you set, whose output fits under the target. If nothing fits, you get the smallest result it found and a note saying so. Dimensions stay unchanged. 1 KB = 1,000 bytes.</Tip>}>
          <div className={styles.unit}>
            <label>Target (optional)<input aria-label={`Target size (${unit}, optional)`} type="number" inputMode="decimal" min={0.001} step="any" disabled={!!busy} value={target} placeholder="e.g. 200" onChange={event => { setTarget(event.target.value); invalidate(); }} /></label>
            <label>Unit<select aria-label="Target size unit" disabled={!!busy} value={unit} onChange={event => { setUnit(event.target.value as "KB" | "MB"); invalidate(); }}><option>KB</option><option>MB</option></select></label>
          </div>
          <div role="group" aria-label="Common target sizes" className={styles.chips}>{TARGET_PRESETS.map(([amount, size]) => <button key={`${amount}${size}`} type="button" disabled={!!busy} aria-pressed={target === String(amount) && unit === size} onClick={() => { setTarget(String(amount)); setUnit(size); invalidate(); }}>{amount} {size}</button>)}</div>
          <p className={styles.help}>We&apos;ll try to get as close as possible to your target while keeping the best quality available.</p>
          {targetBytes !== undefined && format === "image/png" && <p role="note" className={`${styles.message} ${styles.warn}`}><TriangleAlert aria-hidden />PNG is lossless, so a target size can&apos;t be pursued. Choose WebP or JPEG to aim for a size.</p>}
          {targetBytes !== undefined && targetBytes >= file.size && format !== "image/png" && <p role="note" className={styles.help}>This target is larger than the original ({shortSize(file.size)}), so any compressed result will meet it.</p>}
        </Section>}
        {tool === "compressor" && <AdvancedDetails title="Resize while compressing">
          <label>Dimensions<select aria-label="Resize while compressing" disabled={!!busy} value={maxEdge} onChange={event => { setMaxEdge(event.target.value); invalidate(); }}>
            <option value="">Keep original dimensions</option>
            {[3840, 2560, 1920, 1280, 1080, 800].map(edge => <option key={edge} value={edge} disabled={edge >= Math.max(info.width, info.height)}>Fit within {edge} px{edge >= Math.max(info.width, info.height) ? " (already smaller)" : ""}</option>)}
          </select></label>
          <p className={styles.help}>Fits the whole image inside a square of this size. Smaller images are never enlarged.</p>
        </AdvancedDetails>}
        <AdvancedDetails title="Processing details">
          <p className={styles.help}>Still images only. Orientation is applied where the browser supports it. Other metadata, including camera and location tags, is removed; colour profiles and fine details may change.</p>
          <p className={styles.help}>Encoding runs in a background worker in this tab using the browser&apos;s own image encoders. Output sizes are measured, not estimated.</p>
        </AdvancedDetails>
      </Panel>
      <div className={styles.results}>
        <Comparison title={result ? "Result" : "File details"} originalLabel="Original details"
          original={[["Size", shortSize(file.size), sizeLabel(file.size)], ["Format", IMAGE_FORMATS[info.format].label], ["Dimensions", `${info.width} × ${info.height} px`], ...(info.transparent ? [["Alpha", "Transparency detected"] as Row] : [])]}
          resultTitle={{ compressor: "Compressed", resizer: "Resized", converter: "Converted" }[tool]} resultLabel="Output details"
          result={result && [["Size", shortSize(result.blob.size), sizeLabel(result.blob.size)], ["Format", IMAGE_FORMATS[result.format].label], ["Dimensions", `${result.width} × ${result.height} px`],
            ["Change", `${Math.abs((1 - result.blob.size / file.size) * 100).toFixed(1)}% ${result.blob.size <= file.size ? "smaller" : "larger"}`],
            ...(result.format !== "image/png" ? [["Quality", `Encoded at ${Math.round(result.quality * 100)}% quality`] as Row] : []),
            ...(targetBytes !== undefined ? [["Target", `${target} ${unit} requested`, result.targetMet ? "Reached" : "Not reached"] as Row] : [])]}
          change={result ? 1 - result.blob.size / file.size : undefined} />
        {result && targetBytes !== undefined && <p role="status" className={`${styles.message} ${result.targetMet ? styles.success : styles.warn}`}>{result.targetMet ? <CheckCircle2 aria-hidden /> : <TriangleAlert aria-hidden />}{result.targetMet ? "The measured output meets your target size." : `The target size was not met. The smallest tested output is ${sizeLabel(result.blob.size)}. Try the Image Resizer or a different output format.`}</p>}
        {result && downloadUrl && <div className={styles.resultBar}>
          <a className={styles.download} href={downloadUrl} download={outputName(file.name, tool, result.format)}><Download aria-hidden size={18} />Download image</a>
          <button type="button" className={styles.secondary} onClick={adjust}><SlidersHorizontal aria-hidden size={16} />Adjust settings</button>
          <button type="button" className={styles.secondary} onClick={reset}><RotateCcw aria-hidden size={16} />{again}</button>
          <span className={styles.note}>Downloads a new file. Your original is unchanged.</span>
        </div>}
      </div>
    </div>}
  </section>;
}

"use client";
/* eslint-disable @next/next/no-img-element -- Same-origin sample and local blob result, with no upload or optimizer. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import type { ImageInfo, ImageOutput } from "@/lib/images/engine";
import type { ImageFormat } from "@/lib/images/policy";
import { useBlobUrl } from "../tools/useBlobUrl";
import { BeforeAfterComparison, shortSize } from "../tools/surface/ToolSurface";

const SAMPLE = "/samples/finishing-landscape.jpg";

/** No processing worker or model runs until the visitor requests a conversion. */
export function FinishingBench() {
  const [quality, setQuality] = useState(0.8), [format, setFormat] = useState<ImageFormat>("image/webp");
  const [result, setResult] = useState<ImageOutput>(), [originalSize, setOriginalSize] = useState<number>();
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(""), [error, setError] = useState("");
  const source = useRef<File | null>(null), active = useRef<AbortController | null>(null);
  const preview = useBlobUrl(result?.blob);
  useEffect(() => () => active.current?.abort(), []);
  const invalidate = () => { setResult(undefined); setError(""); setStatus(""); };
  async function compress() {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setBusy(true); setResult(undefined); setError(""); setStatus("Preparing the sample…");
    try {
      const { runImageTask } = await import("@/lib/images/client");
      if (!source.current) {
        const response = await fetch(SAMPLE, { signal: controller.signal });
        if (!response.ok) throw new Error("The sample could not load.");
        source.current = new File([await response.blob()], "reel-finisher-sample.jpg", { type: "image/jpeg" });
      }
      const file = source.current;
      const info = await runImageTask({ kind: "inspect", file }, controller.signal) as ImageInfo;
      if (controller.signal.aborted) return;
      setOriginalSize(file.size); setStatus("Encoding and measuring the output…");
      const output = await runImageTask({ kind: "process", file, width: info.width, height: info.height, format, quality, background: "#ffffff" }, controller.signal) as ImageOutput;
      if (!controller.signal.aborted) { setResult(output); setStatus("Sample ready. Compare the images and download the measured result."); }
    } catch (problem) {
      if (!controller.signal.aborted) { const detail = problem instanceof Error ? problem.message : "The image could not be processed."; setError(`${detail} Try again, choose another format, or use Image Compressor with your own image.`); setStatus(""); }
    } finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  }
  function cancel() { active.current?.abort(); active.current = null; setBusy(false); setStatus("Cancelled. Change the settings or try again."); }
  return <section className="finishing-bench" aria-labelledby="bench-title">
    <header className="bench-heading"><h2 id="bench-title">Try the finishing bench</h2><p><ShieldCheck aria-hidden size={16} />A real conversion, on your device.</p></header>
    <div className="bench-body" data-ui><figure className="bench-preview">
      {preview ? <BeforeAfterComparison original={SAMPLE} result={preview} resultTag="Compressed" resultAlt="Compressed sample landscape" /> : <img src="/samples/finishing-preview.webp" width={1536} height={1024} alt="Generated sample: evening light on a mountain lake" fetchPriority="high" />}
      <figcaption>Generated sample image. Compare it after processing.</figcaption>
    </figure><div className="bench-settings">
      <label>Output format<select aria-label="Sample output format" value={format} disabled={busy} onChange={event => { setFormat(event.target.value as ImageFormat); invalidate(); }}><option value="image/webp">WebP</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG (lossless)</option></select></label>
      <label>Quality <output>{format === "image/png" ? "Lossless" : `${Math.round(quality * 100)}%`}</output><input aria-label="Sample compression quality" aria-valuetext={`${Math.round(quality * 100)} percent`} type="range" min={0.1} max={1} step={0.01} value={quality} disabled={busy || format === "image/png"} onChange={event => { setQuality(Number(event.target.value)); invalidate(); }} /></label>
      <div className="bench-measurements" aria-label="Measured sample sizes"><div><span>Original JPEG</span><strong>{originalSize ? shortSize(originalSize) : "Sample image"}</strong></div><div><span>Measured output</span><strong>{result ? shortSize(result.blob.size) : "Run to measure"}</strong></div></div>
      {result && originalSize && <p className="bench-savings" data-larger={result.blob.size >= originalSize || undefined}>{result.blob.size < originalSize ? `${((1 - result.blob.size / originalSize) * 100).toFixed(1)}% smaller` : `${((result.blob.size / originalSize - 1) * 100).toFixed(1)}% larger`}. {result.width} × {result.height} px.</p>}
      {error && <p role="alert" className="bench-error">{error}</p>}
      <p role="status" aria-live="polite" className="bench-status">{status || "Choose your settings, then run the sample. No account or upload."}</p>
      {busy ? <button type="button" className="bench-secondary" onClick={cancel}>Cancel conversion</button> : <button type="button" className="bench-primary" onClick={() => void compress()}>{result ? "Run again" : "Compress sample"}</button>}
      {preview && <a className="bench-download" href={preview} download={`reel-finisher-sample.${format === "image/jpeg" ? "jpg" : format.split("/")[1]}`}><Download aria-hidden size={16} />Download sample result</a>}
      <Link prefetch={false} href="/tools/image-compressor" className="bench-own">Use your own image</Link>
    </div></div>
  </section>;
}

/* eslint-disable @next/next/no-img-element -- Previews are local blob URLs; images never go through a server optimizer. */
"use client";
import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { IMAGE_FORMATS } from "@/lib/images/policy";
import type { BackgroundFormat, BackgroundResult } from "@/lib/images/background";
import { runBackgroundTask } from "@/lib/images/backgroundClient";
import { useBlobUrl } from "../tools/useBlobUrl";
import { BeforeAfterComparison, ControlGroup, DetailsTable, FileDetails, FileDropzone, FilePicker, InlineMessage, PrimaryButton, ProcessingPanel, ResultPanel, SegmentedChoice, Stage, ToolControls, ToolSurface, shortSize, styles, useResultView } from "../tools/surface/ToolSurface";
import { useImageJob } from "./useImageJob";

/* Background Remover: upload -> choose transparent or a colour -> remove (model runs in a worker) -> compare -> download. */

const ACCEPT = "image/jpeg,image/png,image/webp";
const BACKGROUNDS = [{ value: "transparent", label: "Transparent" }, { value: "#ffffff", label: "White" }, { value: "custom", label: "Colour" }];
const baseName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100) || "image";

export function BackgroundRemover() {
  const job = useImageJob(), { file, info } = job;
  const [background, setBackground] = useState("transparent"), [custom, setCustom] = useState("#dce9f5"), [format, setFormat] = useState<BackgroundFormat>("image/png");
  const [result, setResult] = useState<BackgroundResult>(), [busy, setBusy] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const inputUrl = useBlobUrl(info?.preview), outputUrl = useBlobUrl(result?.preview), downloadUrl = useBlobUrl(result?.blob);
  const view = useResultView(!!(result && downloadUrl));
  const fill = background === "transparent" ? undefined : background === "custom" ? custom : background;
  const outputFormat: BackgroundFormat = fill ? "image/png" : format;

  const clear = () => { active.current?.abort(); active.current = null; setBusy(""); setResult(undefined); setError(""); setNotice(""); };
  const load = (files: FileList) => { clear(); void job.load(files, () => {}); };
  const changed = () => { setResult(undefined); setError(""); setNotice(""); };
  function cancel() { active.current?.abort(); active.current = null; setBusy(""); setNotice("Background removal cancelled. Your image is unchanged; try again when ready."); }
  async function remove() {
    if (!file) return;
    view.showLatest(); changed();
    const controller = new AbortController(); active.current?.abort(); active.current = controller; setBusy("Starting…");
    try { const output = await runBackgroundTask({ file, format: outputFormat, fill }, controller.signal, status => { if (!controller.signal.aborted) setBusy(status); }); if (!controller.signal.aborted) setResult(output); }
    catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Background removal failed. Try another image."); }
    finally { if (active.current === controller) { active.current = null; setBusy(""); } }
  }

  if (!info || !file) return <section aria-label="Background Remover workspace" className={styles.root}>
    <FileDropzone icon={Eraser} title="Drop a photo here" pickLabel="Choose image" accept={ACCEPT} busy={job.busy} onCancel={job.cancel} onFiles={load}
      facts={<><span><b>JPEG</b>, <b>PNG</b> or <b>WebP</b></span><span>Up to 25 MiB</span><span>Works best with one clear subject</span></>} />
    {job.notice && <InlineMessage role="status">{job.notice}</InlineMessage>}
    {job.error && <InlineMessage role="alert" tone="error">{job.error}</InlineMessage>}
  </section>;

  const extension = IMAGE_FORMATS[result?.format ?? outputFormat].extension;
  return <section aria-label="Background Remover workspace" className={styles.root}>
    <ToolSurface onFiles={load}
      file={<FileDetails name={file.name} factsLabel="Original details" onStartOver={() => { clear(); job.reset(); }}
        thumb={inputUrl ? <img className={styles.thumb} src={inputUrl} alt="" width={48} height={48} /> : <span className={styles.thumb} />}
        picker={<FilePicker label="Replace image" inputLabel="Choose image" accept={ACCEPT} onFiles={load} />}
        facts={<><span>{info.width} × {info.height} px</span><span>{shortSize(file.size)}</span><span>{IMAGE_FORMATS[info.format].label}</span></>} />}
      stage={<Stage busy={!!busy} processing={<ProcessingPanel title="Removing background" status={busy} onCancel={cancel} />}>
        {outputUrl && inputUrl ? <BeforeAfterComparison original={inputUrl} result={outputUrl} resultTag="Cut-out" resultAlt="Image with the background removed" /> : inputUrl && <img src={inputUrl} alt="Original image preview" />}
      </Stage>}
      side={result && downloadUrl && view.showResult
        ? <ResultPanel headingRef={view.heading} heading="Background removal result" onAdjust={view.adjust} again={{ label: "Another photo", onClick: () => { clear(); job.reset(); } }} note="Downloads a new file. Your original is unchanged."
          headline={fill ? "Background replaced" : "Background removed"}
          summary={<>{result.width} × {result.height} px {IMAGE_FORMATS[result.format].label}{fill ? "" : " with transparency"}, {shortSize(result.blob.size)}.</>}
          download={{ href: downloadUrl, filename: `${baseName(file.name)}-cutout.${extension}`, label: `Download ${IMAGE_FORMATS[result.format].label}` }}>
          {result.coverage < 0.02 && <InlineMessage role="status" tone="warn" title="No clear subject found">Almost everything was removed. Try a photo where the subject stands out from the background.</InlineMessage>}
          {result.coverage > 0.97 && <InlineMessage role="status" tone="warn" title="Little was removed">The model kept almost the whole image. Busy or similar-coloured backgrounds are hard to separate.</InlineMessage>}
          <DetailsTable
            original={{ title: "Original", label: "Original file", rows: [["Dimensions", `${info.width} × ${info.height} px`], ["Format", IMAGE_FORMATS[info.format].label], ["Size", shortSize(file.size)]] }}
            result={{ title: "Cut-out", label: "Output details", rows: [["Dimensions", `${result.width} × ${result.height} px`], ["Format", IMAGE_FORMATS[result.format].label], ["Size", shortSize(result.blob.size)], ["Subject area", `${Math.round(result.coverage * 100)}% of the image`]] }} />
        </ResultPanel>
        : <ToolControls title="Background settings" controlsRef={view.controls} action={<>
          {notice && <InlineMessage role="status">{notice}</InlineMessage>}
          {error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}
          <PrimaryButton label="Remove background" busyLabel="Removing…" busy={!!busy} onClick={() => void remove()} />
          {view.adjusting && <button type="button" className={`${styles.secondary} ${styles.ghost}`} onClick={view.showLatest}>Back to result</button>}
        </>}>
          <SegmentedChoice legend="New background" name="new-background" options={BACKGROUNDS} value={background} disabled={!!busy} onChange={value => { setBackground(value); changed(); }}
            hint={fill ? "The subject is placed on a solid colour and saved as PNG." : "Saved with a transparent background."} />
          {background === "custom" && <label className={styles.label}>Background colour<input className={styles.field} type="color" disabled={!!busy} value={custom} onChange={event => { setCustom(event.target.value); changed(); }} /></label>}
          {!fill && <SegmentedChoice legend="Output format" name="output-format" options={[{ value: "image/png" as BackgroundFormat, label: "PNG" }, { value: "image/webp" as BackgroundFormat, label: "WebP" }]} value={format} disabled={!!busy} onChange={value => { setFormat(value); changed(); }} hint="Both keep transparency. WebP files are usually smaller." />}
          <ControlGroup label="About this model">
            <p className={styles.help}>A compact salient-object model (U²-Net-p, 4.6 MB) runs in this tab with ONNX Runtime. It finds the most prominent subject; hair, fur and fine edges come out soft. The first run downloads about 19 MB from this site; nothing is uploaded.</p>
          </ControlGroup>
        </ToolControls>} />
  </section>;
}

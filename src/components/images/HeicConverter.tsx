/* eslint-disable @next/next/no-img-element -- Previews are local blob URLs; images never go through a server optimizer. */
"use client";
import { useEffect, useRef, useState } from "react";
import { Aperture, CheckCircle2, Download, Trash2 } from "lucide-react";
import { MAX_HEIC_FILES, jpegName, type HeicResult } from "@/lib/images/heic";
import { runHeicTask } from "@/lib/images/heicClient";
import { useBlobUrl } from "../tools/useBlobUrl";
import { FileDropzone, FilePicker, InlineMessage, PrimaryButton, SegmentedChoice, shortSize, styles } from "../tools/surface/ToolSurface";

/* HEIC to JPG: choose one or more HEIC photos -> pick JPEG quality -> convert one after another -> download each JPG. */

const ACCEPT = ".heic,.heif,.hif,image/heic,image/heif";
const QUALITIES = [{ value: "0.8", label: "Smaller" }, { value: "0.9", label: "Standard" }, { value: "0.95", label: "High" }];
type Item = { id: number; file: File; status: "queued" | "working" | "done" | "error"; result?: HeicResult; error?: string };

function Row({ item, onRemove, disabled }: { item: Item; onRemove: () => void; disabled: boolean }) {
  const preview = useBlobUrl(item.result?.preview), download = useBlobUrl(item.result?.blob);
  return <li className="flex flex-wrap items-center gap-3 border-t border-edge px-4 py-3 first:border-t-0">
    {preview ? <img src={preview} alt="" width={48} height={48} className={styles.thumb} /> : <span className={styles.thumb} aria-hidden />}
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold" title={item.file.name}>{item.status === "done" ? jpegName(item.file.name) : item.file.name}</p>
      <p className="tabular text-xs text-subtle">
        {item.status === "queued" && <>HEIC, {shortSize(item.file.size)}, waiting</>}
        {item.status === "working" && <>Converting…</>}
        {item.status === "done" && item.result && <>JPEG, {item.result.width} × {item.result.height} px, {shortSize(item.result.blob.size)}{item.result.images > 1 ? `. Saved the main image of ${item.result.images}.` : ""}</>}
        {item.status === "error" && <span className="text-danger">{item.error}</span>}
      </p>
    </div>
    {item.status === "done" && download
      ? <a className={styles.secondary} href={download} download={jpegName(item.file.name)}><Download aria-hidden size={15} />Download<span className="sr-only"> {jpegName(item.file.name)}</span></a>
      : item.status === "working" ? <span className={`${styles.spinner} ${styles.small}`} aria-hidden />
      : <button type="button" className={`${styles.secondary} ${styles.ghost}`} disabled={disabled} onClick={onRemove} aria-label={`Remove ${item.file.name}`}><Trash2 aria-hidden size={15} /></button>}
  </li>;
}

export function HeicConverter() {
  const [items, setItems] = useState<Item[]>([]), [quality, setQuality] = useState("0.9");
  const [running, setRunning] = useState(false), [notice, setNotice] = useState(""), [error, setError] = useState("");
  const active = useRef<AbortController | null>(null), nextId = useRef(1);
  useEffect(() => () => active.current?.abort(), []);
  const update = (id: number, patch: Partial<Item>) => setItems(current => current.map(item => item.id === id ? { ...item, ...patch } : item));

  function add(files: FileList) {
    setNotice(""); setError("");
    const incoming = [...files], room = MAX_HEIC_FILES - items.length;
    if (incoming.length > room) setError(`Convert up to ${MAX_HEIC_FILES} photos at a time. ${room > 0 ? `Only the first ${room} were added.` : "Clear the list to add more."}`);
    // Results already converted stay; changing quality only affects photos still waiting.
    setItems(current => [...current, ...incoming.slice(0, Math.max(0, room)).map(file => ({ id: nextId.current++, file, status: "queued" as const }))]);
  }
  async function convert() {
    const controller = new AbortController(); active.current = controller; setRunning(true); setNotice(""); setError("");
    const queue = items.filter(item => item.status === "queued" || item.status === "error");
    for (const item of queue) {
      if (controller.signal.aborted) break;
      update(item.id, { status: "working", error: undefined });
      try { const result = await runHeicTask({ file: item.file, quality: Number(quality) }, controller.signal); update(item.id, { status: "done", result }); }
      catch (failure) {
        if (controller.signal.aborted) { update(item.id, { status: "queued" }); break; }
        update(item.id, { status: "error", error: failure instanceof Error ? failure.message : "Conversion failed." });
      }
    }
    if (active.current === controller) { active.current = null; setRunning(false); }
  }
  function cancel() { active.current?.abort(); active.current = null; setRunning(false); setNotice("Conversion cancelled. Photos already converted are still available; the rest are waiting."); }
  function clear() { active.current?.abort(); active.current = null; setRunning(false); setItems([]); setNotice(""); setError(""); }

  const done = items.filter(item => item.status === "done").length, pending = items.filter(item => item.status === "queued" || item.status === "error").length;
  const position = items.findIndex(item => item.status === "working") + 1;

  if (!items.length) return <section aria-label="HEIC to JPG workspace" className={styles.root}>
    <FileDropzone icon={Aperture} title="Drop HEIC photos here" pickLabel="Choose photos" inputLabel="Choose HEIC photos" accept={ACCEPT} multiple onCancel={cancel} onFiles={add}
      facts={<><span><b>HEIC</b> or <b>HEIF</b></span><span>Up to {MAX_HEIC_FILES} photos</span><span>25 MiB and 50 megapixels each</span></>} />
    {error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}
  </section>;

  return <section aria-label="HEIC to JPG workspace" className={styles.root}>
    <div className={styles.surface} style={{ gridTemplateAreas: '"file file" "stage side"' }}>
      <div className={styles.file}>
        <div className={styles.fileText}><p className={styles.fileName}>{items.length} {items.length === 1 ? "photo" : "photos"}</p><p className={styles.fileMeta}><span>{done} converted</span>{pending > 0 && <span>{pending} waiting</span>}</p></div>
        <div className={styles.fileActions}>
          <FilePicker label="Add photos" inputLabel="Choose HEIC photos" accept={ACCEPT} multiple onFiles={add} />
          <button type="button" className={`${styles.secondary} ${styles.ghost}`} onClick={clear}>Start over</button>
        </div>
      </div>
      <div className={styles.stage} style={{ alignItems: "stretch", padding: 0, minHeight: "18rem", backgroundImage: "none", background: "var(--raised)" }}>
        <h2 className="sr-only">Photos</h2>
        <ul aria-label="Photos to convert" className="w-full self-start">{items.map(item => <Row key={item.id} item={item} disabled={running} onRemove={() => setItems(current => current.filter(entry => entry.id !== item.id))} />)}</ul>
      </div>
      <div className={styles.side}>
        <div className={styles.sideBody}>
          <h2 className="sr-only">Conversion settings</h2>
          <SegmentedChoice legend="JPEG quality" name="jpeg-quality" options={QUALITIES} value={quality} disabled={running} onChange={setQuality} hint="Applies to photos not yet converted. Standard keeps photos close to the original at a reasonable size." />
          <p className={styles.help}>The main image of each file is converted with its rotation applied. Location and camera metadata are not copied. Live Photo motion and depth data are not included.</p>
        </div>
        <div className={styles.sideFoot}>
          {notice && <InlineMessage role="status">{notice}</InlineMessage>}
          {error && <InlineMessage role="alert" tone="error">{error}</InlineMessage>}
          {running && <p role="status" aria-live="polite" className={styles.help}>Converting {position || done} of {items.length}…</p>}
          {!running && pending === 0 && done > 0 && <InlineMessage role="status" tone="ok">{done === 1 ? "Your JPG is ready below." : `All ${done} JPGs are ready. Download each one from the list.`}</InlineMessage>}
          {running
            ? <button type="button" className={styles.secondary} onClick={cancel}>Cancel operation</button>
            : <PrimaryButton label={pending ? `Convert ${pending} ${pending === 1 ? "photo" : "photos"} to JPG` : "All photos converted"} busyLabel="Converting…" busy={false} disabled={!pending} onClick={() => void convert()} />}
          {done > 0 && !running && <p className={styles.note}><CheckCircle2 aria-hidden size={13} className="mr-1 inline text-success" />Each download is a new JPG; your HEIC files are unchanged.</p>}
        </div>
      </div>
    </div>
  </section>;
}

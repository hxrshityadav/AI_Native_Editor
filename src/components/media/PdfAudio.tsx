"use client";
import { useState } from "react";
import { FileAudio } from "lucide-react";
import { readPdf, type PdfText } from "@/lib/localtools/pdf";
import { FileDropzone, FileDetails, FilePicker, InlineMessage, ProcessingPanel, styles, shortSize } from "../tools/surface/ToolSurface";
import { LocalSpeech } from "./LocalSpeech";
import { useLocalJob } from "./useLocalJob";

export function PdfAudio() {
  const [file, setFile] = useState<File>(), [from, setFrom] = useState(1), [to, setTo] = useState(1), [selection, setSelection] = useState<{ id: number; text: string }>();
  const job = useLocalJob<PdfText>(), result = job.result;
  const validRange = !!result && Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to >= from && to <= result.pages.length;
  const text = validRange ? result!.pages.slice(from - 1, to).join("\n\n") : "";
  const problems = <>{job.error && <InlineMessage role="alert" tone="error">{job.error}</InlineMessage>}{job.notice && <InlineMessage role="status">{job.notice}</InlineMessage>}</>;
  function clear() { job.reset(); setFile(undefined); setSelection(undefined); setFrom(1); setTo(1); }
  async function load(files: FileList) {
    clear(); const selected = files[0]; if (files.length !== 1 || !selected) { await job.run(async () => { throw new Error("Choose one PDF at a time."); }); return; }
    setFile(selected); await job.run((signal, status, progress) => readPdf(selected, signal, status, progress));
  }
  if (!file) return <section className={styles.root}><FileDropzone icon={FileAudio} title="Drop a text-based PDF here" pickLabel="Choose PDF" accept="application/pdf,.pdf" onFiles={files => void load(files)} onCancel={job.cancel} facts={<><span>Up to 10 MiB</span><span>Up to 50 pages</span><span>No OCR or upload</span></>} />{problems}</section>;
  return <section className={styles.root} aria-label="PDF to Audio workspace"><div className="overflow-hidden rounded-2xl border border-edge bg-raised"><FileDetails thumb={<FileAudio aria-hidden />} name={file.name} onStartOver={clear} factsLabel="PDF details" facts={<><span>{shortSize(file.size)}</span>{result && <span>{result.pages.length} pages</span>}</>} picker={<FilePicker label="Replace PDF" inputLabel="Choose PDF" accept="application/pdf,.pdf" onFiles={files => void load(files)} />} />
    <div className="space-y-5 p-5">{job.busy && <ProcessingPanel title="Reading PDF locally" status={job.busy} detail={`${job.elapsed.toFixed(1)} seconds elapsed`} progress={job.progress} progressLabel="PDF pages read" progressUnit="of PDF pages read" onCancel={job.cancel} />}{problems}
      {result && <><div className="grid max-w-xl grid-cols-2 gap-4">{([ ["First page", from, setFrom], ["Last page", to, setTo] ] as const).map(([label, value, update]) => <label className={styles.group} key={label}><span className={styles.label}>{label}</span><input aria-label={label} className={styles.field} type="number" min={1} max={result.pages.length} value={value} onChange={event => { update(Number(event.target.value)); setSelection(undefined); }} /></label>)}</div>
        {!validRange && <InlineMessage role="alert" tone="error">Choose an ordered page range within this PDF.</InlineMessage>}
        {!!result.emptyPages.length && <InlineMessage tone="warn">No selectable text on pages {result.emptyPages.join(", ")}. These pages will contribute no speech. Scanned pages need OCR, which is not provided.</InlineMessage>}
        {!!result.unmappedPages.length && <InlineMessage tone="warn">Possible missing character mappings on pages {result.unmappedPages.join(", ")}. Compare with the original and correct the selected text, or re-export the PDF with valid embedded text. This tool cannot reconstruct missing glyphs.</InlineMessage>}
        <label className={styles.group}><span className={styles.label}>Extracted text · pages {from}–{to}<span className={styles.value}>{text.length.toLocaleString()} characters</span></span><textarea aria-label="Extracted PDF text" className={styles.field} value={text} rows={10} readOnly /></label>
        <InlineMessage>Check reading order, missing glyphs, headers and tables before synthesis. English SpeechT5 only; PDFs in other languages can be inspected but are not translated. Select pages, then edit a section in the speech workspace. Each audio job accepts up to 5,000 characters, split into bounded model segments. No text is silently truncated.</InlineMessage>
        <button className={styles.primary} disabled={!validRange || !text.trim()} onClick={() => setSelection(current => ({ id: (current?.id ?? 0) + 1, text }))}>Use selected text for speech</button>
      </>}
    </div></div>
    {selection && <><h2 className="mt-4 text-xl">Review this selection before generating</h2>{selection.text.length > 5000 && <InlineMessage tone="warn">This selection exceeds 5,000 characters. Edit the text to a shorter section, or choose fewer pages. Speech is disabled until it fits; nothing has been truncated.</InlineMessage>}<LocalSpeech key={`${file.name}-${selection.id}`} initialText={selection.text} document /></>}
  </section>;
}

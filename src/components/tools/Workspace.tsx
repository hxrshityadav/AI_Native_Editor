"use client";
/* eslint-disable @next/next/no-img-element -- Comparison images are local blob URLs. */
import { useId, useState, type ReactNode, type Ref } from "react";
import { AlertCircle, Info, ShieldCheck, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import styles from "./Workspace.module.css";

export { styles };

/**
 * Upload stage, which becomes a compact file bar once a file is open. It is always the workspace's first <div>,
 * so dropping onto it works in both states (the E2E suites drop onto it).
 */
export function DropZone({ icon: Icon, loaded, pickLabel, accept, title, formats, limits, fileName, fileMeta, onFiles, clear }: {
  icon: LucideIcon; loaded: boolean; pickLabel: string; accept: string; title: string; formats: string[]; limits: string;
  fileName?: string; fileMeta?: string[]; onFiles: (files: FileList) => void; clear?: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  const picker = <label className={styles.pick}>{loaded ? "Replace file" : pickLabel}<input aria-label={pickLabel} className="sr-only" type="file" accept={accept} onChange={event => { if (event.target.files?.length) onFiles(event.target.files); event.target.value = ""; }} /></label>;
  return <div className={styles.upload} data-dragging={dragging || undefined} data-loaded={loaded ? "" : undefined}
    onDragOver={event => event.preventDefault()} onDragEnter={() => setDragging(true)}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
    onDrop={event => { event.preventDefault(); setDragging(false); onFiles(event.dataTransfer.files); }}>
    <span className={styles.uploadIcon} aria-hidden><Icon size={loaded ? 20 : 26} strokeWidth={1.75} /></span>
    {loaded
      ? <>
        <div className={styles.fileText}><p className={styles.fileName}>{fileName}</p><p className={styles.fileMeta}>{fileMeta?.map(item => <span key={item}>{item}</span>)}</p></div>
        <div className={styles.fileActions}>{picker}{clear}</div>
      </>
      : <>
        <div><p className={styles.uploadTitle}>{title}</p><p className={styles.uploadHint}>Drag and drop, or choose one from your device</p></div>
        {picker}
        <p className={styles.formats}><span className="sr-only">Supported formats: </span>{formats.map(format => <span key={format}>{format}</span>)}</p>
        <p className={styles.help}>{limits}</p>
        <p className={styles.reassure}><ShieldCheck aria-hidden size={15} />Your file is processed locally and is not uploaded.</p>
      </>}
  </div>;
}

/** Busy state with the current operation, real progress when the pipeline reports it, and cancellation. */
export function Busy({ label, detail, progress, onCancel }: { label: string; detail?: string; progress?: number; onCancel: () => void }) {
  return <div className={styles.busy}>
    <span className={styles.busyText}><span className={styles.spinner} aria-hidden /><span role="status" aria-live="polite">{label}</span>{detail && <span className={styles.value}>{detail}</span>}</span>
    <button type="button" className={styles.secondary} onClick={onCancel}>Cancel operation</button>
    {progress !== undefined && <div className={styles.progress}><progress aria-label="Encoding progress" value={progress} max={1} /><span className={styles.value}>{(progress * 100).toFixed(0)}% of conversion processed</span></div>}
  </div>;
}

/** The one primary action. While busy it shows what is happening and cannot be pressed twice. */
export function PrimaryAction({ label, busyLabel, busy, disabled, onClick }: { label: string; busyLabel: string; busy: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className={styles.primary} aria-busy={busy || undefined} disabled={busy || disabled} onClick={onClick}>
    {busy ? <><span className={styles.spinner} aria-hidden />{busyLabel}</> : label}
  </button>;
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return <p role="alert" className={`${styles.message} ${styles.error}`}><AlertCircle aria-hidden />{children}</p>;
}

export function Tip({ label, children, align }: { label: string; children: ReactNode; align?: "end" }) {
  const id = useId();
  return <span className={styles.tip} data-align={align}>
    <button type="button" aria-label={label} aria-describedby={id} onKeyDown={event => { if (event.key === "Escape") event.currentTarget.blur(); }}><Info aria-hidden size={15} /></button>
    <span role="tooltip" id={id}>{children}</span>
  </span>;
}

export function Panel({ title, panelRef, children, action }: { title: string; panelRef?: Ref<HTMLElement>; children: ReactNode; action: ReactNode }) {
  return <aside ref={panelRef} tabIndex={-1} aria-label={title} className={styles.panel}>
    <div className={styles.panelHead}><h2>{title}</h2></div>
    <div className={styles.panelBody}>{children}</div>
    <div className={styles.actionBar}>{action}</div>
  </aside>;
}

export function Section({ title, tip, children }: { title: string; tip?: ReactNode; children: ReactNode }) {
  return <div role="group" aria-label={title} className={styles.section}>
    <div className={styles.sectionTitle}><h3>{title}</h3>{tip}</div>
    {children}
  </div>;
}

export function AdvancedDetails({ title = "Advanced", children }: { title?: string; children: ReactNode }) {
  return <div className={styles.section}><details className={styles.details}><summary>{title}</summary>{children}</details></div>;
}

/** Mutually exclusive presets. Buttons with aria-pressed, so each is reachable with Tab and announced as on/off. */
export function Segmented<T extends string>({ label, options, value, disabled, onChange }: { label: string; options: { value: T; label: string }[]; value: T | undefined; disabled?: boolean; onChange: (value: T) => void }) {
  return <div role="group" aria-label={label} className={styles.segmented}>
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} disabled={disabled} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}

export type Row = [label: string, value: ReactNode, note?: string];
const Rows = ({ rows }: { rows: Row[] }) => <dl>{rows.map(([label, value, note]) => <div key={label}><dt>{label}</dt><dd>{value}{note && <small>{note}</small>}</dd></div>)}</dl>;

/**
 * Original vs result. Each column keeps an accessible name (originalLabel/resultLabel) so the measured values
 * can be found by assistive technology and by the E2E suites.
 */
export function Comparison({ title, originalLabel, original, resultTitle, resultLabel, result, change }: {
  title: string; originalLabel: string; original: Row[]; resultTitle: string; resultLabel: string; result?: Row[]; change?: number;
}) {
  return <section aria-label={title} className={styles.compareCard}>
    <div className={styles.compareHead}>
      <h3>{title}</h3>
      {result && change !== undefined && <p className={styles.saved} data-better={change > 0 || undefined}>
        {change > 0 ? <TrendingDown aria-hidden size={20} /> : <TrendingUp aria-hidden size={20} />}
        {change > 0 ? `Saved ${(change * 100).toFixed(1)}%` : `${(-change * 100).toFixed(1)}% larger`}
      </p>}
    </div>
    <div className={styles.columns}>
      <div className={styles.column} aria-label={originalLabel}><p className={styles.columnTitle}>Original</p><Rows rows={original} /></div>
      <div className={styles.column}>
        <p className={styles.columnTitle}>{resultTitle}</p>
        {result ? <div aria-label={resultLabel}><Rows rows={result} /></div> : <p className={styles.pending}>Choose your settings and run the tool. The measured result appears here.</p>}
      </div>
    </div>
  </section>;
}

/** Drag or use arrow keys to wipe between the original and the result. Only for images with the same aspect ratio. */
export function CompareSlider({ original, result }: { original: string; result: string }) {
  const [position, setPosition] = useState(50);
  return <div className={styles.compare} style={{ ["--pos" as string]: `${position}%` }}>
    <img src={result} alt="Processed image preview" />
    <img src={original} alt="Original image preview" className={styles.over} />
    <span className={styles.stageLabel} style={{ left: ".75rem" }} aria-hidden>Original</span>
    <span className={styles.stageLabel} style={{ right: ".75rem" }} aria-hidden>Result</span>
    <span className={styles.handle} aria-hidden />
    <input type="range" min={0} max={100} step={1} value={position} aria-label="Comparison position: original on the left, result on the right" aria-valuetext={`${position}% original`} onChange={event => setPosition(Number(event.target.value))} />
  </div>;
}

"use client";
/* eslint-disable @next/next/no-img-element -- Previews are local blob URLs; they never go through a server optimizer. */
import { useEffect, useRef, useState, type DragEvent, type ReactNode, type Ref } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Download, RotateCcw, ShieldCheck, SlidersHorizontal, TrendingDown, TrendingUp, TriangleAlert, type LucideIcon } from "lucide-react";
import styles from "./ToolSurface.module.css";

/*
 * Shared pieces of the local-tool workspace: upload -> configure -> process -> result.
 * They carry layout and states only. Each tool keeps its own controls and its own processing calls.
 */

export { styles };

/**
 * Result vs settings in the controls column. A finished result shows the result panel (and takes focus, so screen
 * readers hear the outcome); "Adjust settings" brings the controls back without discarding the result.
 */
export function useResultView(ready: boolean) {
  const [adjusting, setAdjusting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null), controls = useRef<HTMLDivElement>(null), focusControls = useRef(false);
  const showResult = ready && !adjusting;
  useEffect(() => {
    if (showResult) heading.current?.focus();
    // Focus after the controls have rendered, not on the next frame, which can run before React commits them.
    else if (focusControls.current) { focusControls.current = false; controls.current?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), button:not([disabled])")?.focus(); }
  }, [showResult]);
  return {
    showResult, heading, controls, adjusting: ready && adjusting,
    adjust: () => { focusControls.current = true; setAdjusting(true); },
    showLatest: () => setAdjusting(false),
  };
}

/** Drag-and-drop handlers plus the dragging flag used for the hover state. */
function useFileDrop(onFiles: (files: FileList) => void) {
  const [dragging, setDragging] = useState(false);
  return { dragging, handlers: {
    onDragOver: (event: DragEvent) => event.preventDefault(),
    onDragEnter: () => setDragging(true),
    onDragLeave: (event: DragEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); },
    onDrop: (event: DragEvent) => { event.preventDefault(); setDragging(false); onFiles(event.dataTransfer.files); },
  } };
}

/** A visible button-styled label around a hidden file input. The input's accessible name stays constant across states. */
export function FilePicker({ label, inputLabel, accept, className, multiple, onFiles }: { label: string; inputLabel: string; accept: string; className?: string; multiple?: boolean; onFiles: (files: FileList) => void }) {
  return <label className={className ?? styles.secondary}>{label}<input aria-label={inputLabel} className="sr-only" type="file" accept={accept} multiple={multiple} onChange={event => { if (event.target.files?.length) onFiles(event.target.files); event.target.value = ""; }} /></label>;
}

/** Message with an icon and, optionally, a short title, so state never depends on colour alone. */
export function InlineMessage({ tone = "info", role, title, children }: { tone?: "info" | "error" | "warn" | "ok"; role?: "status" | "alert" | "note"; title?: string; children: ReactNode }) {
  const Icon = { info: null, error: AlertCircle, warn: TriangleAlert, ok: CheckCircle2 }[tone];
  return <p role={role} className={`${styles.message} ${tone === "info" ? "" : styles[tone]}`}>{Icon && <Icon aria-hidden />}{title ? <span><strong className="block font-semibold">{title}</strong><span>{children}</span></span> : children}</p>;
}

/** Upload stage: the only thing on screen until a file is chosen. While a file is being read it shows that, with Cancel. */
export function FileDropzone({ icon: Icon, title, pickLabel, inputLabel, accept, facts, busy, multiple, onCancel, onFiles }: {
  icon: LucideIcon; title: string; pickLabel: string; inputLabel?: string; accept: string; facts: ReactNode; busy?: string; multiple?: boolean; onCancel: () => void; onFiles: (files: FileList) => void;
}) {
  const { dragging, handlers } = useFileDrop(onFiles);
  return <div className={styles.drop} data-dragging={dragging || undefined} {...handlers}>
    {busy
      ? <div className={styles.loading}><span className={styles.spinner} aria-hidden /><p role="status" aria-live="polite">{busy}</p><button type="button" className={styles.secondary} onClick={onCancel}>Cancel operation</button></div>
      : <>
        <span className={styles.dropIcon} aria-hidden><Icon size={26} strokeWidth={1.75} /></span>
        <div><p className={styles.dropTitle}>{title}</p><p className={styles.dropHint}>or browse your device</p></div>
        <FilePicker label={pickLabel} inputLabel={inputLabel ?? pickLabel} accept={accept} multiple={multiple} className={styles.browse} onFiles={onFiles} />
        <p className={styles.facts}>{facts}</p>
        <p className={styles.local}><ShieldCheck aria-hidden size={15} />Processed on your device. Never uploaded.</p>
      </>}
  </div>;
}

/** The working surface: file bar, preview stage and the controls/result column. Dropping a file anywhere replaces it. */
export function ToolSurface({ onFiles, file, stage, side }: { onFiles: (files: FileList) => void; file: ReactNode; stage: ReactNode; side: ReactNode }) {
  const { handlers } = useFileDrop(onFiles);
  return <div className={styles.surface} {...handlers}>{file}{stage}<div className={styles.side}>{side}</div></div>;
}

/** File details bar. `factsLabel` names the measured facts for assistive technology. */
export function FileDetails({ thumb, name, facts, factsLabel, picker, onStartOver }: { thumb: ReactNode; name: string; facts: ReactNode; factsLabel: string; picker: ReactNode; onStartOver: () => void }) {
  return <div className={styles.file}>
    {thumb}
    <div className={styles.fileText}>
      <p className={styles.fileName} title={name}>{name}</p>
      <p className={styles.fileMeta} aria-label={factsLabel}>{facts}</p>
    </div>
    <div className={styles.fileActions}>
      {picker}
      <button type="button" className={`${styles.secondary} ${styles.ghost}`} onClick={onStartOver}><RotateCcw aria-hidden size={15} />Start over</button>
    </div>
  </div>;
}

export function Stage({ busy, plain, children, processing }: { busy?: boolean; plain?: boolean; children: ReactNode; processing?: ReactNode }) {
  return <div className={`${styles.stage} ${plain ? styles.plain : ""}`}>
    <h2 className="sr-only">Preview</h2>
    {children}
    {busy && processing}
  </div>;
}

/** Processing overlay. Shows real progress only when the pipeline reports it; otherwise a spinner and the current step. */
export function ProcessingPanel({ title, status, detail, progress, onCancel, progressLabel = "Encoding progress", progressUnit = "of conversion processed" }: { title: string; status: string; detail?: string; progress?: number; onCancel: () => void; progressLabel?: string; progressUnit?: string }) {
  return <div className={styles.working}><div className={styles.workingCard}>
    <span className={styles.spinner} aria-hidden />
    <p className={styles.workingTitle}>{title}</p>
    <p role="status" aria-live="polite" className={styles.workingText}>{status}</p>
    {detail && <p className={styles.value}>{detail}</p>}
    {progress !== undefined && <div className={styles.progress}><progress aria-label={progressLabel} value={progress} max={1} /><span className={styles.value}>{(progress * 100).toFixed(0)}% {progressUnit}</span></div>}
    <button type="button" className={styles.secondary} onClick={onCancel}>Cancel operation</button>
  </div></div>;
}

/** Controls column with a sticky action bar, so the primary action stays on screen. */
export function ToolControls({ title, controlsRef, children, action }: { title: string; controlsRef?: Ref<HTMLDivElement>; children: ReactNode; action: ReactNode }) {
  return <>
    <div ref={controlsRef} className={styles.sideBody}><h2 className="sr-only">{title}</h2>{children}</div>
    <div className={styles.sideFoot}>{action}</div>
  </>;
}

export function ControlGroup({ label, aside, children }: { label?: string; aside?: ReactNode; children: ReactNode }) {
  return <div className={styles.group}>{label && <span className={styles.label}>{label}{aside}</span>}{children}</div>;
}

/** Mutually exclusive choice as a real radio group; looks like a segmented control. */
export function SegmentedChoice<T extends string>({ legend, name, options, value, disabled, hint, onChange }: { legend: string; name: string; options: { value: T; label: string }[]; value: T; disabled?: boolean; hint?: ReactNode; onChange: (value: T) => void }) {
  return <fieldset className={styles.group} disabled={disabled}>
    <legend className={styles.label}>{legend}</legend>
    <div className={styles.segment} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>{options.map(option => <label key={option.value}>{option.label}<input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} /></label>)}</div>
    {hint && <p className={styles.help}>{hint}</p>}
  </fieldset>;
}

/** Quality slider with an exact percentage input; typing commits valid values and settles on blur. */
export function QualityControl({ value, disabled, lossless, onChange }: { value: number; disabled?: boolean; lossless?: boolean; onChange: (value: number) => void }) {
  const [text, setText] = useState<string>();
  return <ControlGroup label="Quality">
    <div className={styles.qualityRow}>
      <input className={styles.range} aria-label="Quality ceiling" type="range" min={0.1} max={1} step={0.01} value={value} disabled={disabled || lossless} onChange={event => { setText(undefined); onChange(Number(event.target.value)); }} />
      <span className={styles.percent}><input className={styles.field} aria-label="Quality value" type="number" inputMode="numeric" min={10} max={100} step={1} value={text ?? Math.round(value * 100)} disabled={disabled || lossless}
        onChange={event => { setText(event.target.value); const next = Number(event.target.value); if (event.target.value !== "" && next >= 10 && next <= 100) onChange(Math.round(next) / 100); }} onBlur={() => setText(undefined)} /><span aria-hidden>/100</span></span>
    </div>
    {!lossless && <div aria-hidden className={styles.scale}><span>Smaller file</span><span>Balanced</span><span>Higher quality</span></div>}
    <p className={styles.help}>{lossless ? "PNG is lossless. Quality settings do not reduce its size." : "The encoder's quality setting, not a measure of how the result looks. Lower values give smaller files with more visible compression."}</p>
  </ControlGroup>;
}

/** Number plus unit for a size target. Optional chips set both at once. */
export function TargetSizeInput<U extends string>({ inputLabel, unitLabel, value, unit, units, presets, disabled, onValue, onUnit }: {
  inputLabel: string; unitLabel: string; value: string; unit: U; units: U[]; presets?: [number, U][]; disabled?: boolean; onValue: (value: string) => void; onUnit: (unit: U) => void;
}) {
  return <>
    <div className={styles.target}>
      <input className={styles.field} aria-label={inputLabel} type="number" inputMode="decimal" min={0.001} step="any" disabled={disabled} value={value} placeholder="e.g. 100…" autoComplete="off" onChange={event => onValue(event.target.value)} />
      <select className={styles.field} aria-label={unitLabel} disabled={disabled} value={unit} onChange={event => onUnit(event.target.value as U)}>{units.map(entry => <option key={entry}>{entry}</option>)}</select>
    </div>
    {presets && <div role="group" aria-label="Common target sizes" className={styles.chips}>{presets.map(([amount, size]) => <button key={`${amount}${size}`} type="button" disabled={disabled} aria-pressed={value === String(amount) && unit === size} onClick={() => { onValue(String(amount)); onUnit(size); }}>{amount} {size}</button>)}</div>}
  </>;
}

export function AdvancedSettings({ title = "Advanced", children }: { title?: string; children: ReactNode }) {
  return <details className={styles.advanced}><summary>{title}<ChevronDown aria-hidden size={16} /></summary><div className={styles.advancedBody}>{children}</div></details>;
}

export function PrimaryButton({ label, busyLabel, busy, disabled, onClick }: { label: string; busyLabel: string; busy: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className={styles.primary} aria-busy={busy || undefined} disabled={busy || disabled} onClick={onClick}>{busy ? <><span className={`${styles.spinner} ${styles.small}`} aria-hidden />{busyLabel}</> : label}</button>;
}

export type Row = [term: string, value: ReactNode, note?: ReactNode];
const Rows = ({ rows }: { rows: Row[] }) => <dl>{rows.map(([term, value, note]) => <div key={term}><dt>{term}</dt><dd>{value}{note && <small>{note}</small>}</dd></div>)}</dl>;

/** Result column: headline, the one primary download, then details and secondary actions. Focus lands on the heading. */
export function ResultPanel({ headingRef, heading, change, headline, summary, download, children, onAdjust, again, note }: {
  headingRef: Ref<HTMLHeadingElement>; heading: string; change?: number; headline?: ReactNode; summary: ReactNode; download: { href: string; filename: string; label: string }; children: ReactNode; onAdjust: () => void; again?: { label: string; onClick: () => void }; note: string;
}) {
  return <>
    <div className={styles.sideBody}>
      <div className={styles.saved}>
        <h2 ref={headingRef} tabIndex={-1} className="sr-only">{heading}</h2>
        {headline && <p className={styles.savedValue}>{headline}</p>}
        {change !== undefined && <p className={styles.savedValue} data-better={change > 0 || undefined}>{change > 0 ? <TrendingDown aria-hidden size={24} /> : <TrendingUp aria-hidden size={24} />}{change > 0 ? `Saved ${(change * 100).toFixed(1)}%` : `${(-change * 100).toFixed(1)}% larger`}</p>}
        <div className={styles.savedSizes}>{summary}</div>
      </div>
      <a className={styles.download} href={download.href} download={download.filename}><Download aria-hidden size={18} />{download.label}</a>
      {children}
    </div>
    <div className={styles.sideFoot}>
      <div className={again ? styles.resultActions : undefined}>
        <button type="button" className={styles.secondary} onClick={onAdjust}><SlidersHorizontal aria-hidden size={15} />Adjust settings</button>
        {again && <button type="button" className={styles.secondary} onClick={again.onClick}><RotateCcw aria-hidden size={15} />{again.label}</button>}
      </div>
      <p className={styles.note}>{note}</p>
    </div>
  </>;
}

/** Original vs result facts in two named columns. */
export function DetailsTable({ original, result }: { original: { title: string; label: string; rows: Row[] }; result: { title: string; label: string; rows: Row[] } }) {
  return <div className={styles.table}>
    <div className={styles.col} aria-label={original.label}><p className={styles.colTitle}>{original.title}</p><Rows rows={original.rows} /></div>
    <div className={styles.col} aria-label={result.label}><p className={styles.colTitle}>{result.title}</p><Rows rows={result.rows} /></div>
  </div>;
}

/** Drag, or use the arrow keys, to wipe between two images of the same aspect ratio. */
export function BeforeAfterComparison({ original, result, resultTag, resultAlt }: { original: string; result: string; resultTag: string; resultAlt: string }) {
  const [position, setPosition] = useState(50);
  return <div className={styles.compare} style={{ ["--pos" as string]: `${position}%` }}>
    <img src={result} alt={resultAlt} />
    <img src={original} alt="Original image preview" className={styles.over} />
    <span className={styles.tag} style={{ left: ".75rem" }} aria-hidden>Original</span>
    <span className={styles.tag} style={{ right: ".75rem" }} aria-hidden>{resultTag}</span>
    <span className={styles.handle} aria-hidden />
    <input type="range" min={0} max={100} step={1} value={position} aria-label={`Comparison position: original on the left, ${resultTag.toLowerCase()} on the right`} aria-valuetext={`${position}% original`} onChange={event => setPosition(Number(event.target.value))} />
  </div>;
}

/** Side-by-side fallback when the two images differ in shape. */
export function SideBySide({ original, result, resultTag, resultAlt }: { original: string; result: string; resultTag: string; resultAlt: string }) {
  return <div className={styles.pair}>
    <figure><span className={styles.tag} style={{ left: ".5rem" }} aria-hidden>Original</span><img src={original} alt="Original image preview" /></figure>
    <figure><span className={styles.tag} style={{ left: ".5rem" }} aria-hidden>{resultTag}</span><img src={result} alt={resultAlt} /></figure>
  </div>;
}

export const shortSize = (size: number) => size < 1000 ? `${size} B` : size < 1000000 ? `${(size / 1000).toFixed(1)} KB` : `${(size / 1000000).toFixed(2)} MB`;

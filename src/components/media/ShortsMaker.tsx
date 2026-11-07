"use client";
import { useMemo, useRef, useState } from "react";
import { Scissors } from "lucide-react";
import { creatorSpec, detectMoments, type CreatorSpec } from "@/lib/localtools/moments";
import { saveCreatorHandoff, consumeCreatorHandoff } from "@/lib/localtools/creator-handoff";
import { useBlobUrl } from "../tools/useBlobUrl";
import { FileDropzone, FileDetails, FilePicker, InlineMessage, ProcessingPanel, Stage, ToolSurface, styles, shortSize } from "../tools/surface/ToolSurface";
import { useTranscriptSession } from "./useTranscriptSession";
import { TranscriptControls, TranscriptEditor } from "./TranscriptControls";
import { useLocalJob } from "./useLocalJob";

export function ShortsMaker() {
  const session = useTranscriptSession(true), handoff = useLocalJob<string>();
  const source = useBlobUrl(session.file), player = useRef<HTMLVideoElement>(null);
  const [maximum, setMaximum] = useState(30), [range, setRange] = useState<{ start: number; end: number }>();
  const [shape, setShape] = useState<CreatorSpec["shape"]>("9:16"), [quality, setQuality] = useState<CreatorSpec["quality"]>("small");
  const [x, setX] = useState(.5), [y, setY] = useState(.5), [time, setTime] = useState(0);
  const busy = session.busy || handoff.busy, duration = Math.min(600, session.info?.duration ?? 0), selected = range ?? { start: 0, end: Math.min(maximum, duration) };
  const moments = useMemo(() => { try { return detectMoments(session.cues, duration, maximum); } catch { return []; } }, [session.cues, duration, maximum]);
  const activeCaption = session.cues.find(cue => time >= cue.start && time < cue.end)?.text;
  const problems = <>{(session.error || handoff.error) && <InlineMessage role="alert" tone="error">{session.error || handoff.error}</InlineMessage>}{(session.notice || handoff.notice) && <InlineMessage role="status">{session.notice || handoff.notice}</InlineMessage>}</>;
  function load(files: FileList) { setRange(undefined); handoff.reset(); void session.load(files); }
  async function openStudio() {
    if (!session.file || !session.info) return;
    const file = session.file;
    const id = await handoff.run(async (signal, status) => {
      const reviewed = creatorSpec.safeParse({ version: 1, duration, ...selected, shape, quality, x, y, cues: session.cues });
      if (!reviewed.success) throw new Error("Choose a 0.1–60-second range inside the source and check all caption text and ordered start/end times.");
      const spec = reviewed.data;
      status("Saving a local copy for a separate Studio project");
      const id = await saveCreatorHandoff(file, spec);
      if (signal.aborted) { await consumeCreatorHandoff(id); throw new DOMException("Cancelled", "AbortError"); }
      return id;
    });
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Studio needs a document navigation to apply its COOP/COEP isolation headers.
    if (id) location.assign(`/studio?creator=${encodeURIComponent(id)}`);
  }
  if (!session.file) return <section className={styles.root}><FileDropzone icon={Scissors} title="Drop a video here" pickLabel="Choose video" accept="video/*" onFiles={load} onCancel={session.cancel} facts={<><span>Up to 10 minutes</span><span>Up to 512 MiB</span><span>Local processing</span></>} />{problems}</section>;
  return <section className={styles.root} aria-label="Shorts Maker workspace"><ToolSurface onFiles={load}
    file={<FileDetails thumb={<Scissors aria-hidden />} name={session.file.name} onStartOver={() => { session.clear(); setRange(undefined); handoff.reset(); }} factsLabel="Original video details" facts={<span>{shortSize(session.file.size)}{session.info ? ` · ${duration.toFixed(2)} seconds` : ""}</span>} picker={<FilePicker label="Replace video" inputLabel="Choose video" accept="video/*" onFiles={load} />} />}
    stage={<Stage plain busy={!!busy} processing={<ProcessingPanel title="Preparing Short" status={busy} detail={`${(handoff.busy ? handoff.elapsed : session.elapsed).toFixed(1)} seconds elapsed`} progress={session.progress} onCancel={() => { session.cancel(); handoff.cancel(); }} />}><div className="w-full space-y-5 p-3"><div className="relative mx-auto overflow-hidden bg-black" style={{ aspectRatio: shape.replace(":", "/"), width: shape === "9:16" ? "min(100%, 14.625rem)" : shape === "1:1" ? "min(100%, 26rem)" : "100%" }}><video ref={player} controls playsInline src={source || undefined} aria-label="Crop preview" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${x * 100}% ${y * 100}%` }} onTimeUpdate={event => { const video = event.currentTarget; setTime(video.currentTime); if (!video.paused && video.currentTime >= selected.end) video.pause(); }} />{activeCaption && <p className="pointer-events-none absolute inset-x-3 bottom-14 rounded bg-black/80 p-2 text-center text-sm text-white">{activeCaption}</p>}</div>
      <button className={styles.secondary} disabled={!session.info || !!busy} onClick={() => { if (player.current) { player.current.currentTime = selected.start; void player.current.play().catch(() => {}); } }}>Preview selected range</button>
      <section className="space-y-3" aria-label="Automatically detected moments"><h2 className={styles.label}>Automatically detected moments</h2><p className={styles.help}>Suggestions use speech segments, pauses, sentence endings and repeated words. They do not predict viral potential or understand the story.</p>{moments.map((moment, index) => <button className={`${styles.secondary} w-full flex-col items-start py-3 text-left`} key={`${moment.start}-${moment.end}`} aria-label={`Select moment ${index + 1}`} disabled={!!busy} onClick={() => setRange({ start: moment.start, end: moment.end })}><strong>{moment.start.toFixed(2)}–{moment.end.toFixed(2)} s · {Math.round(moment.coverage * 100)}% transcript coverage</strong><span className="line-clamp-2 text-sm">{moment.text}</span></button>)}{!moments.length && <p className={styles.help}>Transcribe or add reviewed caption segments to detect moments. You can also choose a range manually.</p>}</section>
      <TranscriptEditor session={{ ...session, busy }} />
    </div></Stage>}
    side={<div className={styles.side}><div className={styles.sideBody}><TranscriptControls session={{ ...session, busy }} /><label className={styles.group}><span className={styles.label}>Maximum suggested clip length</span><input aria-label="Maximum clip seconds" className={styles.field} type="number" min={2} max={60} value={maximum} disabled={!!busy} onChange={event => setMaximum(Number(event.target.value))} /></label>
      <div className="grid grid-cols-2 gap-3">{(["start", "end"] as const).map(key => <label className={styles.group} key={key}><span className={styles.label}>{key === "start" ? "Source start" : "Source end"}</span><input aria-label={`Short ${key}`} className={styles.field} type="number" min={0} max={duration} step={.01} value={selected[key]} disabled={!!busy} onChange={event => setRange({ ...selected, [key]: Number(event.target.value) })} /></label>)}</div>
      <label className={styles.group}><span className={styles.label}>Output shape</span><select aria-label="Short shape" className={styles.field} value={shape} disabled={!!busy} onChange={event => setShape(event.target.value as CreatorSpec["shape"])}><option>9:16</option><option>1:1</option><option>16:9</option></select></label>
      {([ ["Horizontal crop", x, setX], ["Vertical crop", y, setY] ] as const).map(([label, value, update]) => <label className={styles.group} key={label}><span className={styles.label}>{label}</span><input className={styles.range} aria-label={label} type="range" min={0} max={1} step={.01} value={value} disabled={!!busy} onChange={event => update(Number(event.target.value))} /></label>)}
      <label className={styles.group}><span className={styles.label}>Resolution cap</span><select aria-label="Short resolution" className={styles.field} value={quality} disabled={!!busy} onChange={event => setQuality(event.target.value as CreatorSpec["quality"])}><option value="small">720p (no upscaling)</option><option value="reels">1080p (no upscaling)</option></select></label>{problems}
      <InlineMessage>Opening Studio saves a copy of the source in browser storage and creates a separate native project. Pending handoffs expire after one day. Review captions and export quality in Studio, then download there. No upload or watermark.</InlineMessage>
    </div><div className={styles.sideFoot}><button className={styles.primary} disabled={!session.info || !!busy} onClick={() => void openStudio()}>Open selected Short in Studio</button></div></div>} />
  </section>;
}

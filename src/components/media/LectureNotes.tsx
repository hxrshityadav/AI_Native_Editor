"use client";
import { useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { runLocal } from "@/lib/localtools/client";
import type { LocalResult } from "@/lib/localtools/local.worker";
import { noteTime } from "@/lib/localtools/notes";
import { useBlobUrl } from "../tools/useBlobUrl";
import { FileDropzone, FileDetails, FilePicker, InlineMessage, ProcessingPanel, Stage, ToolSurface, styles, shortSize } from "../tools/surface/ToolSurface";
import { useTranscriptSession } from "./useTranscriptSession";
import { TranscriptControls, TranscriptEditor } from "./TranscriptControls";
import { useLocalJob } from "./useLocalJob";

export function LectureNotes() {
  const session = useTranscriptSession(), job = useLocalJob<LocalResult>();
  const [sourceKey, setSourceKey] = useState("");
  const source = useBlobUrl(session.file), player = useRef<HTMLVideoElement>(null);
  const key = JSON.stringify(session.cues), result = sourceKey === key ? job.result : undefined;
  const md = useBlobUrl(result?.blob), txt = useBlobUrl(result?.secondary), notes = result?.notes;
  const busy = session.busy || job.busy;
  const problems = <>{(session.error || job.error) && <InlineMessage role="alert" tone="error">{session.error || job.error}</InlineMessage>}{(session.notice || job.notice) && <InlineMessage role="status">{session.notice || job.notice}</InlineMessage>}</>;
  function load(files: FileList) { job.reset(); setSourceKey(""); void session.load(files); }
  async function generate() { if (!session.info) return; setSourceKey(key); await job.run((signal, status, progress) => runLocal({ kind: "notes", cues: session.cues, duration: session.info!.duration }, signal, status, progress)); }
  if (!session.file) return <section className={styles.root}><FileDropzone icon={NotebookPen} title="Drop a lecture recording here" pickLabel="Choose recording" accept="audio/*,video/*" onFiles={load} onCancel={session.cancel} facts={<><span>Up to 10 minutes</span><span>Up to 512 MiB</span><span>No uploads</span></>} />{problems}</section>;
  return <section className={styles.root} aria-label="Lecture notes workspace"><ToolSurface onFiles={load}
    file={<FileDetails thumb={<NotebookPen aria-hidden />} name={session.file.name} onStartOver={() => { session.clear(); job.reset(); setSourceKey(""); }} factsLabel="Recording details" facts={<span>{shortSize(session.file.size)}{session.info ? ` · ${session.info.duration.toFixed(2)} seconds` : ""}</span>} picker={<FilePicker label="Replace recording" inputLabel="Choose recording" accept="audio/*,video/*" onFiles={load} />} />}
    stage={<Stage plain busy={!!busy} processing={<ProcessingPanel title="Preparing lecture notes" status={busy} detail={`${(job.busy ? job.elapsed : session.elapsed).toFixed(1)} seconds elapsed`} progress={session.progress} onCancel={() => { session.cancel(); job.cancel(); }} />}><div className="w-full space-y-6 p-4"><video ref={player} controls playsInline src={source || undefined} aria-label="Lecture recording preview" className="max-h-64 w-full rounded bg-black" />
      {notes && <section className="space-y-5" aria-label="Generated notes"><h2 className={styles.label}>Key points · extractive summary</h2><p className={styles.help}>Selected quotes ranked by repeated content words, not an explanation or fact check. Review against the recording.</p><ul className="space-y-3">{notes.points.map((cue, i) => <li key={i}><button className={styles.secondary} onClick={() => { if (player.current) player.current.currentTime = cue.start; }} aria-label={`Seek key point ${i + 1}`}>{noteTime(cue.start)}</button><p className="mt-2 whitespace-pre-wrap text-sm">{cue.text}</p></li>)}</ul>
        <h2 className={styles.label}>Timestamped sections</h2>{notes.sections.map((section, i) => <details key={i} className="border-t border-edge pt-3"><summary className="min-h-9 cursor-pointer">{noteTime(section.start)}–{noteTime(section.end)} · {section.cues.length} segments</summary><p className="mt-2 whitespace-pre-wrap text-sm">{section.cues.map(cue => cue.text).join(" ")}</p></details>)}
        <h2 className={styles.label}>Cloze practice cards</h2><p className={styles.help}>Recall the exact missing word from the source. These are not generated knowledge questions.</p>{notes.cards.map((card, i) => <details key={i} className="border-t border-edge pt-3"><summary className="min-h-9 cursor-pointer text-sm">[{noteTime(card.start)}] {card.question}</summary><p className="py-2 text-sm">Answer: {card.answer}</p></details>)}{!notes.cards.length && <p className={styles.help}>No suitable source words for cloze cards. Key points and transcript are still included.</p>}
      </section>}
      <TranscriptEditor session={{ ...session, busy }} />
    </div></Stage>}
    side={<div className={styles.side}><div className={styles.sideBody}><TranscriptControls session={{ ...session, busy }} /><InlineMessage>Review the transcript, then organize it into timestamped sections, selected key quotes and cloze recall prompts. No LLM or additional notes-model download. Edit the transcript and regenerate to update downloads.</InlineMessage>{problems}</div><div className={styles.sideFoot}><button className={styles.primary} disabled={!session.info || !session.cues.length || !!busy} onClick={() => void generate()}>{result ? "Regenerate notes" : "Build structured notes"}</button>{md && <a className={styles.primary} href={md} download="reel-finisher-lecture-notes.md">Download Markdown</a>}{txt && <a className={styles.secondary} href={txt} download="reel-finisher-lecture-notes.txt">Download TXT</a>}<p className={styles.note}>Transcript edits invalidate old downloads. Nothing is uploaded or saved automatically.</p></div></div>} />
  </section>;
}

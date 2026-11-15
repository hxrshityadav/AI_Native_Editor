"use client";
import { useState } from "react";
import { runSpeech, type SpeechAudio } from "@/lib/localtools/speechClient";
import { useBlobUrl } from "../tools/useBlobUrl";
import { InlineMessage, ProcessingPanel, styles, shortSize } from "../tools/surface/ToolSurface";
import { useLocalJob } from "./useLocalJob";

/** Shared by the standalone tool and the document reader; synthesis stays in the existing worker. */
export function LocalSpeech({ initialText = "", document = false }: { initialText?: string; document?: boolean }) {
  const limit = document ? 5000 : 500;
  const [text, setText] = useState(initialText);
  const [consent, setConsent] = useState(false);
  const job = useLocalJob<SpeechAudio>();
  const url = useBlobUrl(job.result?.blob);
  return <section aria-label="Local speech workspace" className={styles.root}>
    <div className={styles.surface}>
      <div className={styles.stage} style={{ backgroundImage: "none", background: "var(--raised)", alignItems: "stretch", minHeight: "20rem" }}>
        <div className="w-full space-y-5 p-5"><label className={styles.group}><span className={styles.label}>Text to read<span className={styles.value}>{text.length.toLocaleString()} / {limit.toLocaleString()}</span></span><textarea aria-label="Text to read" className={styles.field} rows={10} maxLength={limit} value={text} disabled={!!job.busy} onChange={event => { setText(event.target.value); job.reset(); }} placeholder="Type an English passage…" /></label>
          {job.busy && <ProcessingPanel title="Generating local speech" status={job.busy} detail={`${job.elapsed.toFixed(1)} seconds elapsed`} progress={job.progress} progressLabel="Speech segments completed" progressUnit="of speech segments completed" onCancel={job.cancel} />}
          {url && job.result && <><audio aria-label="Generated speech" controls src={url} className="w-full" /><p role="status">Measured output: {job.result.duration.toFixed(2)} seconds · {shortSize(job.result.blob.size)} · 16 kHz mono PCM WAV.{job.result.segments ? ` ${job.result.segments} generated segments.` : ""}</p></>}
        </div>
      </div>
      <div className={styles.side}><div className={styles.sideBody}>
        <label className={styles.group}><span className={styles.label}>Voice</span><select aria-label="Local speech voice" className={styles.field} disabled={!!job.busy}><option>English — generic SpeechT5 voice</option></select></label>
        <InlineMessage tone="info">English only, one generic voice; no voice cloning. {document ? "Up to 5,000 characters per job, generated in sentence-based segments of at most 100 characters with short pauses between them. Output is capped at ten minutes. For a long document, download one selection before choosing the next." : "Up to 500 characters and 60 seconds of generated audio per job. Use device listening for longer passages."} WAV download is real model output.</InlineMessage>
        {document && <InlineMessage>Generation can be slower than playback. Start with one short paragraph on a desktop browser; longer selections may take many minutes. Completed-segment progress is reported only when that segment finishes.</InlineMessage>}
        <label className={styles.help}><input type="checkbox" aria-label="Allow speech model download" checked={consent} disabled={!!job.busy} onChange={event => { setConsent(event.target.checked); job.reset(); }} /> Allow optional speech model downloads (about 370 MiB, plus runtime/config files) and browser caching. Text stays on this device. The first load can take several minutes and substantial memory.</label>
        {job.error && <InlineMessage role="alert" tone="error">{job.error}</InlineMessage>}{job.notice && <InlineMessage role="status">{job.notice}</InlineMessage>}
      </div><div className={styles.sideFoot}><button className={styles.primary} disabled={!consent || !text.trim() || text.length > limit || !!job.busy} onClick={() => void job.run((signal, status, progress) => runSpeech<SpeechAudio>({ kind: document ? "document" : "synthesize", text }, signal, status, progress))}>{job.busy ? "Generating locally…" : job.result ? "Regenerate speech" : "Generate speech"}</button>
        {url && <a className={styles.primary} href={url} download="reel-finisher-speech.wav">Download WAV</a>}
        <p className={styles.note}>No account, upload or watermark. Cancel terminates the inference worker.</p>
      </div></div>
    </div>
  </section>;
}

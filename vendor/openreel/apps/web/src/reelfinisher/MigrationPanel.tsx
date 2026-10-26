import { useEffect, useState } from "react";
import { legacyRecords, reviewMigration, completeMigration, type MigrationReview } from "./migration";
export function MigrationPanel({ onComplete }: { onComplete: () => void }) {
  const [records, setRecords] = useState<{ fingerprint: string; savedAt: number }[]>([]);
  const [selected, setSelected] = useState("");
  const [review, setReview] = useState<MigrationReview | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void legacyRecords().then((value) => { setRecords(value); setSelected(value[0]?.fingerprint ?? ""); }).catch(() => setProblem("Cannot read local drafts. Allow browser storage and reload.")); }, []);
  return <section className="rf-stack"><h2>Import a legacy project</h2>
    <p>The original draft stays in this browser. Choose its original media to create a separate project. Export your current project before switching.</p>
    {records.length ? <><label>Saved draft<select aria-label="Saved draft" disabled={busy} value={selected} onChange={(event) => { setSelected(event.target.value); setReview(null); }}>{records.map((record, i) => <option key={record.fingerprint} value={record.fingerprint}>Draft {i + 1} · {record.savedAt ? new Date(record.savedAt).toLocaleString() : "Manual project"}</option>)}</select></label>
      <label>Reselect original video<input aria-label="Legacy original video" type="file" accept="video/*" disabled={busy} onChange={(event) => {
        const file = event.target.files?.[0]; if (!file) return; setBusy(true); setReview(null); setProblem("");
        void reviewMigration(selected, file).then(setReview).catch((error: Error) => setProblem(error.message)).finally(() => setBusy(false)); event.target.value = "";
      }} /></label></> : <p>No compatible drafts found. Keep the same browser profile used by the legacy editor.</p>}
    {busy && <p role="status">Checking media and local storage…</p>}
    {review && <><p>Verified original media. {review.project.timeline.tracks.flatMap((track) => track.clips).length} video intervals; {review.project.textClips?.length ?? 0} captions and text overlays. Source bounds, audio, composition and caption extensions will be copied.</p>
      {review.problems.map((item) => <p role="alert" key={item}>{item}</p>)}
      <button disabled={busy || !!review.problems.length} onClick={() => { setBusy(true); void completeMigration(review).then(onComplete).catch((error: Error) => setProblem(error.message)).finally(() => setBusy(false)); }}>Create separate browser project</button></>}
    {problem && <p role="alert">{problem}</p>}
    <a href="/studio-legacy" target="_top">Open legacy editor</a>
  </section>;
}

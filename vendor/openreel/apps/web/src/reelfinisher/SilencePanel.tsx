import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "../stores/project-store";
import { useTimelineStore } from "../stores/timeline-store";
import { loadAudioBuffer } from "../utils/load-audio-buffer";
import { removeOutputRange } from "./ripple";
import { snapshotAction } from "./commit";
export function SilencePanel() {
  const project = useProjectStore((state) => state.project);
  const clips = project.timeline.tracks.flatMap((track) => track.clips);
  const [id, setId] = useState(clips[0]?.id ?? "");
  const [threshold, setThreshold] = useState(-38);
  const [minimum, setMinimum] = useState(0.5);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<{ start: number; end: number; selected: boolean }[]>([]);
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  const revision = useRef(project);
  const cancel = () => { generation.current++; worker.current?.terminate(); worker.current = null; setBusy(false); };
  useEffect(() => () => { generation.current++; worker.current?.terminate(); }, []);
  async function analyze() {
    cancel(); setReview([]); setProblem(""); const request = generation.current; revision.current = project;
    const clip = clips.find((clip) => clip.id === id);
    const media = project.mediaLibrary.items.find((item) => item.id === clip?.mediaId);
    if (!clip || !media?.blob) { setProblem("Choose a clip whose original media is available locally."); return; }
    if (clip.reversed || clip.speedKeyframes?.length || clip.freezeFrames?.length) { setProblem("Silence analysis needs a forward clip with constant speed."); return; }
    setBusy(true); const audio = new AudioContext();
    try {
      const buffer = await loadAudioBuffer(audio, media.blob, { audioTrackIndex: clip.audioTrackIndex });
      if (generation.current !== request) return;
      if (!buffer) throw new Error("This browser cannot decode the audio. Choose a supported local file.");
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index).slice());
      const current = new Worker(new URL("./silence-worker.ts", import.meta.url), { type: "module" }); worker.current = current;
      current.onmessage = (event: MessageEvent<{ start: number; end: number }[]>) => {
        if (generation.current !== request) return;
        const rate = (clip.outPoint - clip.inPoint) / clip.duration;
        setReview(event.data.map((cut) => ({ start: clip.startTime + (cut.start - clip.inPoint) / rate, end: clip.startTime + (cut.end - clip.inPoint) / rate, selected: true })));
        if (!event.data.length) setProblem("No silence matched these settings. Adjust the threshold or minimum duration and analyze again.");
        current.terminate(); worker.current = null; setBusy(false);
      };
      current.onerror = () => { cancel(); setProblem("Audio analysis stopped. Retry or use a smaller clip."); };
      current.postMessage({ channels, sampleRate: buffer.sampleRate, inPoint: clip.inPoint, outPoint: clip.outPoint, threshold, minimum, padding: 0.08 }, channels.map((channel) => channel.buffer));
    } catch (error) { if (generation.current === request) { setProblem(error instanceof Error ? error.message : "Audio analysis failed."); setBusy(false); } }
    finally { await audio.close(); }
  }
  return <section className="rf-stack"><h2>Review silence removal</h2><p>Analyze one source locally. Applying the selected ranges removes the same output time across all tracks, captions and overlays in one undo step.</p>
    <label>Source clip<select aria-label="Source clip" value={id} disabled={busy} onChange={(event) => { setId(event.target.value); setReview([]); }}>{clips.map((clip, i) => <option key={clip.id} value={clip.id}>Clip {i + 1} · {clip.startTime.toFixed(2)}s</option>)}</select></label>
    <label>Threshold (dB)<input type="number" min={-80} max={-10} value={threshold} disabled={busy} onChange={(event) => { setThreshold(Number(event.target.value)); setReview([]); }} /></label>
    <label>Minimum silence (s)<input type="number" min={0.2} max={5} step={0.1} value={minimum} disabled={busy} onChange={(event) => { setMinimum(Number(event.target.value)); setReview([]); }} /></label>
    <button disabled={busy || !clips.length} onClick={() => void analyze()}>Analyze local audio</button>{busy && <><p role="status">Decoding and measuring local audio…</p><button onClick={cancel}>Cancel analysis</button></>}
    {review.map((cut, index) => <div key={index} className="rf-row"><label><input type="checkbox" checked={cut.selected} onChange={(event) => setReview(review.map((item, i) => i === index ? { ...item, selected: event.target.checked } : item))} />{cut.start.toFixed(2)}–{cut.end.toFixed(2)}s</label><button onClick={() => useTimelineStore.getState().seekTo(Math.max(0, cut.start - 0.3))}>Preview</button></div>)}
    {!!review.length && <button disabled={busy || !review.some((cut) => cut.selected)} onClick={() => { void (async () => {
      try {
        const state = useProjectStore.getState(); if (state.project !== revision.current) throw new Error("The timeline changed after analysis. Analyze again before applying.");
        let next = state.getFullProject(); for (const range of review.filter((range) => range.selected).sort((a, b) => b.start - a.start)) next = removeOutputRange(next, range.start, range.end);
        const result = await state.executeAction(snapshotAction(next)); if (!result.success) throw new Error(result.error?.message ?? "Cannot apply silence removal."); setReview([]);
      } catch (error) { setProblem(error instanceof Error ? error.message : "Cannot remove silence."); }
    })(); }}>Remove selected silence across project</button>}
    {problem && <p role="alert">{problem}</p>}
  </section>;
}

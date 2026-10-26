import { useEffect, useRef, useState } from "react";
import { CaptionPanel } from "./CaptionPanel";
import { SilencePanel } from "./SilencePanel";
import { MigrationPanel } from "./MigrationPanel";
import { AutoCaptionPanel } from "../components/editor/inspector/AutoCaptionPanel";
import { useProjectStore } from "../stores/project-store";
import { useRouter } from "../hooks/use-router";
export function ReelTools() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("captions");
  const [modelRun, setModelRun] = useState(0);
  const [clipId, setClipId] = useState("");
  const project = useProjectStore((state) => state.project);
  const ref = useRef<HTMLDialogElement>(null);
  const { navigate } = useRouter();
  useEffect(() => { if (open) ref.current?.showModal(); else ref.current?.close(); }, [open]);
  const clips = project.timeline.tracks.flatMap((track) => track.clips);
  return <><button className="rf-tools-button" onClick={() => setOpen(true)}>Captions & tools</button>
    <dialog ref={ref} className="rf-dialog" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} aria-label="Reel Finisher tools"><div className="rf-dialog-head"><strong>Reel Finisher</strong><button aria-label="Close tools" onClick={() => setOpen(false)}>Close</button></div>
      <nav className="rf-tabs" aria-label="Editor tools">{[ ["captions", "Captions"], ["transcribe", "Local Whisper"], ["silence", "Silence"], ["legacy", "Legacy import"] ].map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}</nav>
      {open && <div className="rf-dialog-body">{tab === "captions" && <CaptionPanel />}{tab === "silence" && <SilencePanel />}{tab === "legacy" && <MigrationPanel onComplete={() => { setOpen(false); navigate("editor"); }} />}
        {tab === "transcribe" && <section className="rf-stack"><h2>Local speech recognition</h2><p>Download a model only when you choose “Download / prepare”. Model files are cached for reuse; audio and transcripts stay on your device. These are segment timestamps. Review Hindi/Hinglish wording manually.</p><label>Source clip<select aria-label="Source clip" value={clipId || clips[0]?.id || ""} onChange={(event) => setClipId(event.target.value)}>{clips.map((clip, i) => <option key={clip.id} value={clip.id}>Clip {i + 1} · {clip.startTime.toFixed(2)}s</option>)}</select></label><AutoCaptionPanel key={modelRun} clipId={clipId || clips[0]?.id} /><button onClick={() => setModelRun((value) => value + 1)}>Cancel / reset local model</button></section>}
      </div>}
    </dialog></>;
}

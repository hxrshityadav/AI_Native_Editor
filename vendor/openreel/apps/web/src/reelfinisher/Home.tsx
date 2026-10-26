import { useState } from "react";
import { useProjectStore } from "../stores/project-store";
import { useRouter } from "../hooks/use-router";
import { RecentProjects } from "../components/welcome/RecentProjects";
import { MigrationPanel } from "./MigrationPanel";
export function WelcomeScreen({ initialTab: _initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<"new" | "recent" | "legacy">("new");
  const { navigate } = useRouter();
  return <main className="rf-home"><div className="rf-home-inner"><span className="rf-eyebrow">REEL FINISHER · LOCAL STUDIO</span><h1>Your footage.<br />Your browser. Your edit.</h1><p>Multi-track video editing, Hindi and Hinglish captions, and watermark-free exports. Your media stays on this device.</p>
    <nav aria-label="Projects" className="rf-tabs">{([ ["new", "New project"], ["recent", "Saved projects"], ["legacy", "Import legacy"] ] as const).map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}</nav>
    {tab === "new" && <div className="rf-formats">{([ ["Reel / Short", 1080, 1920, "9:16"], ["Landscape", 1920, 1080, "16:9"], ["Square", 1080, 1080, "1:1"] ] as const).map(([name, width, height, ratio]) => <button key={name} onClick={() => { useProjectStore.getState().createNewProject(name, { width, height, frameRate: 30 }); navigate("editor"); }}><span className="rf-format-icon" style={{ aspectRatio: `${width}/${height}` }} /><strong>{name}</strong><span>{ratio} · {width} × {height}</span></button>)}</div>}
    {tab === "recent" && <RecentProjects onProjectSelected={() => navigate("editor")} />}
    {tab === "legacy" && <MigrationPanel onComplete={() => navigate("editor")} />}
    <footer>Powered by the <a href="/editor/OPENREEL-LICENSE.txt" target="_blank" rel="noreferrer">MIT-licensed OpenReel editor</a>. <a href="/studio-legacy" target="_top">Legacy editor</a></footer>
  </div></main>;
}

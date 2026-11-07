/* Pre-rendered, same-origin Stageshow stills; no runtime or image service. */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CATEGORIES, type ToolCategory } from "@/lib/tools/catalog";

const DESCRIPTIONS: Record<ToolCategory, string> = {
  photo: "Resize, compress and find the right format.",
  video: "Cut a clip. Prepare it for the next screen.",
  audio: "Shape your sound, from a clip to a full recording.",
  ai: "Work with captions, speech and local models.",
};

export function WorkflowShowcase() {
  return <div className="workflow-showcase">
    <nav aria-label="Tool categories" className="workflow-grid">
      {(["photo", "video", "audio", "ai"] as const).map(id => <Link key={id} prefetch={false} href={`/tools?category=${id}`} className="workflow-link">
        <picture><source media="(max-width: 767px)" srcSet={`/illustrations/${id}-compact.webp`} /><img src={`/illustrations/${id}.webp`} alt="" width={1040} height={520} loading="lazy" decoding="async" /></picture>
        <div className="workflow-copy"><h3>{CATEGORIES.find(category => category.id === id)!.title}</h3><p>{DESCRIPTIONS[id]}</p><ArrowUpRight aria-hidden size={19} /></div>
      </Link>)}
    </nav>
    <p className="workflow-caption">Illustrated workflows. Open a tool to work on your own files.</p>
  </div>;
}

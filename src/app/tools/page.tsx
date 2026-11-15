import type { Metadata } from "next";
import { siteOrigin, siteViewport } from "@/lib/site";
export const viewport = siteViewport;
import { SiteShell } from "@/components/site/SiteShell";
import { Suspense } from "react";
import { ToolFinder, ToolFinderFromUrl } from "@/components/site/ToolFinder";
import { TOOLS, availableTools } from "@/lib/tools/catalog";

export const metadata: Metadata = { title: "Free video, audio & photo tools · Reel Finisher", description: "Compress, convert, trim and clean video, audio and photos locally in your browser. No uploads or accounts required.", ...(siteOrigin() ? { alternates: { canonical: "/tools" } } : {}) };

export default function ToolsPage() {
  return <SiteShell>
    <main className="directory-page">
      <header className="directory-header">
        <h1>Video, audio &amp; photo tools</h1>
        <p>Edit, convert and optimize your media without installing software. Local tools keep your files on your device.</p>
        <p className="meta">{availableTools.length} tools available now{TOOLS.length > availableTools.length ? `, ${TOOLS.length - availableTools.length} planned` : ""}</p>
      </header>
      <div className="mt-6"><Suspense fallback={<ToolFinder />}><ToolFinderFromUrl /></Suspense></div>
    </main>
  </SiteShell>;
}


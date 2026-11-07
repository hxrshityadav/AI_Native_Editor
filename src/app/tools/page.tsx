import type { Metadata } from "next";
import { siteOrigin, siteViewport } from "@/lib/site";
export const viewport = siteViewport;
import { SiteShell } from "@/components/site/SiteShell";
import { Suspense } from "react";
import { ToolFinder, ToolFinderFromUrl } from "@/components/site/ToolFinder";
import { TOOLS, availableTools } from "@/lib/tools/catalog";

export const metadata: Metadata = { title: "Free video, audio & photo tools · Reel Finisher", description: "Compress videos, or compress, resize and convert images locally in your browser, plus captions in Reel Studio. No uploads or accounts required.", ...(siteOrigin() ? { alternates: { canonical: "/tools" } } : {}) };

export default function ToolsPage() {
  return <SiteShell>
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="directory-header">
        <h1 className="mt-2 text-[2rem] leading-[1.08] sm:text-[2.75rem]">Video, audio &amp; photo tools</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-subtle">Edit, convert and optimize your media without installing software. Local tools keep your files on your device.</p>
        <p className="tabular mt-4 text-sm text-faint">{availableTools.length} tools available now{TOOLS.length > availableTools.length ? `, ${TOOLS.length - availableTools.length} planned` : ""}</p>
      </header>
      <div className="mt-8"><Suspense fallback={<ToolFinder />}><ToolFinderFromUrl /></Suspense></div>
    </main>
  </SiteShell>;
}


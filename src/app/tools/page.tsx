import type { Metadata } from "next";
import { siteOrigin, siteViewport } from "@/lib/site";
export const viewport = siteViewport;
import { SiteShell } from "@/components/site/SiteShell";
import { Suspense } from "react";
import { ToolFinder, ToolFinderFromUrl } from "@/components/site/ToolFinder";
import { PageHeader } from "@/components/site/ui";

export const metadata: Metadata = { title: "Free photo and video tools · Reel Finisher", description: "Compress videos, or compress, resize and convert still images locally in your browser. No uploads or accounts required.", ...(siteOrigin() ? { alternates: { canonical: "/tools" } } : {}) };

export default function ToolsPage() {
  return <SiteShell>
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader title="Photo and video tools" lead="Prepare images and videos without uploading them. Every tool is free, needs no account and runs on your device." />
      <div className="mt-8"><Suspense fallback={<ToolFinder />}><ToolFinderFromUrl /></Suspense></div>
    </main>
  </SiteShell>;
}

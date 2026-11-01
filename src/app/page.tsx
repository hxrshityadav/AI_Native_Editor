import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { siteOrigin, siteViewport } from "@/lib/site";
import { TOOLS } from "@/lib/tools/catalog";
import { SiteShell } from "@/components/site/SiteShell";
import { ToolDirectory } from "@/components/site/ToolDirectory";
import { ToolGlyph, buttonClass } from "@/components/site/ui";

export const viewport = siteViewport;
export const metadata: Metadata = { ...(siteOrigin() ? { alternates: { canonical: "/" } } : {}) };

const PROMISES = ["Processed on this device", "No account", "No watermark"];

export default function Home() {
  return <SiteShell>
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8">
      <section className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-12">
        <div className="max-w-2xl">
          <h1 className="text-[2.25rem] leading-[1.05] sm:text-[3rem]">Photo and video tools that work without uploading your files.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-subtle">Compress, resize and convert images, shrink videos, or caption a talking-head reel in the studio. Everything runs in your browser and is free.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/tools" className={buttonClass("primary", "lg")}>Browse tools</Link>
            <Link href="/studio" className={buttonClass("secondary", "lg")}>Open the studio</Link>
          </div>
          <ul aria-label="How the tools work" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            {PROMISES.map(item => <li key={item} className="flex items-center gap-2"><Check aria-hidden className="size-4 text-brand" />{item}</li>)}
          </ul>
        </div>
        <nav aria-labelledby="start-with" className="rounded-[var(--radius-panel)] border border-edge bg-raised p-2">
          <h2 id="start-with" className="px-3 pb-1 pt-2 text-sm font-semibold text-subtle">Start with a tool</h2>
          <ul>{TOOLS.filter(tool => tool.href.startsWith("/tools/")).map(tool => <li key={tool.href}>
            <Link href={tool.href} className="group flex min-h-12 items-center gap-3 rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium hover:bg-hover">
              <ToolGlyph icon={tool.icon} small /><span className="flex-1">{tool.title}</span>
              <ArrowRight aria-hidden className="size-4 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink" />
            </Link>
          </li>)}</ul>
        </nav>
      </section>
      <div className="mt-6 border-t border-edge pt-12"><ToolDirectory /></div>
    </main>
  </SiteShell>;
}

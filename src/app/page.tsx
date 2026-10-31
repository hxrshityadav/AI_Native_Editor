import Link from "next/link";
import type { Metadata } from "next";
import { HardDrive, UserX, Stamp } from "lucide-react";
import { siteOrigin } from "@/lib/site";
import { SiteShell } from "@/components/site/SiteShell";
import { ToolDirectory } from "@/components/site/ToolDirectory";
import { buttonClass } from "@/components/site/ui";

export const metadata: Metadata = { ...(siteOrigin() ? { alternates: { canonical: "/" } } : {}) };

const FACTS = [
  { icon: HardDrive, title: "Processed on this device", text: "Photos and videos are read and encoded in your browser tab. They are never uploaded." },
  { icon: UserX, title: "No account", text: "Open a tool and choose a file. There is nothing to sign up for." },
  { icon: Stamp, title: "No watermark", text: "Downloads and exports are clean files you can post anywhere." },
];

/** A drawing of the studio's word-by-word caption style. It is an illustration, not a screenshot of user media. */
function CaptionFrame() {
  return <div aria-hidden className="relative mx-auto aspect-[9/16] w-full max-w-[15rem] overflow-hidden rounded-[22px] border border-edge-strong bg-[#1b1c20] shadow-panel">
    <div className="absolute left-1/2 top-[30%] size-24 -translate-x-1/2 rounded-full bg-[#4a4e58]" />
    <div className="absolute left-1/2 top-[52%] h-40 w-44 -translate-x-1/2 rounded-t-[80px] bg-[#40434c]" />
    <p className="absolute inset-x-4 bottom-[22%] text-center text-[1.05rem] font-extrabold leading-snug text-white [text-shadow:0_2px_6px_rgb(0_0_0/0.6)]">
      edit your reel <span className="rounded-[5px] bg-accent px-1 text-accent-ink [text-shadow:none]">right</span> here
    </p>
    <div className="absolute inset-x-4 bottom-4 h-1 rounded-full bg-white/20"><div className="h-full w-2/5 rounded-full bg-white/80" /></div>
  </div>;
}

export default function Home() {
  return <SiteShell>
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8">
      <section className="grid items-center gap-10 py-10 sm:py-14 md:grid-cols-[minmax(0,1fr)_14rem] lg:gap-12">
        <div className="max-w-2xl">
          <h1 className="text-[2rem] font-semibold leading-[1.08] sm:text-[2.75rem]">Photo and video tools that work without uploading your files.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-subtle">Compress, resize and convert images, shrink videos, or caption a talking-head reel in the studio. Everything runs in your browser and is free.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/tools" className={buttonClass("primary", "lg")}>Browse tools</Link>
            <Link href="/studio" className={buttonClass("secondary", "lg")}>Open the studio</Link>
          </div>
        </div>
        <CaptionFrame />
      </section>

      <ul aria-label="How the tools work" className="grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-edge bg-edge sm:grid-cols-3">
        {FACTS.map(({ icon: Icon, title, text }) => <li key={title} className="flex gap-3 bg-raised p-5">
          <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" strokeWidth={1.75} />
          <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm leading-relaxed text-subtle">{text}</p></div>
        </li>)}
      </ul>

      <div className="mt-16"><ToolDirectory /></div>
    </main>
  </SiteShell>;
}

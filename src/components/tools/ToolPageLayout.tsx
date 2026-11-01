import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Gauge, HardDrive, Layers, WifiOff, type LucideIcon } from "lucide-react";
import { TOOLS, type ToolCategory } from "@/lib/tools/catalog";
import { SiteShell } from "@/components/site/SiteShell";
import { PrivacyBadge, ToolGlyph } from "@/components/site/ui";

/*
 * Tool page architecture: breadcrumb, header, workspace, then secondary content with deliberately different
 * weights (a step sequence, a feature band, prose, a two-column FAQ and related-tool links).
 */

export type Faq = { question: string; answer: string };
type Feature = { icon: LucideIcon; title: string; text: string };

const FEATURES: Record<ToolCategory, Feature[]> = {
  photo: [
    { icon: HardDrive, title: "Runs locally", text: "Encoded by a worker in this browser tab." },
    { icon: WifiOff, title: "No uploads", text: "No server ever receives your image." },
    { icon: Layers, title: "JPEG, PNG and WebP", text: "Read and write the three common web formats." },
    { icon: Gauge, title: "Measured sizes", text: "Every size shown is the real output file." },
  ],
  video: [
    { icon: HardDrive, title: "Runs locally", text: "Encoded on your device with WebCodecs." },
    { icon: WifiOff, title: "No uploads", text: "No server ever receives your video." },
    { icon: Layers, title: "MP4 and WebM", text: "Checked against the encoders your browser has." },
    { icon: Gauge, title: "Measured results", text: "The final size is measured, not estimated." },
  ],
  audio: [],
};
const CATEGORY_NAME: Record<ToolCategory, string> = { photo: "Photo tools", video: "Video tools", audio: "Audio tools" };

export function ToolPageHeader({ category, title, lead }: { category: ToolCategory; title: string; lead: string }) {
  return <>
    <nav aria-label="Breadcrumb"><ol className="flex flex-wrap items-center gap-2 text-sm text-subtle">
      <li><Link href={`/tools#${category}`} className="inline-flex min-h-9 items-center hover:text-ink hover:underline">{CATEGORY_NAME[category]}</Link></li>
      <li aria-hidden className="text-faint">/</li>
      <li aria-current="page" className="text-ink">{title}</li>
    </ol></nav>
    <header className="mt-1">
      <h1 className="text-[2rem] leading-[1.1] sm:text-[2.5rem]">{title}</h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-subtle sm:text-[1.05rem]">{lead}</p>
      <div className="mt-4"><PrivacyBadge /></div>
    </header>
  </>;
}

/** The steps are a real sequence, so they are numbered. Horizontal on wide screens, a list on phones. */
export function ToolHowTo({ title, steps }: { title: string; steps: string[] }) {
  return <section aria-labelledby="how-to">
    <h2 id="how-to" className="text-xl font-semibold">{title}</h2>
    <ol className={`mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2 ${steps.length > 3 ? "lg:grid-cols-5" : "lg:grid-cols-3"}`}>
      {steps.map((step, index) => <li key={step} className="flex gap-3 border-t border-edge-strong pt-3 lg:block">
        <span aria-hidden className="tabular text-sm font-bold text-brand">{index + 1}</span>
        <p className="text-[0.95rem] leading-relaxed text-ink-2 lg:mt-1.5">{step}</p>
      </li>)}
    </ol>
  </section>;
}

/** One divided band rather than a grid of separate cards. */
export function FeatureGrid({ category }: { category: ToolCategory }) {
  return <section aria-labelledby="features">
    <h2 id="features" className="sr-only">Features</h2>
    <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-edge bg-edge lg:grid-cols-4">
      {FEATURES[category].map(({ icon: Icon, title, text }) => <li key={title} className="bg-raised p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold"><Icon aria-hidden className="size-4 shrink-0 text-brand" strokeWidth={1.75} />{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-subtle">{text}</p>
      </li>)}
    </ul>
  </section>;
}

export function ToolInfo({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  return <section aria-labelledby="information" className="max-w-[68ch]">
    <h2 id="information" className="text-xl font-semibold">{title}</h2>
    <div className="mt-4 space-y-4 leading-relaxed text-ink-2">{paragraphs.map(text => <p key={text}>{text}</p>)}</div>
  </section>;
}

export function FAQSection({ items }: { items: Faq[] }) {
  return <section aria-labelledby="faq" className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
    <div>
      <h2 id="faq" className="text-xl font-semibold">Frequently asked questions</h2>
      <p className="mt-2 text-sm leading-relaxed text-subtle">How files are handled is covered in the <Link href="/privacy" className="text-ink underline hover:text-brand">privacy notes</Link>.</p>
    </div>
    <div className="divide-y divide-edge border-y border-edge">{items.map(item => <details key={item.question} className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium hover:text-brand [&::-webkit-details-marker]:hidden">
        {item.question}<span aria-hidden className="text-xl leading-none text-subtle transition-transform duration-150 group-open:rotate-45">+</span>
      </summary>
      <p className="max-w-[68ch] pb-5 leading-relaxed text-subtle">{item.answer}</p>
    </details>)}</div>
  </section>;
}

/** Other working tools, same category first. */
export function RelatedTools({ href, category }: { href: string; category: ToolCategory }) {
  const others = TOOLS.filter(tool => tool.href !== href).sort((a, b) => Number(b.category === category) - Number(a.category === category)).slice(0, 4);
  return <section aria-labelledby="related">
    <h2 id="related" className="text-xl font-semibold">Related tools</h2>
    <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">{others.map(tool => <li key={tool.href} className="min-w-0">
      <Link href={tool.href} className="group flex min-h-16 items-center gap-3 rounded-[var(--radius-panel)] border border-edge bg-raised px-3 py-2.5 transition-colors duration-150 hover:border-edge-strong hover:bg-hover">
        <ToolGlyph icon={tool.icon} small />
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{tool.title}</span><span className="block truncate text-sm text-subtle">{tool.summary}</span></span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5" />
      </Link>
    </li>)}</ul>
  </section>;
}

export function ToolPageLayout({ href, category, title, lead, steps, stepsTitle, info, faqs, children }: {
  href: string; category: ToolCategory; title: string; lead: string; steps: string[]; stepsTitle: string; info: { title: string; paragraphs: string[] }; faqs: Faq[]; children: ReactNode;
}) {
  return <SiteShell>
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <ToolPageHeader category={category} title={title} lead={lead} />
      {children}
      <div className="space-y-20">
        <ToolHowTo title={stepsTitle} steps={steps} />
        <div className="space-y-12"><FeatureGrid category={category} /><ToolInfo {...info} /></div>
        <FAQSection items={faqs} />
        <RelatedTools href={href} category={category} />
      </div>
    </main>
  </SiteShell>;
}

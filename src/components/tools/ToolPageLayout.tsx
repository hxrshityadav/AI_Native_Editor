import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Gauge, HardDrive, Layers, Plus, WifiOff, type LucideIcon } from "lucide-react";
import { availableTools, type ToolCategory } from "@/lib/tools/catalog";
import { SiteShell } from "@/components/site/SiteShell";
import { PrivacyBadge, ToolGlyph } from "@/components/site/ui";
import styles from "./surface/ToolSurface.module.css";

/*
 * Tool page architecture: breadcrumb, header, workspace, then secondary content with deliberately different
 * weights (a step sequence, a feature band, prose, a two-column FAQ and related-tool links).
 */

export type Faq = { question: string; answer: string };
export type Feature = { icon: LucideIcon; title: string; text: string };

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
  audio: [
    { icon: HardDrive, title: "Runs locally", text: "Decoded and encoded by a worker in this tab." },
    { icon: WifiOff, title: "No uploads", text: "No server ever receives your audio." },
    { icon: Layers, title: "M4A, WAV and Ogg", text: "Outputs your browser can really encode." },
    { icon: Gauge, title: "Checked output", text: "Every file is re-read before you download it." },
  ],
  ai: [],
};
const CATEGORY_NAME: Record<ToolCategory, string> = { photo: "Photos", video: "Video", audio: "Audio", ai: "AI tools" };

export function ToolPageHeader({ href, category, title, lead }: { href: string; category: ToolCategory; title: string; lead: string }) {
  return <>
    <nav aria-label="Breadcrumb"><ol className={styles.breadcrumb}>
      <li><Link prefetch={false} href="/tools">All tools</Link></li>
      <li aria-hidden className="text-faint">/</li>
      <li><Link prefetch={false} href={`/tools?category=${category}`}>{CATEGORY_NAME[category]}</Link></li>
      <li aria-hidden className="text-faint">/</li>
      <li aria-current="page" className="text-ink"><a href={href}>{title}</a></li>
    </ol></nav>
    <header className={`tool-header mt-2 ${styles.pageHeader}`}>
      <div className="flex items-center gap-3.5">
        <h1 className="text-[2rem] leading-[1.1] sm:text-[2.5rem]">{title}</h1>
      </div>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-subtle sm:text-[1.05rem]">{lead}</p>
      <div className="mt-4"><PrivacyBadge /></div>
      <nav className="workspace-navigation" aria-label="On this tool page"><a href="#workspace">Workspace</a><a href="#how-to">How to use</a><Link prefetch={false} href={`/tools?category=${category}`}>More {category === "ai" ? "AI tools" : CATEGORY_NAME[category].toLowerCase()}</Link></nav>
    </header>
  </>;
}

/** The steps are a real sequence, so they are numbered. Horizontal on wide screens, a list on phones. */
export function ToolHowTo({ title, steps }: { title: string; steps: string[] }) {
  return <section aria-labelledby="how-to">
    <h2 id="how-to" className="text-xl font-semibold">{title}</h2>
    <ol className={styles.stepList}>
      {steps.map((step, index) => <li key={step}>
        <span aria-hidden className={styles.stepNumber}>{index + 1}</span>
        <p>{step}</p>
      </li>)}
    </ol>
  </section>;
}

/** One divided band rather than a grid of separate cards. */
export function FeatureGrid({ category, features }: { category: ToolCategory; features?: Feature[] }) {
  if (!(features ?? FEATURES[category]).length) return null;
  return <section aria-labelledby="features">
    <h2 id="features" className="sr-only">Features</h2>
    <ul className={styles.featureBand}>
      {(features ?? FEATURES[category]).map(({ icon: Icon, title, text }) => <li key={title}>
        <p><Icon aria-hidden className="size-4" strokeWidth={1.75} />{title}</p>
        <p>{text}</p>
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
      <p className="mt-2 text-sm leading-relaxed text-subtle">How files are handled is covered in the <Link prefetch={false} href="/privacy" className="text-ink underline hover:text-brand">privacy notes</Link>.</p>
    </div>
    <div className="divide-y divide-edge border-y border-edge">{items.map(item => <details key={item.question} className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium hover:text-brand [&::-webkit-details-marker]:hidden">
        {item.question}<Plus aria-hidden className="size-4 shrink-0 text-subtle transition-transform duration-150 group-open:rotate-45" />
      </summary>
      <p className="max-w-[68ch] pb-5 leading-relaxed text-subtle">{item.answer}</p>
    </details>)}</div>
  </section>;
}

/** Other working tools, same category first. */
export function RelatedTools({ href, category }: { href: string; category: ToolCategory }) {
  const others = availableTools.filter(tool => tool.href !== href && tool.title !== "Auto Subtitles").sort((a, b) => Number(b.category === category) - Number(a.category === category)).slice(0, 4);
  return <section aria-labelledby="related">
    <h2 id="related" className="text-xl font-semibold">Related tools</h2>
    <ul className={styles.relatedList}>{others.map(tool => <li key={tool.href} className="min-w-0">
      <Link prefetch={false} href={tool.href!} className={`group ${styles.relatedLink}`}>
        <ToolGlyph icon={tool.icon} small />
        <span className={styles.relatedCopy}><strong>{tool.title}</strong><span>{tool.summary}</span></span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5" />
      </Link>
    </li>)}</ul>
  </section>;
}

export function ToolPageLayout({ href, category, title, lead, steps, stepsTitle, info, faqs, features, children }: {
  href: string; category: ToolCategory; features?: Feature[]; title: string; lead: string; steps: string[]; stepsTitle: string; info: { title: string; paragraphs: string[] }; faqs: Faq[]; children: ReactNode;
}) {
  return <SiteShell>
    <main className={`tool-page tool-${category}`} data-tool={href.split("/").pop()}>
      <ToolPageHeader href={href} category={category} title={title} lead={lead} />
      <div className="tool-workspace" id="workspace">{children}</div>
      <div className="tool-support space-y-16">
        <ToolHowTo title={stepsTitle} steps={steps} />
        <div className="space-y-12"><FeatureGrid category={category} features={features} /><ToolInfo {...info} /></div>
        <FAQSection items={faqs} />
        <RelatedTools href={href} category={category} />
      </div>
    </main>
  </SiteShell>;
}



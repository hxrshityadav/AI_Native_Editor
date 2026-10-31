import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Gauge, HardDrive, Layers, ShieldCheck, WifiOff, type LucideIcon } from "lucide-react";
import { siteOrigin } from "@/lib/site";
import type { ImageTool as Tool } from "@/lib/images/policy";
import { PHOTO_TOOLS } from "@/lib/images/tools";
import type { ToolCategory } from "@/lib/tools/catalog";
import { SiteShell } from "@/components/site/SiteShell";
import { Faq, Steps } from "@/components/site/ui";
import { ImageTool } from "./ImageTool";

const PHOTO_FAQS = [
  { question: "Are my images uploaded or stored?", answer: "No. Processing runs locally in this browser tab. These tools do not upload or persist your image files. Closing or reloading the tab clears the working image; download results you want to keep." },
  { question: "What are the image limits?", answer: "Choose one still JPEG, PNG or WebP up to 25 MiB, 8192 pixels per side and 16 megapixels total. Animated PNG/WebP, GIF, SVG, HEIC and RAW are not supported. A device with less memory may need smaller files." },
];

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

const PHOTO_INFO: Record<Tool, { title: string; paragraphs: string[] }> = {
  compressor: { title: "Which format should I choose?", paragraphs: [
    "WebP is usually the smallest choice for photos and keeps transparency. JPEG opens everywhere but cannot store transparency. PNG is lossless: ideal for screenshots and graphics with sharp edges, but rarely smaller than the original.",
    "If a target size is hard to reach, shrinking the dimensions usually saves far more than lowering quality further. Use “Resize while compressing” under Advanced.",
  ] },
  resizer: { title: "Choosing dimensions", paragraphs: [
    "Resizing an image to the size it will actually be displayed at often saves more space than lowering its quality. Keep the aspect ratio locked to avoid stretching.",
    "Fit presets keep the whole image inside a square box, so a portrait photo fitted within 1080 × 1080 becomes 1080 pixels tall. Presets never enlarge a smaller image.",
  ] },
  converter: { title: "Converting images with transparency", paragraphs: [
    "PNG and WebP keep transparent areas. JPEG has no transparency, so transparent pixels are blended onto a background colour you choose before converting.",
    "Converting does not recover detail: a JPEG converted to PNG keeps its compression artefacts but becomes larger.",
  ] },
};

export function photoMetadata(tool: Tool): Metadata {
  const item = PHOTO_TOOLS[tool];
  return { title: `${item.title} · Reel Finisher`, description: item.description, ...(siteOrigin() ? { alternates: { canonical: `/tools/${item.slug}` } } : {}) };
}

/** Page frame shared by every local tool: breadcrumb, header, workspace, then secondary how-to, features, information and FAQ. */
export function ToolFrame({ category, title, lead, steps, stepsTitle, info, faqs, children }: { category: ToolCategory; title: string; lead: string; steps: string[]; stepsTitle: string; info: { title: string; paragraphs: string[] }; faqs: { question: string; answer: string }[]; children: ReactNode }) {
  const categoryName = { photo: "Photo tools", video: "Video tools", audio: "Audio tools" }[category];
  return <SiteShell>
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <nav aria-label="Breadcrumb"><ol className="flex flex-wrap items-center gap-2 text-sm text-subtle">
        <li><Link href={`/tools#${category}`} className="inline-flex min-h-9 items-center hover:text-ink hover:underline">{categoryName}</Link></li>
        <li aria-hidden className="text-faint">/</li>
        <li aria-current="page" className="text-ink">{title}</li>
      </ol></nav>
      <header className="mt-2">
        <h1 className="text-title font-semibold sm:text-[2.125rem] sm:leading-[1.12]">{title}</h1>
        <p className="mt-2.5 max-w-2xl text-base leading-relaxed text-subtle sm:text-[1.05rem]">{lead}</p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-edge bg-raised px-3 py-1 text-[0.8rem] font-medium text-ink-2"><ShieldCheck aria-hidden className="size-3.5 text-brand" />Runs in your browser. Files are never uploaded.</p>
      </header>
      {children}
      <div className="space-y-16">
        <Steps title={stepsTitle} steps={steps} />
        <section aria-labelledby="features">
          <h2 id="features" className="text-xl font-semibold">Features</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{FEATURES[category].map(({ icon: Icon, title: name, text }) => <li key={name} className="rounded-[var(--radius-panel)] border border-edge bg-raised p-4">
            <Icon aria-hidden className="size-5 text-brand" strokeWidth={1.75} />
            <h3 className="mt-3 text-sm font-semibold">{name}</h3>
            <p className="mt-1 text-sm leading-relaxed text-subtle">{text}</p>
          </li>)}</ul>
        </section>
        <section aria-labelledby="information" className="max-w-3xl">
          <h2 id="information" className="text-xl font-semibold">{info.title}</h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">{info.paragraphs.map(text => <p key={text}>{text}</p>)}</div>
        </section>
        <Faq items={faqs} />
      </div>
    </main>
  </SiteShell>;
}

export function ToolPage({ tool }: { tool: Tool }) {
  const item = PHOTO_TOOLS[tool];
  return <ToolFrame category="photo" title={item.title} lead={item.description} stepsTitle={`How to use the ${item.title.toLowerCase()}`} steps={item.instructions} info={PHOTO_INFO[tool]} faqs={[...item.faqs, ...PHOTO_FAQS]}>
    <ImageTool tool={tool} />
  </ToolFrame>;
}

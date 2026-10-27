import Link from "next/link";
import type { Metadata } from "next";
import { siteOrigin } from "@/lib/site";
import type { ImageTool as Tool } from "@/lib/images/policy";
import { PHOTO_TOOLS } from "@/lib/images/tools";
import { ImageTool } from "./ImageTool";

export function photoMetadata(tool: Tool): Metadata {
  const item = PHOTO_TOOLS[tool];
  return { title: `${item.title} · Reel Finisher`, description: item.description, ...(siteOrigin() ? { alternates: { canonical: `/tools/${item.slug}` } } : {}) };
}
export function ToolPage({ tool }: { tool: Tool }) {
  const item = PHOTO_TOOLS[tool];
  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
    <nav aria-label="Photo tools" className="mb-8 flex flex-wrap gap-x-5 gap-y-3 text-sm underline"><Link href="/">Reel Finisher</Link><Link href="/tools">Photo tools</Link>{Object.entries(PHOTO_TOOLS).filter(([key]) => key !== tool).map(([key, other]) => <Link key={key} href={`/tools/${other.slug}`}>{other.title}</Link>)}</nav>
    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{item.title}</h1>
    <p className="mt-4 max-w-2xl text-lg text-muted">{item.description}</p>
    <ImageTool tool={tool} />
    <section className="max-w-3xl py-4"><h2 className="text-xl font-semibold">How to use the {item.title.toLowerCase()}</h2><ol className="my-4 list-decimal space-y-3 pl-6 leading-relaxed">{item.instructions.map(step => <li key={step}>{step}</li>)}</ol></section>
    <section className="max-w-3xl py-4"><h2 className="text-xl font-semibold">Frequently asked questions</h2>{[...item.faqs, { question: "Are my images uploaded or stored?", answer: "No. Processing runs locally in this browser tab. These tools do not upload or persist your image files. Closing or reloading the tab clears the working image; download results you want to keep." }, { question: "What are the image limits?", answer: "Choose one still JPEG, PNG or WebP up to 25 MiB, 8192 pixels per side and 16 megapixels total. Animated PNG/WebP, GIF, SVG, HEIC and RAW are not supported. A device with less memory may need smaller files." }].map(faq => <details key={faq.question} className="border-b border-line py-4"><summary className="cursor-pointer font-medium">{faq.question}</summary><p className="mt-3 leading-relaxed text-muted">{faq.answer}</p></details>)}</section>
    <footer className="mt-8 flex gap-5 text-sm underline"><Link href="/privacy">Privacy</Link><Link href="/tools">All photo tools</Link></footer>
  </main>;
}

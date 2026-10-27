import Link from "next/link";
import type { Metadata } from "next";
import { PHOTO_TOOLS } from "@/lib/images/tools";
import { siteOrigin } from "@/lib/site";
export const metadata: Metadata = { title: "Free photo tools · Reel Finisher", description: "Compress, resize and convert still images locally in your browser. No uploads or accounts required.", ...(siteOrigin() ? { alternates: { canonical: "/tools" } } : {}) };
export default function ToolsPage() {
  return <main className="mx-auto w-full max-w-3xl px-6 py-16"><Link href="/" className="underline">Reel Finisher</Link><h1 className="mb-4 mt-8 text-3xl font-semibold">Photo tools</h1><p className="mb-8 text-lg text-muted">Prepare an image without uploading it. Free tools for still JPEG, PNG and WebP files.</p><div className="divide-y divide-line">{Object.values(PHOTO_TOOLS).map(tool => <article key={tool.slug} className="py-6"><h2 className="text-xl font-semibold"><Link href={`/tools/${tool.slug}`} className="underline">{tool.title}</Link></h2><p className="mt-3 leading-relaxed text-muted">{tool.description}</p></article>)}</div></main>;
}

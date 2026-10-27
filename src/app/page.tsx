import Link from "next/link";
import type { Metadata } from "next";
import { siteOrigin } from "@/lib/site";

export const metadata: Metadata = { ...(siteOrigin() ? { alternates: { canonical: "/" } } : {}) };

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Reel Finisher</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Turn a raw talking-head video into a captioned Reel or Short. Your video is processed in your browser and
        never uploaded.
      </p>
      <Link href="/studio" className="w-fit rounded-md bg-accent px-4 py-2.5 font-semibold text-accent-ink">
        Open the studio
      </Link>
      <nav aria-label="Information" className="flex flex-wrap gap-4 text-sm underline">
        <Link href="/tools">Free photo tools</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/supported-formats">Supported formats</Link>
      </nav>
    </main>
  );
}

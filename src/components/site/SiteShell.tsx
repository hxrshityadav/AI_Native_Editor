import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { MobileNav, SidebarNav } from "./Sidebar";

export function Wordmark() {
  return <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] pr-2 font-semibold tracking-tight">
    {/* The caption highlight chip is the brand mark: it is how the studio styles the spoken word. */}
    <span aria-hidden className="rounded-[5px] bg-accent px-1.5 py-0.5 text-[0.8rem] font-bold leading-none text-accent-ink">RF</span>
    <span>Reel Finisher</span>
  </Link>;
}

const FOOTER = [["/privacy", "Privacy"], ["/supported-formats", "Supported formats"]];

/** App frame for public pages: persistent tool sidebar on large screens, a top bar with a drawer below that. */
export function SiteShell({ children }: { children: ReactNode }) {
  return <div className="site min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
    <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2.5 focus:text-on-ink">Skip to content</a>
    <div className="hidden border-r border-edge bg-sunken lg:block"><aside className="sticky top-0 flex h-dvh flex-col">
      <div className="flex h-16 shrink-0 items-center px-5"><Wordmark /></div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-4 pb-6 pt-2"><SidebarNav /></nav>
      <div className="border-t border-edge px-5 py-4">
        <p className="flex gap-2 text-xs leading-relaxed text-subtle"><ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-brand" />Files are processed in your browser. Nothing is uploaded.</p>
        <ul className="mt-2 flex flex-wrap gap-x-4">{FOOTER.map(([href, label]) => <li key={href}><Link href={href} className="inline-flex min-h-9 items-center text-xs text-subtle hover:text-ink">{label}</Link></li>)}</ul>
      </div>
    </aside></div>
    <div className="flex min-h-dvh min-w-0 flex-col">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-edge bg-canvas px-4 sm:px-6 lg:hidden"><Wordmark /><MobileNav /></header>
      <div id="content" tabIndex={-1} className="flex flex-1 flex-col outline-none">{children}</div>
      <footer className="border-t border-edge">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-sm text-subtle sm:px-8">
          <p>Free browser tools. No account, no upload, no watermark.</p>
          <ul className="flex flex-wrap gap-x-5">{[...FOOTER, ["/media-notices/SOURCES.txt", "Open-source notices"]].map(([href, label]) => <li key={href}>{href.endsWith(".txt") ? <a href={href} className="inline-flex min-h-11 items-center hover:text-ink">{label}</a> : <Link href={href} className="inline-flex min-h-11 items-center hover:text-ink">{label}</Link>}</li>)}</ul>
        </div>
      </footer>
    </div>
  </div>;
}

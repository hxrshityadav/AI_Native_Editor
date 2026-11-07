import type { ReactNode } from "react";
import Link from "next/link";
import { AppSidebar, MobileNav } from "./Sidebar";
import { CommandPalette, CommandPaletteLauncher } from "@/components/command-center/CommandPalette";
import { RouteActivity } from "@/components/command-center/RouteActivity";
import "./public-site.css";

/** Compact brand mark for the collapsed sidebar rail. */
function Mark() {
  return <Link prefetch={false} href="/" aria-label="Reel Finisher home" title="Reel Finisher" className="grid size-10 place-items-center rounded-[var(--radius-control)] hover:bg-hover">
    <span aria-hidden className="rounded-[5px] bg-accent px-1.5 py-0.5 text-[0.8rem] font-bold leading-none text-accent-ink">RF</span>
  </Link>;
}

export function Wordmark() {
  return <Link prefetch={false} href="/" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] pr-2 font-semibold tracking-tight">
    {/* The caption highlight chip is the brand mark: it is how the studio styles the spoken word. */}
    <span aria-hidden className="rounded-[5px] bg-accent px-1.5 py-0.5 text-[0.8rem] font-bold leading-none text-accent-ink">RF</span>
    <span>Reel Finisher</span>
  </Link>;
}

const FOOTER = [["/tools", "All tools"], ["/command-center", "Command Center"], ["/privacy", "Privacy"], ["/supported-formats", "Supported formats"]];

/** App frame for public pages: persistent tool sidebar on large screens, a top bar with a drawer below that. */
export function SiteShell({ children }: { children: ReactNode }) {
  return <div className="site min-h-dvh lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
    <link rel="preload" href="/fonts/mukta/mukta-latin-700-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
    <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2.5 focus:text-on-ink">Skip to content</a>
    <AppSidebar wordmark={<Wordmark />} mark={<Mark />} />
    <div className="flex min-h-dvh min-w-0 flex-col">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 bg-sunken px-4 sm:px-6 lg:hidden"><Wordmark /><div className="flex items-center gap-2"><CommandPaletteLauncher compact /><MobileNav /></div></header>
      <RouteActivity /><CommandPalette />
      <div id="content" tabIndex={-1} className="flex flex-1 flex-col outline-none">{children}</div>
      <footer className="public-footer">
        <div className="footer-inner">
          <p className="footer-name" aria-hidden>Reel Finisher</p>
          <div className="footer-row">
            <p>Free media tools in your browser. No account, no watermark, and local tools never upload your files.</p>
            <ul>{[...FOOTER, ["/media-notices/SOURCES.txt", "Open-source notices"]].map(([href, label]) => <li key={href}>{href.endsWith(".txt") ? <a href={href}>{label}</a> : <Link prefetch={false} href={href}>{label}</Link>}</li>)}</ul>
          </div>
        </div>
      </footer>
    </div>
  </div>;
}


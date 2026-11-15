import type { ReactNode } from "react";
import Link from "next/link";
import { AppSidebar, MobileNav } from "./Sidebar";
import { CommandPalette } from "@/components/command-center/CommandPalette";
import { CATEGORIES } from "@/lib/tools/catalog";
import { commandTools } from "@/lib/command-center/catalog";
import { BottomTabs, ThemeToggle, TopBar } from "./AppBars";
import { RouteActivity } from "@/components/command-center/RouteActivity";
import "./public-site.css";
import "./public-motion.css";

/** Compact brand mark for the collapsed sidebar rail. */
function Mark() {
  return <Link prefetch={false} href="/" aria-label="Reel Finisher home" title="Reel Finisher" className="grid size-10 place-items-center rounded-[var(--radius-sm)] hover:bg-hover">
    <span aria-hidden className="rounded-[5px] bg-accent px-1.5 py-0.5 text-[0.8rem] font-semibold leading-none text-accent-ink">RF</span>
  </Link>;
}

export function Wordmark() {
  return <Link prefetch={false} href="/" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] pr-2 font-semibold">
    {/* The highlight chip is the brand mark. */}
    <span aria-hidden className="rounded-[5px] bg-accent px-1.5 py-0.5 text-[0.8rem] font-semibold leading-none text-accent-ink">RF</span>
    <span>Reel Finisher</span>
  </Link>;
}

const FOOTER = [["/tools", "All tools"], ["/command-center", "Command Center"], ["/privacy", "Privacy"], ["/supported-formats", "Supported formats"]];

/** App frame for public pages: tool sidebar and top bar on large screens; a header, drawer and bottom tabs on phones. */
export function SiteShell({ children }: { children: ReactNode }) {
  const columns = CATEGORIES.map(category => ({ title: category.navTitle, links: commandTools.filter(tool => tool.category === category.id).map(tool => [tool.href!, tool.navLabel]) }));
  return <div className="site min-h-dvh">
    {/* Applies a saved light theme before first paint; dark is the default. */}
    <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('rf-site-theme')==='light')document.documentElement.dataset.siteTheme='light'}catch(e){}" }} />

    <div className="frame-mask" aria-hidden />
    <div className="app-frame lg:grid">
    <link rel="preload" href="/fonts/geist/Geist-Variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
    <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2.5 focus:text-on-ink">Skip to content</a>
    <AppSidebar mark={<Mark />} />
    <div className="shell-content">
      <header className="mobile-header lg:hidden"><Wordmark /><div className="flex items-center gap-2"><ThemeToggle /><MobileNav /></div></header>
      <TopBar />
      <RouteActivity /><CommandPalette />
      <div className="shell-scroll">
      <div id="content" tabIndex={-1} className="flex flex-1 flex-col outline-none">{children}</div>
      <footer className="public-footer">
        <div className="footer-inner">
          <div className="footer-brand"><Wordmark /><p>Free media tools that run in your browser. No account, no watermark, and local tools never upload your files.</p></div>
          <nav aria-label="Footer" className="footer-columns">
            {columns.map(column => <div key={column.title}><h2>{column.title}</h2><ul>{column.links.map(([href, label]) => <li key={href}><Link prefetch={false} href={href}>{label}</Link></li>)}</ul></div>)}
            <div><h2>Reel Finisher</h2><ul>{[...FOOTER].map(([href, label]) => <li key={href}><Link prefetch={false} href={href}>{label}</Link></li>)}<li><a href="/media-notices/SOURCES.txt">Open-source notices</a></li></ul></div>
          </nav>
        </div>
      </footer>
      </div>
      <BottomTabs />
    </div>
    </div>
  </div>;
}




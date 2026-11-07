"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LayoutGrid, Command, Menu, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { CATEGORIES, toolsIn, type ToolEntry } from "@/lib/tools/catalog";
import { TOOL_ICONS } from "./toolIcons";
import { CommandPaletteLauncher } from "@/components/command-center/CommandPalette";
import { cx } from "./ui";

const MAIN = [{ href: "/", label: "Home", icon: House }, { href: "/command-center", label: "Command Center", icon: Command }, { href: "/tools", label: "All tools", icon: LayoutGrid }];
const COLLAPSED_KEY = "rf-sidebar-collapsed";

function Item({ href, label, icon: Icon, current, compact, onNavigate }: { href: string; label: string; icon: LucideIcon; current: boolean; compact?: boolean; onNavigate?: () => void }) {
  return <li><Link prefetch={false} href={href} onClick={onNavigate} aria-current={current ? "page" : undefined} title={compact ? label : undefined} className={cx(
    "relative flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] text-sm font-medium transition-colors duration-150",
    compact ? "justify-center px-0" : "px-3",
    current ? "bg-brand-soft text-ink" : "text-subtle hover:bg-hover hover:text-ink")}>
    <Icon aria-hidden className="size-4 shrink-0 text-subtle" strokeWidth={1.75} />
    <span className={compact ? "sr-only" : "min-w-0 flex-1 truncate"}>{label}</span>
  </Link></li>;
}

/** Planned tools are listed so the roadmap is visible, but they are not links and say so. */
function PlannedItem({ tool }: { tool: ToolEntry }) {
  const Icon = TOOL_ICONS[tool.icon];
  return <li className="flex min-h-9 items-center gap-3 px-3 text-sm text-faint">
    <Icon aria-hidden className="size-4 shrink-0 opacity-70" strokeWidth={1.75} />
    <span className="min-w-0 flex-1 truncate">{tool.navLabel}</span>
    <span className="text-[0.8125rem] font-medium">Planned<span className="sr-only">, not available yet</span></span>
  </li>;
}

/**
 * Main links, a quick filter, then each category: working tools as links, planned tools behind a small disclosure.
 * `compact` renders the icon rail used when the desktop sidebar is collapsed (working tools only).
 */
export function AppSidebarNav({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (tool: ToolEntry) => words.every(word => `${tool.title} ${tool.navLabel} ${tool.category} ${tool.formats.join(" ")}`.toLowerCase().includes(word));
  const groups = CATEGORIES.map(category => {
    const tools = toolsIn(category.id).filter(matches);
    return { category, links: tools.filter(tool => tool.status === "available"), planned: tools.filter(tool => tool.status === "planned") };
  }).filter(group => group.links.length || (!compact && group.planned.length));
  return <div className={cx("flex flex-col", compact ? "gap-4" : "gap-6")}>
    <ul className="space-y-0.5">{MAIN.map(item => <Item key={item.href} {...item} compact={compact} current={path === item.href} onNavigate={onNavigate} />)}</ul>
    {!compact && <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setQuery(""); }} aria-label="Find a tool" placeholder="Find a tool…" autoComplete="off" spellCheck={false}
        className="min-h-10 w-full rounded-[var(--radius-control)] border border-edge bg-field pl-9 pr-3 text-sm text-ink placeholder:text-faint hover:border-edge-strong" />
    </div>}
    {groups.map(({ category, links, planned }) => <div key={category.id}>
      {compact ? null : <p id={`side-${category.id}`} className="px-3 pb-1.5 text-[0.8125rem] font-semibold text-faint">{category.navTitle}</p>}
      {links.length > 0 && <ul aria-labelledby={compact ? undefined : `side-${category.id}`} aria-label={compact ? category.navTitle : undefined} className="space-y-0.5">
        {links.map(tool => <Item key={`${tool.href}-${tool.title}`} href={tool.href!} label={tool.navLabel} icon={TOOL_ICONS[tool.icon]} compact={compact} current={path === tool.href} onNavigate={onNavigate} />)}
      </ul>}
      {!compact && planned.length > 0 && (words.length
        ? <ul aria-label={`${category.navTitle}, planned`}>{planned.map(tool => <PlannedItem key={tool.title} tool={tool} />)}</ul>
        : <details className="group">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-control)] px-3 text-[0.8125rem] text-faint hover:text-subtle [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="transition-transform duration-150 group-open:rotate-90">›</span>{planned.length} planned
          </summary>
          <ul aria-label={`${category.navTitle}, planned`}>{planned.map(tool => <PlannedItem key={tool.title} tool={tool} />)}</ul>
        </details>)}
    </div>)}
    {words.length > 0 && groups.length === 0 && <p role="status" className="px-3 text-sm text-subtle">No tool matches “{query}”. <Link prefetch={false} href="/tools" onClick={onNavigate} className="text-brand underline">Browse all tools</Link></p>}
  </div>;
}

/** Persistent desktop sidebar with a collapse toggle; the choice is remembered in this browser when storage allows. */
export function AppSidebar({ wordmark, mark }: { wordmark: ReactNode; mark: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Read the saved preference after hydration so server and client markup match.
    try { if (localStorage.getItem(COLLAPSED_KEY) === "1") setCollapsed(true); } catch { /* storage blocked: stay expanded */ }
  }, []);
  const toggle = () => { const next = !collapsed; setCollapsed(next); try { localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0"); } catch { /* not persisted */ } };
  const Toggle = collapsed ? PanelLeftOpen : PanelLeftClose;
  return <div className={cx("hidden bg-sunken transition-[width] duration-150 lg:block", collapsed ? "w-[4.25rem]" : "w-56")}>
    <aside className="sticky top-0 flex h-dvh flex-col">
      <div className={cx("flex h-16 shrink-0 items-center", collapsed ? "justify-center" : "justify-between pl-5 pr-3")}>
        {collapsed ? mark : wordmark}
        {!collapsed && <button type="button" onClick={toggle} aria-expanded aria-label="Collapse sidebar" title="Collapse sidebar" className="grid size-9 place-items-center rounded-[var(--radius-control)] text-faint hover:bg-hover hover:text-ink"><Toggle aria-hidden className="size-4" /></button>}
      </div>
      <div className={cx("pb-3", collapsed ? "px-2" : "px-4")}><CommandPaletteLauncher compact={collapsed} /></div>
      <nav aria-label="Main" className={cx("flex-1 overflow-y-auto pb-6 pt-2", collapsed ? "px-2" : "px-4")}><AppSidebarNav compact={collapsed} /></nav>
      {collapsed
        ? <div className="flex justify-center py-3"><button type="button" onClick={toggle} aria-expanded={false} aria-label="Expand sidebar" title="Expand sidebar" className="grid size-10 place-items-center rounded-[var(--radius-control)] text-faint hover:bg-hover hover:text-ink"><Toggle aria-hidden className="size-4" /></button></div>
        : <div className="bg-canvas/40 px-5 py-4">
          <p className="flex gap-2 text-[0.8125rem] leading-relaxed text-subtle"><ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-brand" />Local tools process files in your browser. Nothing is uploaded.</p>
          <ul className="mt-2 flex flex-wrap gap-x-4">{[["/privacy", "Privacy"], ["/supported-formats", "Supported formats"]].map(([href, label]) => <li key={href}><Link prefetch={false} href={href} className="inline-flex min-h-9 items-center text-[0.8125rem] text-subtle hover:text-ink">{label}</Link></li>)}</ul>
        </div>}
    </aside>
  </div>;
}

/** Below the lg breakpoint the sidebar becomes a modal drawer; <dialog> gives Escape, focus trapping and an inert page. */
export function MobileNav() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => dialog.current?.close();
  return <>
    <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => { dialog.current?.showModal(); setOpen(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-edge-strong bg-raised px-3 text-sm font-semibold hover:bg-hover">
      <Menu aria-hidden className="size-4" />Menu
    </button>
    <dialog ref={dialog} aria-label="Site navigation" onClose={() => setOpen(false)} onClick={event => { if (event.target === dialog.current) close(); }}
      className="m-0 h-dvh max-h-none w-[min(20rem,88vw)] max-w-none overscroll-contain bg-raised p-0 text-ink backdrop:bg-black/60">
      <div className="flex h-full flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between bg-sunken px-4">
          <span className="text-sm font-semibold">Menu</span>
          <button type="button" onClick={close} className="grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-hover" aria-label="Close menu"><X aria-hidden className="size-5" /></button>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">{open && <AppSidebarNav onNavigate={close} />}</nav>
      </div>
    </dialog>
  </>;
}



"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, AudioLines, Command, FileType2, House, Image as ImageIcon, LayoutGrid, Menu, Search, ShieldCheck, Sparkles, Video, X, type LucideIcon } from "lucide-react";
import { CATEGORIES, availableTools, toolsIn, type ToolCategory, type ToolEntry } from "@/lib/tools/catalog";
import { TOOL_ICONS } from "./toolIcons";
import { cx } from "./ui";

const MAIN = [{ href: "/", label: "Home", icon: House }, { href: "/command-center", label: "Command Center", icon: Command }, { href: "/tools", label: "All tools", icon: LayoutGrid }];

function Item({ href, label, icon: Icon, current, compact, onNavigate }: { href: string; label: string; icon: LucideIcon; current: boolean; compact?: boolean; onNavigate?: () => void }) {
  return <li><Link prefetch={false} href={href} onClick={onNavigate} aria-current={current ? "page" : undefined} title={compact ? label : undefined} className={cx(
    "relative flex min-h-10 items-center gap-3 rounded-[var(--radius-sm)] text-sm font-medium transition-colors duration-150",
    compact ? "justify-center px-0" : "px-3",
    current ? "bg-hover text-ink" : "text-subtle hover:bg-hover hover:text-ink")}>
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
export function AppSidebarNav({ compact, onNavigate, includeMain = true }: { compact?: boolean; onNavigate?: () => void; includeMain?: boolean }) {
  const path = usePathname();
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (tool: ToolEntry) => words.every(word => `${tool.title} ${tool.navLabel} ${tool.category} ${tool.formats.join(" ")}`.toLowerCase().includes(word));
  const groups = CATEGORIES.map(category => {
    const tools = toolsIn(category.id).filter(matches);
    return { category, links: tools.filter(tool => tool.status === "available"), planned: tools.filter(tool => tool.status === "planned") };
  }).filter(group => group.links.length || (!compact && group.planned.length));
  return <div className={cx("flex flex-col", compact ? "gap-4" : "gap-6")}>
    {includeMain && <ul className="space-y-0.5">{MAIN.map(item => <Item key={item.href} {...item} compact={compact} current={path === item.href} onNavigate={onNavigate} />)}</ul>}
    {!compact && <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setQuery(""); }} aria-label="Find a tool" placeholder="Find a tool…" autoComplete="off" spellCheck={false}
        className="min-h-10 w-full rounded-[var(--radius-sm)] border border-edge bg-sunken pl-9 pr-3 text-sm text-ink placeholder:text-faint hover:border-edge-strong" />
    </div>}
    {groups.map(({ category, links, planned }) => <div key={category.id}>
      {compact ? null : <p id={`side-${category.id}`} className="px-3 pb-1.5 text-[0.8125rem] font-semibold text-faint">{category.navTitle}</p>}
      {links.length > 0 && <ul aria-labelledby={compact ? undefined : `side-${category.id}`} aria-label={compact ? category.navTitle : undefined} className="space-y-0.5">
        {links.map(tool => <Item key={`${tool.href}-${tool.title}`} href={tool.href!} label={tool.navLabel} icon={TOOL_ICONS[tool.icon]} compact={compact} current={path === tool.href} onNavigate={onNavigate} />)}
      </ul>}
      {!compact && planned.length > 0 && (words.length
        ? <ul aria-label={`${category.navTitle}, planned`}>{planned.map(tool => <PlannedItem key={tool.title} tool={tool} />)}</ul>
        : <details className="group">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-sm)] px-3 text-[0.8125rem] text-faint hover:text-subtle [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="transition-transform duration-150 group-open:rotate-90">›</span>{planned.length} planned
          </summary>
          <ul aria-label={`${category.navTitle}, planned`}>{planned.map(tool => <PlannedItem key={tool.title} tool={tool} />)}</ul>
        </details>)}
    </div>)}
    {words.length > 0 && groups.length === 0 && <p role="status" className="px-3 text-sm text-subtle">No tool matches “{query}”. <Link prefetch={false} href="/tools" onClick={onNavigate} className="text-brand underline">Browse all tools</Link></p>}
  </div>;
}

const RAIL: { href: string; label: string; icon: LucideIcon; category?: ToolCategory }[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/tools", label: "All tools", icon: LayoutGrid },
  { href: "/command-center", label: "Command Center", icon: Command },
  { href: "/tools?category=photo", label: "Photo tools", icon: ImageIcon, category: "photo" },
  { href: "/tools?category=video", label: "Video tools", icon: Video, category: "video" },
  { href: "/tools?category=audio", label: "Audio tools", icon: AudioLines, category: "audio" },
  { href: "/tools?category=ai", label: "AI tools", icon: Sparkles, category: "ai" },
  { href: "/supported-formats", label: "Supported formats", icon: FileType2 },
  { href: "/privacy", label: "Privacy", icon: ShieldCheck },
];

/** One capsule geometry for the desktop rail and the mobile drawer. */
function NavigationCapsule({ id, onNavigate }: { id?: string; onNavigate?: () => void }) {
  const path = usePathname();
  const category = availableTools.find(tool => tool.href === path)?.category;
  return <nav id={id} aria-label="Main" className="rail"><ul>{RAIL.map(item => {
    const current = item.category ? item.category === category : path === item.href;
    return <li key={item.href}><Link prefetch={false} href={item.href} onClick={onNavigate} aria-current={current ? "page" : undefined} aria-label={item.label}>
      <item.icon aria-hidden size={20} strokeWidth={1.6} /><span className="rail-label">{item.label}</span><span className="rail-tooltip" aria-hidden="true">{item.label}</span>
    </Link></li>;
  })}</ul></nav>;
}

/**
 * Desktop navigation rail (reference: LLM Dojo). Hover/focus expansion changes the shared grid column; never overlays the
 * page. Header, content and footer inherit the grid width. Tool pages mark their category as current.
 */
export function AppSidebar({ mark }: { mark: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const region = useRef<HTMLElement>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerInside = useRef(false);
  const focusInside = useRef(false);
  function clearPending() { if (pending.current !== null) clearTimeout(pending.current); pending.current = null; }
  function setExpanded(expanded: boolean) {
    const frame = region.current?.closest<HTMLElement>(".app-frame");
    if (frame) frame.dataset.sidebar = expanded ? "expanded" : "collapsed";
    setCollapsed(!expanded);
  }
  function schedule(expanded: boolean, delay: number) {
    clearPending();
    pending.current = setTimeout(() => {
      pending.current = null;
      if (expanded || (!pointerInside.current && !focusInside.current)) setExpanded(expanded);
    }, delay);
  }
  useEffect(() => () => { if (pending.current !== null) clearTimeout(pending.current); }, []);
  function toggle() { clearPending(); setExpanded(collapsed); }
  return <div className="rail-column">
    <aside ref={region} className="rail-sticky"
      onPointerEnter={event => { if (event.pointerType !== "mouse" || !matchMedia("(any-hover:hover)").matches) return; pointerInside.current = true; schedule(true, 100); }}
      onPointerLeave={event => { if (event.pointerType !== "mouse") return; pointerInside.current = false; if (!focusInside.current) schedule(false, 250); }}
      onFocusCapture={event => { focusInside.current = true; clearPending(); if (!(event.target as HTMLElement).closest(".rail-toggle")) setExpanded(true); }}
      onBlurCapture={event => { if (event.currentTarget.contains(event.relatedTarget)) return; focusInside.current = false; if (!pointerInside.current) schedule(false, 250); }}>
      <div className="rail-mark">{mark}</div>
      <NavigationCapsule id="desktop-navigation" />
      <button className="rail-toggle" type="button" onClick={toggle} aria-label="Toggle sidebar" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-controls="desktop-navigation" aria-expanded={!collapsed}><PanelLeftClose className="collapse-icon" aria-hidden size={20}/><PanelLeftOpen className="expand-icon" aria-hidden size={20}/><span>Collapse sidebar</span></button>
    </aside>
  </div>;
}

/** Below the lg breakpoint the sidebar becomes a modal drawer; <dialog> gives Escape, focus trapping and an inert page. */
export function MobileNav() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => dialog.current?.close();
  useEffect(() => () => document.documentElement.classList.remove("navigation-open"), []);
  return <>
    <button type="button" aria-haspopup="dialog" aria-controls="mobile-navigation" aria-expanded={open} onClick={() => { dialog.current?.showModal(); document.documentElement.classList.add("navigation-open"); setOpen(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-sunken px-4 text-sm font-medium hover:bg-raised">
      <Menu aria-hidden className="size-4" />Menu
    </button>
    <dialog id="mobile-navigation" ref={dialog} aria-label="Site navigation" onClose={() => { document.documentElement.classList.remove("navigation-open"); setOpen(false); }} onClick={event => { if (event.target === dialog.current) close(); }}
      className="m-0 h-dvh max-h-none w-[min(20rem,88vw)] max-w-none overscroll-contain bg-raised p-0 text-ink backdrop:bg-black/60">
      <div className="flex h-full flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between bg-sunken px-4">
          <span className="text-sm font-semibold">Menu</span>
          <button type="button" onClick={close} className="grid size-11 place-items-center rounded-[var(--radius-sm)] hover:bg-hover" aria-label="Close menu"><X aria-hidden className="size-5" /></button>
        </div>
        <div className="mobile-navigation-content flex-1 overflow-y-auto overscroll-contain px-4 py-5">{open && <><NavigationCapsule onNavigate={close} /><nav aria-label="Individual tools" className="mt-6"><AppSidebarNav includeMain={false} onNavigate={close} /></nav></>}</div>
      </div>
    </dialog>
  </>;
}












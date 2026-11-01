"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, FileImage, Film, House, LayoutGrid, Menu, Minimize2, Scaling, Search, X, type LucideIcon } from "lucide-react";
import { CATEGORIES, toolsIn, type ToolIcon } from "@/lib/tools/catalog";
import { cx } from "./ui";

export const TOOL_ICONS: Record<ToolIcon, LucideIcon> = { "compress-image": Minimize2, "resize-image": Scaling, "convert-image": FileImage, "compress-video": Film, editor: Clapperboard };
const MAIN = [{ href: "/", label: "Home", icon: House }, { href: "/tools", label: "All tools", icon: LayoutGrid }, { href: "/studio", label: "Studio", icon: Clapperboard }];

function Item({ href, label, icon: Icon, current, onNavigate }: { href: string; label: string; icon: LucideIcon; current: boolean; onNavigate?: () => void }) {
  return <li><Link href={href} onClick={onNavigate} aria-current={current ? "page" : undefined} className={cx(
    "relative flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium transition-colors duration-150",
    current ? "bg-hover text-ink before:absolute before:inset-y-2 before:-left-3 before:w-0.5 before:rounded-full before:bg-brand" : "text-subtle hover:bg-hover hover:text-ink")}>
    <Icon aria-hidden className={cx("size-4 shrink-0", current ? "text-brand" : "text-faint")} strokeWidth={1.75} />{label}
  </Link></li>;
}

/**
 * Main links, a quick filter, and every working tool grouped by category (video, audio, photo).
 * Categories without tools are left out rather than padded with placeholders.
 */
export function AppSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const groups = CATEGORIES.map(category => ({ category, tools: toolsIn(category.id).filter(tool => tool.href !== "/studio" && words.every(word => `${tool.title} ${category.title} ${tool.formats.join(" ")}`.toLowerCase().includes(word))) })).filter(group => group.tools.length);
  return <div className="flex flex-col gap-6">
    <ul className="space-y-0.5">{MAIN.map(item => <Item key={item.href} {...item} current={path === item.href} onNavigate={onNavigate} />)}</ul>
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setQuery(""); }} aria-label="Find a tool" placeholder="Find a tool…" autoComplete="off" spellCheck={false}
        className="min-h-10 w-full rounded-[var(--radius-control)] border border-edge bg-field pl-9 pr-3 text-sm text-ink placeholder:text-faint hover:border-edge-strong" />
    </div>
    {groups.map(({ category, tools }) => <div key={category.id}>
      <p id={`side-${category.id}`} className="px-3 pb-1.5 text-xs font-semibold text-faint">{category.title} tools</p>
      <ul aria-labelledby={`side-${category.id}`} className="space-y-0.5">{tools.map(tool => <Item key={tool.href} href={tool.href} label={tool.title} icon={TOOL_ICONS[tool.icon]} current={path === tool.href} onNavigate={onNavigate} />)}</ul>
    </div>)}
    {words.length > 0 && groups.length === 0 && <p role="status" className="px-3 text-sm text-subtle">No tool matches “{query}”. <Link href="/tools" onClick={onNavigate} className="text-brand underline">Browse all tools</Link></p>}
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
      className="m-0 h-dvh max-h-none w-[min(20rem,88vw)] max-w-none overscroll-contain border-r border-edge bg-raised p-0 text-ink backdrop:bg-black/60">
      <div className="flex h-full flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-edge px-4">
          <span className="text-sm font-semibold">Menu</span>
          <button type="button" onClick={close} className="grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-hover" aria-label="Close menu"><X aria-hidden className="size-5" /></button>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">{open && <AppSidebarNav onNavigate={close} />}</nav>
      </div>
    </dialog>
  </>;
}

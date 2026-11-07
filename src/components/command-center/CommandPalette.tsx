"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Command, Search, X } from "lucide-react";
import { CATEGORIES } from "@/lib/tools/catalog";
import { searchTools, toolByHref, type CategoryFilter } from "@/lib/command-center/catalog";
import { TOOL_ICONS } from "@/components/site/toolIcons";
import { useWorkspace } from "./useWorkspace";
import "./command-center.css";

const OPEN_EVENT = "rf:open-command-palette";

/** A button that opens the one global palette mounted by the site shell. */
export function CommandPaletteLauncher({ compact = false }: { compact?: boolean }) {
  return <button type="button" className={`cc-launcher${compact ? " cc-launcher-compact" : ""}`} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} aria-label="Open command palette" aria-haspopup="dialog" title="Search tools (Ctrl or ⌘ K)"><Search aria-hidden size={17} />{!compact && <><span>Search tools</span><kbd><Command aria-hidden size={12} /> K</kbd></>}</button>;
}

/** The single palette instance: Ctrl/⌘ K or any launcher opens it. */
export function CommandPalette() {
  const router = useRouter(), state = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null), previousFocus = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [category, setCategory] = useState<CategoryFilter>("all"), [active, setActive] = useState(0);
  const listId = useId();
  const recent = !query.trim() && category === "all" ? state.recent.map(visit => toolByHref.get(visit.href)!).filter(Boolean) : [];
  const matches = searchTools(query, category);
  const results = [...recent, ...matches.filter(tool => !recent.some(item => item.href === tool.href))];
  function show() {
    if (dialog.current?.open) { input.current?.focus(); return; }
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery(""); setCategory("all"); setActive(0); setOpen(true);
    dialog.current?.showModal();
  }
  function close() { dialog.current?.close(); }
  function navigate(href: string) { close(); router.push(href); }
  useEffect(() => {
    function shortcut(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !event.altKey) { event.preventDefault(); show(); }
    }
    window.addEventListener("keydown", shortcut); window.addEventListener(OPEN_EVENT, show);
    return () => { window.removeEventListener("keydown", shortcut); window.removeEventListener(OPEN_EVENT, show); };
  }, []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter"].includes(event.key)) return;
    if (!results.length) return;
    event.preventDefault();
    let next = active;
    if (event.key === "ArrowDown") next = (active + 1) % results.length;
    if (event.key === "ArrowUp") next = (active - 1 + results.length) % results.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = results.length - 1;
    if (event.key === "Enter") { navigate(results[active]?.href || results[0].href!); return; }
    setActive(next);
    document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest" });
  }
  return <>
    <dialog ref={dialog} className="cc-palette" aria-labelledby={`${listId}-title`} onClose={() => { setOpen(false); previousFocus.current?.focus(); }} onClick={event => { if (event.target === dialog.current) close(); }}>
      {open && <><div className="cc-palette-heading"><span id={`${listId}-title`}>Go anywhere</span><button type="button" onClick={close} aria-label="Close command palette"><X aria-hidden size={18} /></button></div>
        <div className="cc-command-input"><Search aria-hidden size={20} /><input ref={input} role="combobox" aria-label="Search commands" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={results[active] ? `${listId}-${active}` : undefined} value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={keyboard} placeholder="Find a tool, format or operation…" autoComplete="off" spellCheck={false} /></div>
        <div className="cc-command-filters" role="group" aria-label="Command category"><button type="button" aria-pressed={category === "all"} onClick={() => { setCategory("all"); setActive(0); }}>All</button>{CATEGORIES.map(item => <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => { setCategory(item.id); setActive(0); }}>{item.title}</button>)}</div>
        <p className="cc-command-context" aria-live="polite">{recent.length ? "Recent tools first" : `${results.length} ${results.length === 1 ? "destination" : "destinations"}`}</p>
        <ul id={listId} role="listbox" aria-label="Tool commands" className="cc-command-results">{results.map((tool, index) => { const Icon = TOOL_ICONS[tool.icon]; return <li key={tool.href} id={`${listId}-${index}`} role="option" aria-selected={index === active} onMouseMove={() => setActive(index)} onClick={() => navigate(tool.href!)}><Icon aria-hidden size={19} /><span><strong>{tool.title}</strong><small>{tool.category === "ai" ? "AI tools" : tool.category} · {tool.formats.slice(0, 3).join(", ")}</small></span><ArrowUpRight aria-hidden size={16} /></li>; })}</ul>
        {!results.length && <p className="cc-command-empty" role="status">No matching tool. Try a format such as MP4, or choose another category.</p>}
        <div className="cc-command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>
      </>}
    </dialog>
  </>;
}

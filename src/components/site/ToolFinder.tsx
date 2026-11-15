"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { CATEGORIES, TOOLS, type ToolCategory } from "@/lib/tools/catalog";
import { CategorySection } from "./ToolDirectory";
import { EmptyState, cx } from "./ui";

type Filter = ToolCategory | "all";
const isFilter = (value: string | null): value is Filter => value === "all" || CATEGORIES.some(item => item.id === value);

/** Reads ?q= and ?category= so a filtered view can be shared or reloaded. Must sit inside <Suspense> on this static page. */
export function ToolFinderFromUrl() {
  const params = useSearchParams(), category = params.get("category");
  return <ToolFinder initialQuery={params.get("q") ?? ""} initialCategory={isFilter(category) ? category : "all"} />;
}

/** /tools: search and category filter over the real tool list. The prerendered fallback shows every tool. */
export function ToolFinder({ initialQuery = "", initialCategory = "all" }: { initialQuery?: string; initialCategory?: Filter }) {
  const [query, setQueryState] = useState(initialQuery), [category, setCategoryState] = useState<Filter>(initialCategory);
  const sync = (q: string, c: Filter) => {
    const params = new URLSearchParams(); if (q) params.set("q", q); if (c !== "all") params.set("category", c);
    window.history.replaceState(null, "", params.size ? `/tools?${params}` : "/tools");
  };
  const setQuery = (value: string) => { setQueryState(value); sync(value, category); };
  const setCategory = (value: Filter) => { setCategoryState(value); sync(query, value); };
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = TOOLS.filter(tool => (category === "all" || tool.category === category)
    && words.every(word => [tool.title, tool.navLabel, tool.summary, tool.category, ...tool.formats].join(" ").toLowerCase().includes(word)));
  const shown = CATEGORIES.filter(item => category === "all" || item.id === category);
  return <div className="directory-layout">
    <nav className="directory-index" aria-label="Jump to a category">
      <p>Categories</p>
      <ul>{CATEGORIES.map(item => <li key={item.id}><a href={`#${item.id}`}><span>{item.title}</span><span className="meta">{TOOLS.filter(tool => tool.status === "available" && tool.category === item.id).length}</span></a></li>)}</ul>
      <p>Also</p>
      <ul><li><a href="/command-center"><span>Command Center</span></a></li><li><a href="/supported-formats"><span>Supported formats</span></a></li></ul>
    </nav>
    <div className="min-w-0">
    <div className="directory-controls">
      <div className="relative w-full">
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="Search tools" placeholder="Search tools, for example “webp” or “resize”…" autoComplete="off" spellCheck={false}
          className="directory-search" />
      </div>
      <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
        {[{ id: "all" as const, title: "All" }, ...CATEGORIES].map(item => {
          const count = TOOLS.filter(tool => tool.status === "available" && (item.id === "all" || tool.category === item.id)).length;
          return <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}
            className={cx("inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-150", category === item.id ? "bg-hover text-ink" : "bg-sunken text-ink-2 hover:bg-raised hover:text-ink")}>
            {item.title}<span className="meta">{count}</span>
          </button>;
        })}
      </div>
    </div>
    <p role="status" className="sr-only">{words.length ? `${matches.length} ${matches.length === 1 ? "tool matches" : "tools match"} your search.` : ""}</p>
    {words.length > 0 && matches.length === 0
      ? <div className="directory-feedback mt-10"><EmptyState title={`No tools match “${query}”.`} action={<button type="button" onClick={() => { setQueryState(""); setCategoryState("all"); sync("", "all"); }} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-sunken px-4 text-sm font-medium text-ink hover:bg-hover"><X aria-hidden className="size-4" />Clear search</button>}>Try a format such as JPEG or MP4, or an action such as compress or convert.</EmptyState></div>
      : <div className="mt-8 space-y-8">{shown.map(item => {
        const tools = matches.filter(tool => tool.category === item.id);
        return !tools.length && words.length ? null : <CategorySection key={item.id} id={item.id} tools={tools} />;
      })}</div>}
  </div>
  </div>;
}


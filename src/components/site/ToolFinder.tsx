"use client";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { CATEGORIES, TOOLS, type ToolCategory } from "@/lib/tools/catalog";
import { ToolCard } from "./ToolDirectory";
import { cx } from "./ui";

/** /tools: search and category filter over the real tool list. Renders every tool on the server; filtering is client-side. */
export function ToolFinder() {
  const [query, setQuery] = useState(""), [category, setCategory] = useState<ToolCategory | "all">("all");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = TOOLS.filter(tool => (category === "all" || tool.category === category)
    && words.every(word => [tool.title, tool.summary, tool.category, ...tool.formats].join(" ").toLowerCase().includes(word)));
  const shown = CATEGORIES.filter(item => category === "all" || item.id === category);
  return <div>
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full md:max-w-sm">
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="Search tools" placeholder="Search tools, for example “webp” or “resize”"
          className="min-h-12 w-full rounded-[var(--radius-control)] border border-edge-strong bg-field pl-10 pr-4 text-base text-ink placeholder:text-faint hover:border-faint focus-visible:border-[var(--ring)]" />
      </div>
      <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
        {[{ id: "all" as const, title: "All" }, ...CATEGORIES].map(item => {
          const count = item.id === "all" ? TOOLS.length : TOOLS.filter(tool => tool.category === item.id).length;
          return <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}
            className={cx("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-150", category === item.id ? "border-ink bg-ink text-on-ink" : "border-edge-strong bg-raised hover:bg-hover")}>
            {item.title}<span className={cx("tabular", category === item.id ? "opacity-70" : "text-subtle")}>{count}</span>
          </button>;
        })}
      </div>
    </div>
    <p role="status" className="sr-only">{words.length ? `${matches.length} ${matches.length === 1 ? "tool matches" : "tools match"} your search.` : ""}</p>
    {words.length > 0 && matches.length === 0
      ? <div className="mt-10 rounded-[var(--radius-panel)] border border-dashed border-edge-strong px-6 py-12 text-center">
        <p className="font-semibold">No tools match “{query}”.</p>
        <p className="mt-1 text-sm text-subtle">Try a format such as JPEG or MP4, or an action such as compress or convert.</p>
        <button type="button" onClick={() => { setQuery(""); setCategory("all"); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-edge-strong bg-raised px-4 text-sm font-semibold hover:bg-hover"><X aria-hidden className="size-4" />Clear search</button>
      </div>
      : <div className="mt-10 space-y-12">{shown.map(item => {
        const tools = matches.filter(tool => tool.category === item.id);
        if (!tools.length && words.length) return null;
        return <section key={item.id} id={item.id} aria-labelledby={`${item.id}-tools`} className="scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-edge pb-3">
            <h2 id={`${item.id}-tools`} className="text-xl font-semibold">{item.title}</h2>
            <p className="text-sm text-subtle">{item.blurb}</p>
          </div>
          {tools.length
            ? <ul className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{tools.map(tool => <li key={tool.href}><ToolCard tool={tool} /></li>)}</ul>
            : <p className="mt-5 rounded-[var(--radius-panel)] border border-dashed border-edge-strong px-5 py-6 text-sm leading-relaxed text-subtle">{item.empty}</p>}
        </section>;
      })}</div>}
  </div>;
}

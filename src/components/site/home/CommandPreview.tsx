"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { CATEGORIES } from "@/lib/tools/catalog";
import { searchTools, type CategoryFilter } from "@/lib/command-center/catalog";
import { TOOL_ICONS } from "../toolIcons";

/** A working slice of the Command Center search: the real catalog, real links, no invented results. */
export function CommandPreview() {
  const [query, setQuery] = useState("mp4"), [category, setCategory] = useState<CategoryFilter>("all");
  const id = useId(), results = searchTools(query, category);
  return <div className="cmd-preview" data-ui>
    <label className="cmd-preview-input" htmlFor={`${id}-q`}><Search aria-hidden size={18} />
      <input id={`${id}-q`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try “gif”, “wav” or “compress”" aria-describedby={`${id}-count`} autoComplete="off" spellCheck={false} />
      <kbd>Ctrl K</kbd>
    </label>
    <div className="cmd-preview-filters" role="group" aria-label="Category">
      <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>All</button>
      {CATEGORIES.map(item => <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.title}</button>)}
    </div>
    <p id={`${id}-count`} className="cmd-preview-count" role="status">{results.length} {results.length === 1 ? "tool" : "tools"}</p>
    {results.length ? <ul className="cmd-preview-results">{results.slice(0, 5).map(tool => { const Icon = TOOL_ICONS[tool.icon]; return <li key={tool.href}>
      <Link prefetch={false} href={tool.href!}><Icon aria-hidden size={18} strokeWidth={1.75} /><span><strong>{tool.title}</strong><small>{tool.formats.slice(0, 4).join(" · ")}</small></span><ArrowUpRight aria-hidden size={16} /></Link>
    </li>; })}</ul>
      : <p className="cmd-preview-empty">No tool matches that. Try a format such as MP3 or HEIC.</p>}
  </div>;
}

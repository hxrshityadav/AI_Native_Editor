/* eslint-disable @next/next/no-img-element -- Local pre-rendered category illustration, no image service. */
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { CATEGORIES, toolsIn, type ToolCategory, type ToolEntry } from "@/lib/tools/catalog";
import { TOOL_ICONS } from "./toolIcons";
import { ToolGlyph, cx } from "./ui";

export function ToolBadge({ badge }: { badge?: string }) {
  return badge ? <span className="text-xs font-medium text-subtle">{badge}</span> : null;
}

export function ToolCard({ tool }: { tool: ToolEntry }) {
  return <Link prefetch={false} href={tool.href!} className="tool-card group">
    <ToolGlyph icon={tool.icon} />
    <div className="min-w-0 flex-1"><h3>{tool.title}<ToolBadge badge={tool.badge} /><ChevronRight aria-hidden className="ml-auto size-4 shrink-0 text-faint" /></h3>
      <p>{tool.summary}</p>
      {tool.transform && <p className="tool-transform"><span className="sr-only">Turns </span>{tool.transform[0]}<ArrowRight aria-hidden size={14} /><span className="sr-only"> into </span>{tool.transform[1]}</p>}
      {tool.note && <p className="tool-note">{tool.note}</p>}
    </div>
  </Link>;
}

export function PlannedTools({ tools, label }: { tools: ToolEntry[]; label: string }) {
  return <div className="mt-4"><p className="text-sm font-semibold text-faint">Planned, not available yet</p><ul aria-label={label} className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">{tools.map(tool => {
    const Icon = TOOL_ICONS[tool.icon];
    return <li key={tool.title} className="flex min-h-11 items-center gap-2.5 text-sm text-subtle" title={tool.summary}><Icon aria-hidden className="size-4 shrink-0" /><span>{tool.title}</span></li>;
  })}</ul></div>;
}

export function CategorySection({ id, tools }: { id: ToolCategory; tools: ToolEntry[] }) {
  const category = CATEGORIES.find(item => item.id === id)!;
  const ready = tools.filter(tool => tool.status === "available"), planned = tools.filter(tool => tool.status === "planned");
  return <section id={id} aria-labelledby={`${id}-tools`} className="scroll-mt-24">
    <div className="category-heading"><div><h2 id={`${id}-tools`}>{category.title}<span>{ready.length} available{planned.length ? `, ${planned.length} planned` : ""}</span></h2><p>{category.blurb}</p></div><img className="category-illustration" src={`/illustrations/${id}.webp`} width={1040} height={520} alt="" loading="lazy" decoding="async" /></div>
    {ready.length > 0 && <ul className="category-tools">{ready.map(tool => <li key={`${tool.href}-${tool.title}`}><ToolCard tool={tool} /></li>)}</ul>}
    {planned.length > 0 && <PlannedTools tools={planned} label={`${category.title}, planned tools`} />}
  </section>;
}

export function ToolDirectory({ className }: { className?: string }) {
  return <div className={cx("space-y-12", className)}>{CATEGORIES.map(category => <CategorySection key={category.id} id={category.id} tools={toolsIn(category.id)} />)}</div>;
}


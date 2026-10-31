import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CATEGORIES, toolsIn, type ToolEntry } from "@/lib/tools/catalog";
import { Chip, ToolGlyph } from "./ui";

export function ToolCard({ tool }: { tool: ToolEntry }) {
  return <Link href={tool.href} className="group flex h-full gap-4 rounded-[var(--radius-panel)] border border-edge bg-raised p-4 transition-[border-color,box-shadow] duration-150 hover:border-edge-strong hover:shadow-panel sm:p-5">
    <ToolGlyph icon={tool.icon} />
    <div className="min-w-0 flex-1">
      <h3 className="flex items-center gap-1 font-semibold">{tool.title}<ChevronRight aria-hidden className="size-4 text-subtle transition-transform duration-150 group-hover:translate-x-0.5" /></h3>
      <p className="mt-1 text-sm leading-relaxed text-subtle">{tool.summary}</p>
      <p className="mt-3 flex flex-wrap gap-1.5"><span className="sr-only">Formats: </span>{tool.formats.map(format => <Chip key={format}>{format}</Chip>)}</p>
    </div>
  </Link>;
}

/** Every working tool, grouped by category. Categories without tools say so instead of showing placeholders. */
export function ToolDirectory() {
  return <div className="space-y-12">{CATEGORIES.map(category => {
    const tools = toolsIn(category.id);
    return <section key={category.id} id={category.id} aria-labelledby={`${category.id}-tools`} className="scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-edge pb-3">
        <h2 id={`${category.id}-tools`} className="text-xl font-semibold">{category.title}</h2>
        <p className="text-sm text-subtle">{category.blurb}</p>
      </div>
      {tools.length
        ? <ul className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{tools.map(tool => <li key={tool.href}><ToolCard tool={tool} /></li>)}</ul>
        : <p className="mt-5 rounded-[var(--radius-panel)] border border-dashed border-edge-strong px-5 py-6 text-sm leading-relaxed text-subtle">{category.empty}</p>}
    </section>;
  })}</div>;
}

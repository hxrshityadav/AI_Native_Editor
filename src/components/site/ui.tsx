import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clapperboard, FileImage, Film, Info, Minimize2, Scaling, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ToolIcon } from "@/lib/tools/catalog";

/* Shared primitives for public pages and tool workspaces, adapted from shadcn/ui patterns (MIT) without Radix. */

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-on-ink hover:bg-ink-2 border-transparent",
  secondary: "bg-raised text-ink border-edge-strong hover:bg-sunken",
  ghost: "bg-transparent text-ink border-transparent hover:bg-sunken",
};
const SIZES: Record<Size, string> = { md: "min-h-11 px-4 text-sm", lg: "min-h-12 px-5 text-[0.95rem]" };
/** Class list for any button-like element: <button>, <a> or <Link>. */
export const buttonClass = (variant: Variant = "primary", size: Size = "md", extra?: string) => cx(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border font-semibold transition-colors duration-150",
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
  VARIANTS[variant], SIZES[size], extra);

const TONES = {
  info: { icon: Info, box: "border-edge bg-sunken text-ink", mark: "text-subtle" },
  success: { icon: CheckCircle2, box: "border-success/30 bg-success-soft text-ink", mark: "text-success" },
  warning: { icon: TriangleAlert, box: "border-warning/30 bg-warning-soft text-ink", mark: "text-warning" },
  error: { icon: AlertCircle, box: "border-danger/30 bg-danger-soft text-ink", mark: "text-danger" },
} as const;
export type Tone = keyof typeof TONES;
/** A message with an icon and a text tone, so state never relies on colour alone. Pass role for live announcements. */
export function Notice({ tone = "info", role, title, children, className }: { tone?: Tone; role?: "status" | "alert" | "note"; title?: string; children: ReactNode; className?: string }) {
  const { icon: Icon, box, mark } = TONES[tone];
  return <div role={role} className={cx("flex gap-3 rounded-[var(--radius-control)] border px-3.5 py-3 text-sm leading-relaxed", box, className)}>
    <Icon aria-hidden className={cx("mt-0.5 size-4 shrink-0", mark)} />
    <div className="min-w-0">{title && <p className="font-semibold">{title}</p>}{children}</div>
  </div>;
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-edge bg-raised px-2 py-0.5 text-xs font-medium text-subtle">{children}</span>;
}

const ICONS: Record<ToolIcon, LucideIcon> = { "compress-image": Minimize2, "resize-image": Scaling, "convert-image": FileImage, "compress-video": Film, editor: Clapperboard };
export function ToolGlyph({ icon, small }: { icon: ToolIcon; small?: boolean }) {
  const Icon = ICONS[icon];
  return <span aria-hidden className={cx("grid shrink-0 place-items-center bg-brand-soft text-brand", small ? "size-8 rounded-lg" : "size-10 rounded-[10px]")}><Icon className={small ? "size-4" : "size-5"} strokeWidth={1.75} /></span>;
}

export function PageHeader({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return <header className="max-w-3xl">
    <h1 className="text-title font-semibold sm:text-display">{title}</h1>
    {lead && <p className="mt-3 max-w-2xl text-lg leading-relaxed text-subtle">{lead}</p>}
    {children}
  </header>;
}

/** A real ordered process, so the numbering carries meaning. */
export function Steps({ title, steps }: { title: string; steps: string[] }) {
  return <section className="max-w-3xl">
    <h2 className="text-xl font-semibold">{title}</h2>
    <ol className="mt-5 space-y-4">{steps.map((step, index) => <li key={step} className="flex gap-4 leading-relaxed">
      <span aria-hidden className="tabular grid size-7 shrink-0 place-items-center rounded-full border border-edge-strong text-sm font-semibold">{index + 1}</span>
      <span className="pt-0.5">{step}</span>
    </li>)}</ol>
  </section>;
}

export function Faq({ items }: { items: { question: string; answer: string }[] }) {
  return <section className="max-w-3xl">
    <h2 className="text-xl font-semibold">Frequently asked questions</h2>
    <div className="mt-4 divide-y divide-edge border-y border-edge">{items.map(item => <details key={item.question} className="group py-1">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-2 font-medium [&::-webkit-details-marker]:hidden">
        {item.question}<span aria-hidden className="text-xl leading-none text-subtle transition-transform duration-150 group-open:rotate-45">+</span>
      </summary>
      <p className="pb-4 leading-relaxed text-subtle">{item.answer}</p>
    </details>)}</div>
  </section>;
}

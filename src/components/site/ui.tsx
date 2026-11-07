import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import type { ToolIcon } from "@/lib/tools/catalog";
import { TOOL_ICONS } from "./toolIcons";

/* Shared primitives for public pages and tool workspaces, adapted from shadcn/ui patterns (MIT) without Radix. */

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "md" | "lg";
const VARIANTS: Record<Variant, string> = {
  primary: "ds-primary",
  secondary: "ds-secondary",
  ghost: "bg-transparent text-ink border-transparent hover:bg-sunken",
  destructive: "ds-destructive",
};
const SIZES: Record<Size, string> = { md: "min-h-11 px-4 text-sm", lg: "min-h-12 px-5 text-[0.95rem]" };
/** Class list for any button-like element: <button>, <a> or <Link>. */
export const buttonClass = (variant: Variant = "primary", size: Size = "md", extra?: string) => cx(
  "ds-button inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border font-semibold transition-colors duration-150",
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

export function ToolGlyph({ icon, small }: { icon: ToolIcon; small?: boolean }) {
  const Icon = TOOL_ICONS[icon];
  return <span aria-hidden className="tool-glyph"><Icon className={small ? "size-4" : "size-5"} strokeWidth={1.75} /></span>;
}

export function PageHeader({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return <header className="max-w-3xl">
    <h1 className="text-title font-semibold sm:text-display">{title}</h1>
    {lead && <p className="mt-3 max-w-2xl text-lg leading-relaxed text-subtle">{lead}</p>}
    {children}
  </header>;
}

/** Honest empty state: says what is missing and offers the next step. */
export function EmptyState({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return <div className="rounded-[var(--radius-panel)] border border-dashed border-edge-strong px-5 py-6 text-sm leading-relaxed text-subtle">
    {title && <p className="font-semibold text-ink">{title}</p>}
    <div className={title ? "mt-1" : undefined}>{children}</div>
    {action && <div className="mt-4">{action}</div>}
  </div>;
}

/** Compact local-processing promise for tool headers. */
export function PrivacyBadge() {
  return <p className="privacy-line">
    <ShieldCheck aria-hidden className="size-4 text-brand" />
    <span className="font-semibold text-ink">Runs locally in your browser</span>
    <span className="text-subtle">Your files are not uploaded to our servers.</span>
  </p>;
}

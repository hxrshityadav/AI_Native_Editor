"use client";

import { brandKitFromStyle, POSITION, SIZE_SCALE, type BrandKit } from "@/lib/brandKit";
import { CAPTION_FONTS, type CaptionFontId, type CaptionStyle } from "@/lib/captions";

type Props = {
  kit: BrandKit | null;
  /** The picked style, before the kit is applied. */
  style: CaptionStyle;
  onChange: (kit: BrandKit) => void;
  saveFailed: boolean;
};

export function BrandKitPanel({ kit, style, onChange, saveFailed }: Props) {
  const enabled = !!kit?.enabled;
  const set = (patch: Partial<BrandKit>) => kit && onChange({ ...kit, ...patch });

  return (
    // Collapsed by default: a kit is set up once, and when open it pushes the preview off a phone screen.
    <details data-testid="brand-kit" className="rounded-md border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        Brand kit <span className="font-normal text-zinc-600 dark:text-zinc-400">({enabled ? "on" : "off"})</span>
      </summary>
      <div className="flex flex-col gap-3 border-t p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            data-testid="brand-kit-enabled"
            checked={enabled}
            onChange={(e) => onChange(kit ? { ...kit, enabled: e.target.checked } : brandKitFromStyle(style))}
            className="size-4"
          />
          Use my brand kit on every video
        </label>

        {kit && enabled && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Font
                <select
                  data-testid="brand-font"
                  value={kit.font}
                  onChange={(e) => set({ font: e.target.value as CaptionFontId })}
                  className="rounded-md border px-2 py-1.5"
                >
                  {(Object.keys(CAPTION_FONTS) as CaptionFontId[]).map((id) => (
                    <option key={id} value={id}>
                      {CAPTION_FONTS[id].label}
                    </option>
                  ))}
                </select>
              </label>

              <ColorField label="Text colour" testId="brand-text-color" value={kit.textColor} onChange={(c) => set({ textColor: c })} />

              {style.highlight.kind === "none" ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  The {style.name} style has no highlight, so the highlight colour isn&apos;t used.
                </p>
              ) : (
                <ColorField
                  label={style.highlight.kind === "pill" ? "Highlight block colour" : "Highlight colour"}
                  testId="brand-highlight-color"
                  value={kit.highlightColor}
                  onChange={(c) => set({ highlightColor: c })}
                />
              )}

              <label className="flex flex-col gap-1 text-sm">
                <span>
                  Size <output className="tabular-nums">{Math.round(kit.sizeScale * 100)}%</output>
                </span>
                <input
                  type="range"
                  data-testid="brand-size"
                  min={SIZE_SCALE.min}
                  max={SIZE_SCALE.max}
                  step={0.05}
                  value={kit.sizeScale}
                  onChange={(e) => set({ sizeScale: Number(e.target.value) })}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>
                  Position <output className="tabular-nums">{Math.round(kit.verticalPosition * 100)}% from top</output>
                </span>
                <input
                  type="range"
                  data-testid="brand-position"
                  min={POSITION.min}
                  max={POSITION.max}
                  step={0.01}
                  value={kit.verticalPosition}
                  onChange={(e) => set({ verticalPosition: Number(e.target.value) })}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <button type="button" className="underline" onClick={() => onChange(brandKitFromStyle(style))}>
                Reset to the {style.name} style
              </button>
              {saveFailed ? (
                <span role="status" className="text-red-800 dark:text-red-300">
                  Couldn&apos;t save the kit on this device (private browsing or full storage). It will reset when you
                  reload.
                </span>
              ) : (
                <span role="status" className="text-zinc-600 dark:text-zinc-400">
                  Saved in this browser. Applies on top of any style you pick.
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}

function ColorField({
  label,
  testId,
  value,
  onChange,
}: {
  label: string;
  testId: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <span className="flex items-center gap-2">
        <input
          type="color"
          data-testid={testId}
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-14 cursor-pointer rounded border"
        />
        <span className="font-mono text-xs tabular-nums">{value}</span>
      </span>
    </label>
  );
}

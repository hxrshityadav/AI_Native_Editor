import { z } from "zod";
import { CAPTION_FONTS, type CaptionFontId } from "./captions/fonts";
import type { CaptionStyle } from "./captions/types";
import { localDb } from "./localDb";

/**
 * One brand kit per browser: the creator's font, colours, size and placement,
 * applied on top of whichever caption style they pick.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const SIZE_SCALE = { min: 0.7, max: 1.4 } as const;
export const POSITION = { min: 0.15, max: 0.88 } as const;

export const brandKitSchema = z.object({
  enabled: z.boolean(),
  font: z.enum(Object.keys(CAPTION_FONTS) as [CaptionFontId, ...CaptionFontId[]]),
  textColor: hex,
  highlightColor: hex,
  sizeScale: z.number().min(SIZE_SCALE.min).max(SIZE_SCALE.max),
  /** Caption centre as a fraction of frame height from the top. */
  verticalPosition: z.number().min(POSITION.min).max(POSITION.max),
});
export type BrandKit = z.infer<typeof brandKitSchema>;

/** A starting kit that looks exactly like `style`, so enabling it changes nothing until the user edits. */
export function brandKitFromStyle(style: CaptionStyle): BrandKit {
  const h = style.highlight;
  return {
    enabled: true,
    font: style.font,
    textColor: style.textColor.toUpperCase(),
    highlightColor: (h.kind === "color" ? h.color : h.kind === "pill" ? h.fill : "#FFD60A").toUpperCase(),
    sizeScale: 1,
    verticalPosition: style.verticalPosition,
  };
}

export function applyBrandKit(style: CaptionStyle, kit: BrandKit): CaptionStyle {
  const h = style.highlight;
  return {
    ...style,
    font: kit.font,
    textColor: kit.textColor,
    fontSizeRatio: style.fontSizeRatio * kit.sizeScale,
    verticalPosition: kit.verticalPosition,
    highlight:
      h.kind === "color"
        ? { kind: "color", color: kit.highlightColor }
        : h.kind === "pill"
          ? { kind: "pill", fill: kit.highlightColor, textColor: readableTextOn(kit.highlightColor) }
          : h,
  };
}

/** Near-black or white, whichever reads better on `background` (WCAG relative luminance). */
export function readableTextOn(background: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(background.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast against white beats contrast against near-black once luminance drops below ~0.18.
  return luminance > 0.18 ? "#141414" : "#FFFFFF";
}

export async function loadBrandKit(): Promise<BrandKit | null> {
  const parsed = brandKitSchema.safeParse(await (await localDb()).get("settings", "brandKit"));
  return parsed.success ? parsed.data : null;
}

export async function saveBrandKit(kit: BrandKit): Promise<void> {
  await (await localDb()).put("settings", brandKitSchema.parse(kit), "brandKit");
}

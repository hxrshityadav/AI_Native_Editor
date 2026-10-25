/**
 * Caption fonts bundled in public/fonts (OFL-1.1, from Fontsource 5.3.0). Each
 * family ships a Devanagari and a Latin subset; the browser picks per glyph via
 * unicode-range, so Hindi and Hinglish render in one family.
 */

const DEVANAGARI_RANGE =
  "U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+20F0,U+25CC,U+A830-A839,U+A8E0-A8FF,U+11B00-11B09";
const LATIN_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

// Families are prefixed "RF" so a system-installed copy never shadows the bundled one.
export const CAPTION_FONTS = {
  poppins: { family: "RF Poppins", label: "Poppins", slug: "poppins", weight: 700 },
  "baloo-2": { family: "RF Baloo 2", label: "Baloo 2", slug: "baloo-2", weight: 800 },
  mukta: { family: "RF Mukta", label: "Mukta", slug: "mukta", weight: 700 },
  hind: { family: "RF Hind", label: "Hind", slug: "hind", weight: 600 },
} as const;
export type CaptionFontId = keyof typeof CAPTION_FONTS;

export function fontFiles(id: CaptionFontId): { url: string; unicodeRange: string }[] {
  const { slug, weight } = CAPTION_FONTS[id];
  return [
    { url: `/fonts/${slug}/${slug}-devanagari-${weight}-normal.woff2`, unicodeRange: DEVANAGARI_RANGE },
    { url: `/fonts/${slug}/${slug}-latin-${weight}-normal.woff2`, unicodeRange: LATIN_RANGE },
  ];
}

/** CSS font shorthand for canvas. System fonts follow only as a last resort. */
export function captionFont(id: CaptionFontId, sizePx: number): string {
  const { family, weight } = CAPTION_FONTS[id];
  return `${weight} ${sizePx}px "${family}", "Noto Sans Devanagari", sans-serif`;
}

const loads = new WeakMap<FontFaceSet, Map<CaptionFontId, Promise<void>>>();

/**
 * Loads a caption font into `fonts` (document.fonts on the page, self.fonts in
 * the render worker). Rejects if a file fails, so a render never silently
 * falls back to a system font.
 */
export function loadCaptionFont(id: CaptionFontId, fonts: FontFaceSet): Promise<void> {
  let perSet = loads.get(fonts);
  if (!perSet) loads.set(fonts, (perSet = new Map()));
  let pending = perSet.get(id);
  if (!pending) {
    const { family, weight } = CAPTION_FONTS[id];
    pending = Promise.all(
      fontFiles(id).map(async ({ url, unicodeRange }) => {
        const face = new FontFace(family, `url(${url}) format("woff2")`, { weight: String(weight), unicodeRange });
        fonts.add(await face.load());
      }),
    ).then(() => undefined);
    // Forget failures so a retry (e.g. after reconnecting) can succeed.
    pending.catch(() => perSet.delete(id));
    perSet.set(id, pending);
  }
  return pending;
}

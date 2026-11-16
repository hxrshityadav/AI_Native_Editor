/*
 * Subtitle Studio caption model: editing operations, validation, styles and one renderer shared by the live preview
 * (a canvas over the <video>) and the burned-in export (an OffscreenCanvas in the media worker). Preview and export call
 * the same `layoutCaption` and `drawCaption`, at the same output resolution, so positions and wrapping match.
 */

export type Word = { text: string; start: number; end: number };
/** `words` exists only when real word timings came with the transcript. Editing the text drops them. */
export type Caption = { id: string; start: number; end: number; text: string; words?: Word[] };

export const MIN_CAPTION = 0.2;
export const MAX_CAPTIONS = 2000;
let nextId = 0;
export const captionId = () => `c${Date.now().toString(36)}${(nextId++).toString(36)}`;
const round = (value: number) => Math.round(value * 1000) / 1000;

/* ---------- Editing operations (pure; each returns a new array) ---------- */

export function fromCues(cues: { text: string; start: number; end: number }[]): Caption[] {
  return cues.filter(cue => cue.text.trim()).map(cue => ({ id: captionId(), start: round(cue.start), end: round(cue.end), text: cue.text.trim() }));
}

/**
 * Sets a caption's text. If the edit keeps the same number of words, each word keeps its recognised timing (a spelling
 * fix stays synchronised). Otherwise the word timings no longer match and are dropped, so the caption falls back to
 * sentence-level display.
 */
export function setText(captions: Caption[], index: number, text: string): Caption[] {
  return captions.map((caption, i) => {
    if (i !== index) return caption;
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    const words = caption.words && caption.words.length === tokens.length ? caption.words.map((word, w) => ({ ...word, text: tokens[w] })) : undefined;
    return { id: caption.id, start: caption.start, end: caption.end, text, ...(words ? { words } : {}) };
  });
}

/** Sets times, clamped between the neighbours so captions never overlap, and at least MIN_CAPTION long. */
export function setTiming(captions: Caption[], index: number, start: number, end: number, duration: number): Caption[] {
  const before = index > 0 ? captions[index - 1].end : 0, after = index < captions.length - 1 ? captions[index + 1].start : duration;
  let s = Math.min(Math.max(before, Number.isFinite(start) ? start : before), after - MIN_CAPTION);
  let e = Math.max(Math.min(after, Number.isFinite(end) ? end : after), s + MIN_CAPTION);
  if (e > after) { e = after; s = Math.max(before, e - MIN_CAPTION); }
  return captions.map((caption, i) => i === index ? { ...caption, start: round(s), end: round(e), words: caption.words?.filter(word => word.start >= s && word.end <= e) } : caption);
}

/**
 * Splits a caption at a character offset (default: the word boundary nearest the middle). With word timings the cut
 * uses the real time of the first word of the second half; otherwise time is divided in proportion to the characters.
 */
export function split(captions: Caption[], index: number, at?: number): Caption[] {
  const caption = captions[index];
  if (!caption || caption.end - caption.start < MIN_CAPTION * 2) throw new Error("This caption is too short to split.");
  const text = caption.text.trim(), spaces = [...text.matchAll(/\s+/g)].map(match => match.index!);
  if (!spaces.length) throw new Error("A caption needs at least two words to split.");
  const target = at ?? text.length / 2, cut = spaces.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best, spaces[0]);
  const first = text.slice(0, cut).trim(), second = text.slice(cut).trim();
  let middle: number;
  const firstCount = first.split(/\s+/).length;
  if (caption.words && caption.words.length === text.split(/\s+/).length) middle = caption.words[firstCount].start;
  else middle = caption.start + (caption.end - caption.start) * (first.length / (first.length + second.length));
  middle = round(Math.min(caption.end - MIN_CAPTION, Math.max(caption.start + MIN_CAPTION, middle)));
  const a: Caption = { id: caption.id, start: caption.start, end: middle, text: first, ...(caption.words ? { words: caption.words.slice(0, firstCount) } : {}) };
  const b: Caption = { id: captionId(), start: middle, end: caption.end, text: second, ...(caption.words ? { words: caption.words.slice(firstCount) } : {}) };
  return [...captions.slice(0, index), a, b, ...captions.slice(index + 1)];
}

/** Merges a caption with the next one. */
export function merge(captions: Caption[], index: number): Caption[] {
  const a = captions[index], b = captions[index + 1];
  if (!a || !b) throw new Error("There is no next caption to merge with.");
  const words = a.words && b.words ? [...a.words, ...b.words] : undefined;
  return [...captions.slice(0, index), { id: a.id, start: a.start, end: b.end, text: `${a.text.trim()} ${b.text.trim()}`.trim(), ...(words ? { words } : {}) }, ...captions.slice(index + 2)];
}

export function remove(captions: Caption[], index: number): Caption[] { return captions.filter((_, i) => i !== index); }

/** Adds an empty caption at `at` if that time is free, otherwise in the next free gap (or any gap). Up to 2 s long. */
export function add(captions: Caption[], at: number, duration: number): { captions: Caption[]; index: number } {
  if (captions.length >= MAX_CAPTIONS) throw new Error(`Use at most ${MAX_CAPTIONS} captions.`);
  const gaps = Array.from({ length: captions.length + 1 }, (_, i) => ({ i, from: i ? captions[i - 1].end : 0, to: i < captions.length ? captions[i].start : duration }));
  const room = MIN_CAPTION * 2;
  const here = gaps.find(g => at >= g.from && at < g.to && g.to - at >= room);
  const gap = here ?? gaps.find(g => g.from >= at && g.to - g.from >= room) ?? gaps.find(g => g.to - g.from >= room);
  if (!gap) throw new Error("There is no free time for another caption. Shorten or delete a caption first.");
  const start = round(here ? at : gap.from), end = round(Math.min(gap.to, start + 2));
  return { captions: [...captions.slice(0, gap.i), { id: captionId(), start, end, text: "" }, ...captions.slice(gap.i)], index: gap.i };
}

export function activeIndex(captions: Caption[], time: number): number {
  let lo = 0, hi = captions.length - 1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (captions[mid].end <= time) lo = mid + 1; else if (captions[mid].start > time) hi = mid - 1; else return mid; }
  return -1;
}

/* ---------- Fonts and scripts ---------- */

export type Script = "latin" | "devanagari";
export type CaptionFont = { id: string; label: string; family: string; weight: number; weights?: [number, number]; scripts: Script[]; files: { url: string; range?: string }[]; custom?: boolean };
const LATIN_RANGE = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const DEVA_RANGE = "U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+25CC, U+A830-A839, U+A8E0-A8FF";
/** Bundled OFL fonts (public/fonts). Nothing is fetched from a font service. `weights` marks variable fonts. */
export const CAPTION_FONTS: CaptionFont[] = [
  { id: "poppins", label: "Poppins Bold", family: "RF Caption Poppins", weight: 700, scripts: ["latin", "devanagari"], files: [{ url: "/fonts/poppins/poppins-latin-700-normal.woff2", range: LATIN_RANGE }, { url: "/fonts/poppins/poppins-devanagari-700-normal.woff2", range: DEVA_RANGE }] },
  { id: "mukta", label: "Mukta Bold", family: "RF Caption Mukta", weight: 700, scripts: ["latin", "devanagari"], files: [{ url: "/fonts/mukta/mukta-latin-700-normal.woff2", range: LATIN_RANGE }, { url: "/fonts/mukta/mukta-devanagari-700-normal.woff2", range: DEVA_RANGE }] },
  { id: "hind", label: "Hind Semibold", family: "RF Caption Hind", weight: 600, scripts: ["latin", "devanagari"], files: [{ url: "/fonts/hind/hind-latin-600-normal.woff2", range: LATIN_RANGE }, { url: "/fonts/hind/hind-devanagari-600-normal.woff2", range: DEVA_RANGE }] },
  { id: "baloo", label: "Baloo 2 Extra Bold", family: "RF Caption Baloo", weight: 800, scripts: ["latin", "devanagari"], files: [{ url: "/fonts/baloo-2/baloo-2-latin-800-normal.woff2", range: LATIN_RANGE }, { url: "/fonts/baloo-2/baloo-2-devanagari-800-normal.woff2", range: DEVA_RANGE }] },
  { id: "anton", label: "Anton", family: "RF Caption Anton", weight: 400, scripts: ["latin"], files: [{ url: "/fonts/catalog/anton/font.ttf", range: LATIN_RANGE }] },
  { id: "geist", label: "Geist", family: "RF Caption Geist", weight: 600, weights: [100, 900], scripts: ["latin"], files: [{ url: "/fonts/geist/Geist-Variable.woff2", range: LATIN_RANGE }] },
  { id: "serif", label: "Noto Serif", family: "RF Caption Serif", weight: 500, weights: [100, 900], scripts: ["latin"], files: [{ url: "/fonts/catalog/notoserif/font.ttf", range: LATIN_RANGE }] },
  { id: "mono", label: "Roboto Mono", family: "RF Caption Mono", weight: 500, weights: [100, 700], scripts: ["latin"], files: [{ url: "/fonts/catalog/robotomono/font.ttf", range: LATIN_RANGE }] },
  { id: "caveat", label: "Caveat (handwritten)", family: "RF Caption Caveat", weight: 600, weights: [400, 700], scripts: ["latin"], files: [{ url: "/fonts/catalog/caveat/font.ttf", range: LATIN_RANGE }] },
];
/** Fonts uploaded by the user this session, registered by id ("custom:…"). Their script coverage is measured on upload. */
const customFonts = new Map<string, CaptionFont>();
export function registerCustomFont(font: { id: string; label: string; scripts: Script[] }) {
  const entry: CaptionFont = { id: font.id, label: font.label, family: `RF Custom ${font.id.replace(/[^a-z0-9]/gi, "")}`, weight: 400, scripts: font.scripts, files: [], custom: true };
  customFonts.set(font.id, entry); return entry;
}
export const fontById = (id: string) => customFonts.get(id) ?? CAPTION_FONTS.find(font => font.id === id) ?? CAPTION_FONTS[0];

/** Scripts the text needs. Anything outside Latin, Devanagari and shared punctuation is reported as "other". */
export function scriptsIn(text: string): (Script | "other")[] {
  const found = new Set<Script | "other">();
  for (const char of text) {
    if (/[\p{Script=Common}\p{Script=Inherited}\s]/u.test(char)) continue;
    if (/\p{Script=Latin}/u.test(char)) found.add("latin");
    else if (/\p{Script=Devanagari}/u.test(char)) found.add("devanagari");
    else found.add("other");
  }
  return [...found];
}

/* ---------- Styles ---------- */

/** How word timings are shown. Every mode except "none" needs real word timings; without them captions show whole. */
export type HighlightMode = "none" | "word" | "line" | "reveal" | "karaoke";
export type Entrance = "none" | "fade" | "pop" | "rise" | "typewriter";
export type Shadow = { blur: number; x: number; y: number; color: string };
export type CaptionStyle = {
  preset: PresetId; font: string; weight: number; size: number; letterSpacing: number; lineHeight: number;
  transform: "none" | "uppercase" | "lowercase"; maxWords: number; maxChars: number;
  color: string; highlight: string; gradient: [string, string] | null; activeBg: string | null; emphasis: number;
  outline: number; outlineColor: string; shadow: Shadow | null;
  background: "none" | "box" | "band"; backgroundColor: string; backgroundOpacity: number; padding: number; radius: number;
  align: "left" | "center" | "right"; x: number; y: number; width: number; safeMargin: number;
  highlightMode: HighlightMode; entrance: Entrance;
};
export type PresetId = "clean" | "bold" | "word" | "neon" | "podcast" | "minimal" | "cinematic" | "gradient" | "typewriter" | "pop" | "boxed" | "editorial" | "karaoke" | "contrast" | "compact" | "custom";

const BASE: CaptionStyle = {
  preset: "clean", font: "poppins", weight: 700, size: 6, letterSpacing: 0, lineHeight: 1.25, transform: "none", maxWords: 6, maxChars: 32,
  color: "#ffffff", highlight: "#ffd23f", gradient: null, activeBg: null, emphasis: 1, outline: 0, outlineColor: "#000000", shadow: { blur: 8, x: 0, y: 2, color: "rgba(0,0,0,0.6)" },
  background: "none", backgroundColor: "#000000", backgroundOpacity: 0.7, padding: 0.35, radius: 0.25,
  align: "center", x: 0.5, y: 0.78, width: 1, safeMargin: 1, highlightMode: "none", entrance: "fade",
};
const preset = (id: PresetId, label: string, note: string, style: Partial<CaptionStyle>) => ({ label, note, style: { ...BASE, ...style, preset: id } as CaptionStyle });
/** Fifteen presets that differ in typeface, case, colour treatment, backing, timing behaviour and entrance. */
export const PRESETS: Record<Exclude<PresetId, "custom">, { label: string; note: string; style: CaptionStyle }> = {
  clean: preset("clean", "Clean Minimal", "Soft shadow, no outline. Works on most footage.", { font: "hind", weight: 600, size: 5.6 }),
  bold: preset("bold", "Bold Creator", "Big uppercase words that appear as they are spoken.", { font: "baloo", weight: 800, size: 8.5, transform: "uppercase", outline: 14, shadow: null, maxWords: 3, maxChars: 18, highlightMode: "reveal", entrance: "pop", y: 0.62 }),
  word: preset("word", "Word Highlight", "Each word lights up in yellow as it is spoken.", { size: 7, outline: 10, shadow: null, maxWords: 4, maxChars: 22, highlightMode: "word", y: 0.68 }),
  neon: preset("neon", "Neon Focus", "Cool white text; the spoken word glows cyan.", { font: "poppins", size: 6.8, color: "#e6f7ff", highlight: "#38e1ff", shadow: { blur: 18, x: 0, y: 0, color: "rgba(56,225,255,0.75)" }, maxWords: 4, highlightMode: "word", emphasis: 1.06 }),
  podcast: preset("podcast", "Modern Podcast", "Left-aligned lower third on a dark band.", { font: "mukta", size: 5, align: "left", x: 0.06, y: 0.84, background: "band", backgroundOpacity: 0.78, padding: 0.5, radius: 0.3, shadow: null, maxWords: 8, maxChars: 40, entrance: "rise", width: 0.8 }),
  minimal: preset("minimal", "Minimal White", "Small lowercase text with a hairline outline.", { font: "hind", weight: 600, size: 4.6, transform: "lowercase", outline: 4, shadow: null, maxWords: 8, maxChars: 40, y: 0.86, entrance: "none" }),
  cinematic: preset("cinematic", "Cinematic", "Widely spaced serif capitals, like film titles. Latin text only.", { font: "serif", weight: 500, size: 4.4, transform: "uppercase", letterSpacing: 0.12, shadow: { blur: 6, x: 0, y: 1, color: "rgba(0,0,0,0.8)" }, maxWords: 7, maxChars: 38, y: 0.88, entrance: "fade" }),
  gradient: preset("gradient", "Gradient Accent", "The line being spoken fills with an orange-to-pink gradient.", { font: "poppins", size: 6.6, gradient: ["#ff9a3c", "#ff4f8b"], outline: 8, shadow: null, maxWords: 5, highlightMode: "line" }),
  typewriter: preset("typewriter", "Typewriter", "Monospace letters typed out on a band. Latin text only.", { font: "mono", weight: 500, size: 4.8, background: "band", backgroundColor: "#111111", backgroundOpacity: 0.85, padding: 0.5, radius: 0.15, shadow: null, entrance: "typewriter", maxChars: 30 }),
  pop: preset("pop", "Social Pop", "The spoken word sits on a bright box and pops.", { font: "baloo", weight: 800, size: 7.4, outline: 10, shadow: null, activeBg: "#ffd23f", highlight: "#111111", emphasis: 1.08, maxWords: 3, maxChars: 20, highlightMode: "word", entrance: "pop", y: 0.66 }),
  boxed: preset("boxed", "Boxed Captions", "Each line on its own rounded box.", { font: "mukta", size: 5.6, background: "box", backgroundOpacity: 0.72, shadow: null, padding: 0.4, radius: 0.3 }),
  editorial: preset("editorial", "Editorial", "Dark serif on a light band, left aligned. Latin text only.", { font: "serif", weight: 600, size: 5, color: "#141414", background: "band", backgroundColor: "#f6f1e7", backgroundOpacity: 0.95, padding: 0.6, radius: 0.1, shadow: null, align: "left", x: 0.06, width: 0.85, entrance: "rise" }),
  karaoke: preset("karaoke", "Karaoke", "Words fill with colour left to right as they are sung or spoken.", { font: "poppins", size: 6.4, highlight: "#4ade80", outline: 10, shadow: null, maxWords: 6, highlightMode: "karaoke", entrance: "none" }),
  contrast: preset("contrast", "High Contrast", "Yellow on solid black for maximum legibility.", { font: "hind", weight: 600, size: 6.2, color: "#ffe14d", background: "box", backgroundOpacity: 1, shadow: null, padding: 0.35, radius: 0.08 }),
  compact: preset("compact", "Compact Subtitle", "Two small lines low in the frame, like broadcast subtitles.", { font: "hind", weight: 600, size: 4.2, background: "band", backgroundOpacity: 0.6, padding: 0.3, radius: 0.15, shadow: null, maxWords: 10, maxChars: 42, y: 0.92, entrance: "none" }),
};
export const DYNAMIC: HighlightMode[] = ["word", "line", "reveal", "karaoke"];

/** Title-safe area for a frame shape, as fractions. Portrait leaves room for platform buttons at the bottom. */
export function safeArea(width: number, height: number, scale = 1) {
  const ratio = height / width;
  const base = ratio > 1.3 ? { x: 0.07, top: 0.12, bottom: 0.2 } : ratio < 0.8 ? { x: 0.05, top: 0.06, bottom: 0.08 } : { x: 0.06, top: 0.08, bottom: 0.1 };
  return { x: base.x * scale, top: base.top * scale, bottom: base.bottom * scale };
}
/** @deprecated kept for older callers; use safeArea(width, height). */


/* ---------- Validation ---------- */

export type Issue = { index: number; level: "error" | "warn"; message: string };
export function validate(captions: Caption[], duration: number, style: CaptionStyle): Issue[] {
  const issues: Issue[] = [], font = fontById(style.font);
  captions.forEach((caption, index) => {
    const previous = captions[index - 1];
    if (!caption.text.trim()) issues.push({ index, level: "error", message: "Add text or delete this caption." });
    if (!(caption.end > caption.start)) issues.push({ index, level: "error", message: "The end must be after the start." });
    if (caption.start < 0 || caption.end > duration + 0.01) issues.push({ index, level: "error", message: "Times must be inside the video." });
    if (previous && caption.start < previous.end - 0.0005) issues.push({ index, level: "error", message: "Overlaps the previous caption." });
    if (caption.end - caption.start < MIN_CAPTION) issues.push({ index, level: "warn", message: "Shorter than 0.2 s; viewers may miss it." });
    const scripts = scriptsIn(caption.text);
    if (scripts.includes("other")) issues.push({ index, level: "error", message: "Contains letters the caption fonts cannot draw. Use Latin or Devanagari text." });
    else if (scripts.some(script => !font.scripts.includes(script as Script))) issues.push({ index, level: "error", message: `${font.label} has no ${scripts.includes("devanagari") && !font.scripts.includes("devanagari") ? "Devanagari" : "Latin"} letters. Choose Poppins, Mukta, Hind or Baloo 2.` });
  });
  return issues;
}

/* ---------- Layout and drawing (shared by preview and export) ---------- */

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Line = { words: { text: string; index: number; width: number }[]; width: number };
export type Layout = { fontPx: number; lineHeight: number; lines: Line[]; left: number; top: number; blockWidth: number; blockHeight: number; maxWidth: number; padX: number; padY: number; font: string; space: number };

export const fontPixels = (style: CaptionStyle, width: number, height: number) => Math.max(10, Math.round(Math.min(width, height) * style.size / 100));
export const cssFont = (style: CaptionStyle, px: number) => { const font = fontById(style.font); const weight = font.weights ? Math.min(font.weights[1], Math.max(font.weights[0], style.weight)) : font.weight; return `${weight} ${px}px "${font.family}"`; };
export const displayText = (text: string, style: CaptionStyle) => style.transform === "uppercase" ? text.toLocaleUpperCase() : style.transform === "lowercase" ? text.toLocaleLowerCase() : text;
const setSpacing = (ctx: Ctx, px: number) => { (ctx as { letterSpacing?: string }).letterSpacing = `${px}px`; };

/** Wraps words into lines limited by words per line, characters per line and the caption box width, inside the safe area. */
export function layoutCaption(ctx: Ctx, text: string, style: CaptionStyle, width: number, height: number): Layout {
  const fontPx = fontPixels(style, width, height), font = cssFont(style, fontPx), safe = safeArea(width, height, style.safeMargin);
  ctx.font = font; setSpacing(ctx, style.letterSpacing * fontPx);
  const safeWidth = width * (1 - 2 * safe.x), maxWidth = safeWidth * Math.min(1, Math.max(0.3, style.width));
  const padX = style.background === "none" ? 0 : Math.round(fontPx * style.padding * 1.4), padY = style.background === "none" ? 0 : Math.round(fontPx * style.padding);
  const space = ctx.measureText(" ").width, words = displayText(text, style).trim().split(/\s+/).filter(Boolean), lines: Line[] = [];
  let line: Line = { words: [], width: 0 }, chars = 0;
  words.forEach((word, index) => {
    const w = ctx.measureText(word).width, next = line.words.length ? line.width + space + w : w;
    if (line.words.length && (line.words.length >= style.maxWords || chars + 1 + [...word].length > style.maxChars || next + 2 * padX > maxWidth)) { lines.push(line); line = { words: [], width: 0 }; chars = 0; }
    line.width = line.words.length ? line.width + space + w : w; chars += (line.words.length ? 1 : 0) + [...word].length; line.words.push({ text: word, index, width: w });
  });
  if (line.words.length) lines.push(line);
  const lineHeight = Math.round(fontPx * style.lineHeight), blockWidth = Math.max(0, ...lines.map(l => l.width)) + 2 * padX, blockHeight = lines.length * lineHeight + 2 * padY;
  const minX = width * safe.x, maxX = width * (1 - safe.x) - blockWidth, minY = height * safe.top, maxY = height * (1 - safe.bottom) - blockHeight;
  const anchorX = style.align === "left" ? width * style.x : style.align === "right" ? width * style.x - blockWidth : width * style.x - blockWidth / 2;
  const left = Math.round(Math.min(Math.max(anchorX, minX), Math.max(minX, maxX))), top = Math.round(Math.min(Math.max(height * style.y - blockHeight / 2, minY), Math.max(minY, maxY)));
  return { fontPx, lineHeight, lines, left, top, blockWidth, blockHeight, maxWidth, padX, padY, font, space };
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function withOpacity(color: string, opacity: number) {
  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color); if (!hex) return color;
  const n = parseInt(hex[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, opacity))})`;
}

/** Whether this caption carries real word timings that line up with its words. */
export const hasWordTiming = (caption: Caption) => !!caption.words?.length && caption.words.length === caption.text.trim().split(/\s+/).filter(Boolean).length;
/** Index of the word being spoken at `time`, or -1 before the first word. */
export function spokenWord(caption: Caption, time: number) {
  if (!caption.words?.length) return -1;
  for (let i = caption.words.length - 1; i >= 0; i--) if (time >= caption.words[i].start) return i;
  return -1;
}

/** The caption box at `time` (for dragging in the preview), or null. */
export function captionBox(ctx: Ctx, captions: Caption[], time: number, style: CaptionStyle, width: number, height: number) {
  const index = activeIndex(captions, time); if (index < 0 || !captions[index].text.trim()) return null;
  const layout = layoutCaption(ctx, captions[index].text, style, width, height);
  return { x: layout.left, y: layout.top, width: layout.blockWidth, height: layout.blockHeight };
}

/** Draws the caption active at `time` onto a canvas the size of the output frame. Preview and export both call this. */
export function drawCaption(ctx: Ctx, captions: Caption[], time: number, style: CaptionStyle, width: number, height: number) {
  const index = activeIndex(captions, time); if (index < 0) return;
  const caption = captions[index]; if (!caption.text.trim()) return;
  const layout = layoutCaption(ctx, caption.text, style, width, height);
  const timed = style.highlightMode !== "none" && hasWordTiming(caption) ? caption.words! : undefined;
  const spoken = timed ? spokenWord(caption, time) : -1;
  const since = time - caption.start, ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
  const enter = style.entrance === "fade" || style.entrance === "rise" || style.entrance === "pop" ? ease(since / 0.18) : 1;
  const typed = style.entrance === "typewriter" ? Math.floor(Math.min(1, since / Math.max(0.3, Math.min(1.2, (caption.end - caption.start) * 0.6))) * [...caption.text].length) : Infinity;
  const cx = layout.left + layout.blockWidth / 2, cy = layout.top + layout.blockHeight / 2, radius = Math.round(layout.fontPx * style.radius);
  ctx.save();
  ctx.globalAlpha = style.entrance === "none" || style.entrance === "typewriter" ? 1 : enter;
  if (style.entrance === "rise") ctx.translate(0, Math.round((1 - enter) * layout.fontPx * 0.4));
  if (style.entrance === "pop") { const scale = 0.86 + 0.14 * enter; ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy); }
  ctx.font = layout.font; setSpacing(ctx, style.letterSpacing * layout.fontPx); ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.lineJoin = "round"; ctx.miterLimit = 2;
  const backing = withOpacity(style.backgroundColor, style.backgroundOpacity);
  if (style.background === "band") { ctx.fillStyle = backing; roundRect(ctx, layout.left, layout.top, layout.blockWidth, layout.blockHeight, radius); ctx.fill(); }
  let drawn = 0;
  layout.lines.forEach((line, row) => {
    const y = layout.top + layout.padY + row * layout.lineHeight + layout.lineHeight / 2;
    const innerLeft = layout.left + layout.padX, innerWidth = layout.blockWidth - 2 * layout.padX;
    let x = style.align === "left" ? innerLeft : style.align === "right" ? innerLeft + innerWidth - line.width : innerLeft + (innerWidth - line.width) / 2;
    if (style.background === "box") { ctx.fillStyle = backing; roundRect(ctx, x - layout.padX, y - layout.lineHeight / 2 - layout.padY / 2, line.width + 2 * layout.padX, layout.lineHeight + layout.padY, radius); ctx.fill(); }
    const lineActive = timed && line.words.some(word => word.index === spoken);
    for (const word of line.words) {
      const w = word.width, timing = timed?.[word.index];
      let text = word.text;
      if (drawn >= typed) text = ""; else if (drawn + [...text].length > typed) text = [...text].slice(0, typed - drawn).join("");
      drawn += [...word.text].length + 1;
      const isSpoken = timed && word.index === spoken, done = timed && timing && time >= timing.end;
      if (timed && style.highlightMode === "reveal" && timing && time < timing.start) { x += w + layout.space; continue; }
      if (text) {
        ctx.save();
        if (isSpoken && style.emphasis !== 1 && (style.highlightMode === "word")) { const wx = x + w / 2; ctx.translate(wx, y); ctx.scale(style.emphasis, style.emphasis); ctx.translate(-wx, -y); }
        if (isSpoken && style.activeBg && style.highlightMode === "word") { ctx.fillStyle = style.activeBg; const pad = layout.fontPx * 0.18; roundRect(ctx, x - pad, y - layout.lineHeight * 0.48, w + 2 * pad, layout.lineHeight * 0.96, layout.fontPx * 0.18); ctx.fill(); }
        if (style.outline > 0) { ctx.lineWidth = layout.fontPx * style.outline / 100 * 2; ctx.strokeStyle = style.outlineColor; ctx.strokeText(text, x, y); }
        const highlighted = timed && ((style.highlightMode === "word" && isSpoken) || (style.highlightMode === "line" && lineActive) || (style.highlightMode === "karaoke" && done));
        const accent = style.gradient ? (() => { const g = ctx.createLinearGradient(x, 0, x + Math.max(1, w), 0); g.addColorStop(0, style.gradient![0]); g.addColorStop(1, style.gradient![1]); return g; })() : style.highlight;
        if (style.shadow) { ctx.shadowBlur = style.shadow.blur * layout.fontPx / 60; ctx.shadowOffsetX = style.shadow.x * layout.fontPx / 60; ctx.shadowOffsetY = style.shadow.y * layout.fontPx / 60; ctx.shadowColor = style.shadow.color; }
        ctx.fillStyle = highlighted ? accent : style.color;
        ctx.fillText(text, x, y);
        if (timed && style.highlightMode === "karaoke" && isSpoken && timing && !done) {
          const fraction = Math.min(1, Math.max(0, (time - timing.start) / Math.max(0.05, timing.end - timing.start)));
          ctx.save(); ctx.beginPath(); ctx.rect(x, y - layout.lineHeight, w * fraction, layout.lineHeight * 2); ctx.clip(); ctx.fillStyle = accent; ctx.fillText(text, x, y); ctx.restore();
        }
        ctx.restore();
      }
      x += w + layout.space;
    }
  });
  ctx.restore();
}

/* ---------- Text exports ---------- */

const stamp = (seconds: number, separator: string) => { const ms = Math.round(seconds * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}${separator}${String(ms % 1000).padStart(3, "0")}`; };
const clean = (text: string) => text.replace(/-->/g, "→").replace(/\r/g, "").trim();
export function toSrt(captions: Caption[]) { return captions.map((caption, i) => `${i + 1}\n${stamp(caption.start, ",")} --> ${stamp(caption.end, ",")}\n${clean(caption.text)}\n`).join("\n"); }
export function toVtt(captions: Caption[]) { return `WEBVTT\n\n${captions.map(caption => `${stamp(caption.start, ".")} --> ${stamp(caption.end, ".")}\n${clean(caption.text)}\n`).join("\n")}`; }

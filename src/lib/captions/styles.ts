import type { CaptionStyle } from "./types";

const YELLOW = "#FFD60A";
const INK = "#141414";

/** Caption presets. Each one uses a bundled font with full Devanagari and Latin coverage. */
export const CAPTION_STYLES: readonly CaptionStyle[] = [
  {
    id: "clean",
    name: "Clean",
    description: "White words with a dark outline; the spoken word turns yellow. Works on any footage.",
    font: "poppins",
    fontSizeRatio: 0.045,
    textColor: "#FFFFFF",
    strokeColor: "#000000",
    strokeRatio: 0.16,
    shadow: false,
    highlight: { kind: "color", color: YELLOW },
    box: null,
    verticalPosition: 0.72,
    maxWidthRatio: 0.84,
    group: { maxWords: 4, maxChars: 24 },
  },
  {
    id: "pop",
    name: "Pop",
    description: "Big, two words at a time, with a yellow block behind the spoken word. For fast, punchy Reels.",
    font: "baloo-2",
    fontSizeRatio: 0.058,
    textColor: "#FFFFFF",
    strokeColor: "#000000",
    strokeRatio: 0.14,
    shadow: false,
    highlight: { kind: "pill", fill: YELLOW, textColor: INK },
    box: null,
    verticalPosition: 0.68,
    maxWidthRatio: 0.86,
    group: { maxWords: 2, maxChars: 16 },
  },
  {
    id: "boxed",
    name: "Boxed",
    description: "White text on a dark band. Stays readable over busy or bright backgrounds.",
    font: "mukta",
    fontSizeRatio: 0.042,
    textColor: "#FFFFFF",
    strokeColor: "#000000",
    strokeRatio: 0,
    shadow: false,
    highlight: { kind: "color", color: YELLOW },
    box: { fill: "rgba(0, 0, 0, 0.72)" },
    verticalPosition: 0.74,
    maxWidthRatio: 0.84,
    group: { maxWords: 4, maxChars: 24 },
  },
  {
    id: "bold-yellow",
    name: "Bold yellow",
    description: "Yellow words with a heavy outline; the spoken word turns white. Loud, classic Reel look.",
    font: "baloo-2",
    fontSizeRatio: 0.05,
    textColor: YELLOW,
    strokeColor: "#000000",
    strokeRatio: 0.2,
    shadow: false,
    highlight: { kind: "color", color: "#FFFFFF" },
    box: null,
    verticalPosition: 0.7,
    maxWidthRatio: 0.84,
    group: { maxWords: 3, maxChars: 20 },
  },
  {
    id: "subtitle",
    name: "Subtitle",
    description: "Smaller text low on the screen with a soft shadow, no highlight. For calm, explainer videos.",
    font: "hind",
    fontSizeRatio: 0.034,
    textColor: "#FFFFFF",
    strokeColor: "#000000",
    strokeRatio: 0,
    shadow: true,
    highlight: { kind: "none" },
    box: null,
    verticalPosition: 0.84,
    maxWidthRatio: 0.88,
    group: { maxWords: 7, maxChars: 36 },
  },
];

export const DEFAULT_CAPTION_STYLE = CAPTION_STYLES[0];

/** Looks up a style by id, falling back to the default for unknown ids (e.g. from an old draft). */
export function getCaptionStyle(id: string | undefined): CaptionStyle {
  return CAPTION_STYLES.find((s) => s.id === id) ?? DEFAULT_CAPTION_STYLE;
}

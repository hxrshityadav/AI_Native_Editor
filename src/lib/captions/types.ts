/** A single spoken word with timings in seconds, relative to the start of the source video. */
export type Word = {
  text: string;
  start: number;
  end: number;
};

/** A group of words shown on screen together. */
export type CaptionLine = {
  words: Word[];
  text: string;
  start: number;
  end: number;
};

export type CaptionStyle = {
  /** Font size as a fraction of the output frame height. */
  fontSizeRatio: number;
  fontFamily: string;
  fontWeight: number;
  textColor: string;
  /** Color for the word currently being spoken. */
  highlightColor: string;
  strokeColor: string;
  /** Stroke width as a fraction of the font size. */
  strokeRatio: number;
  /** Vertical anchor of the caption block centre, as a fraction of frame height from the top. */
  verticalPosition: number;
  /** Maximum caption width as a fraction of frame width. */
  maxWidthRatio: number;
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSizeRatio: 0.045,
  fontFamily:
    '"Noto Sans Devanagari", "Noto Sans", "Nirmala UI", "Mangal", system-ui, sans-serif',
  fontWeight: 800,
  textColor: "#ffffff",
  highlightColor: "#ffd60a",
  strokeColor: "#000000",
  strokeRatio: 0.16,
  verticalPosition: 0.72,
  maxWidthRatio: 0.84,
};

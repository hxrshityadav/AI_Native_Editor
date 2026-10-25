import type { CaptionFontId } from "./fonts";
import type { GroupOptions } from "./group";
import type { Appearance, Animation } from "../editor/project";
import type { FontRecord } from "../editor/fontLibrary";

/** A single spoken word with timings in seconds, relative to the start of the source video. */
export type Word = {
  text: string;
  start: number;
  end: number;
};

/** A group of words shown on screen together. */
export type CaptionLine = {
  id?: string;
  appearance?: Appearance;
  animation?: Animation;
  words: Word[];
  text: string;
  start: number;
  end: number;
};

export type CaptionStyle = {
  additionalFonts?: FontRecord[];
  customFont?: FontRecord;
  animation?: Animation;
  id: string;
  name: string;
  /** One line telling the user when to pick it. */
  description: string;
  font: CaptionFontId;
  /** Font size as a fraction of the output frame height. */
  fontSizeRatio: number;
  textColor: string;
  strokeColor: string;
  /** Stroke width as a fraction of the font size; 0 for none. */
  strokeRatio: number;
  /** Soft drop shadow behind the text. */
  shadow: boolean;
  /** How the word being spoken stands out. */
  highlight: { kind: "color"; color: string } | { kind: "pill"; fill: string; textColor: string } | { kind: "none" };
  /** Rounded background behind each row of text. */
  box: { fill: string } | null;
  /** Vertical anchor of the caption block centre, as a fraction of frame height from the top. */
  verticalPosition: number;
  /** Maximum caption width as a fraction of frame width. */
  maxWidthRatio: number;
  /** How many words and characters fit on screen at once. */
  group: Pick<GroupOptions, "maxWords" | "maxChars">;
} & Omit<Appearance, "font">;

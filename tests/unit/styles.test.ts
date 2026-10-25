import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAPTION_FONTS,
  CAPTION_STYLES,
  captionFont,
  drawCaption,
  fontFiles,
  getCaptionStyle,
  groupWords,
  type CaptionFontId,
  type Ctx2D,
  type Word,
} from "@/lib/captions";

const PUBLIC = join(__dirname, "../../public");

describe("caption styles", () => {
  it("offers 4–6 styles with unique ids and known fonts", () => {
    expect(CAPTION_STYLES.length).toBeGreaterThanOrEqual(4);
    expect(CAPTION_STYLES.length).toBeLessThanOrEqual(6);
    expect(new Set(CAPTION_STYLES.map((s) => s.id)).size).toBe(CAPTION_STYLES.length);
    for (const s of CAPTION_STYLES) expect(Object.keys(CAPTION_FONTS)).toContain(s.font);
  });

  it("falls back to the default for unknown ids", () => {
    expect(getCaptionStyle("removed-style").id).toBe(CAPTION_STYLES[0].id);
    expect(getCaptionStyle(undefined).id).toBe(CAPTION_STYLES[0].id);
  });

  it("bundles a Devanagari and a Latin file plus the OFL licence for every font", () => {
    for (const id of Object.keys(CAPTION_FONTS) as CaptionFontId[]) {
      const files = fontFiles(id);
      expect(files.map((f) => f.url).join()).toMatch(/devanagari.*latin/);
      for (const f of files) expect(existsSync(join(PUBLIC, f.url)), f.url).toBe(true);
      expect(existsSync(join(PUBLIC, "fonts", CAPTION_FONTS[id].slug, "OFL.txt"))).toBe(true);
    }
  });

  it("names the bundled family first in the canvas font", () => {
    expect(captionFont("mukta", 40)).toBe('700 40px "RF Mukta", "Noto Sans Devanagari", sans-serif');
  });
});

/** Records the canvas calls drawCaption makes; measureText is 10 px per character. */
function recorder() {
  const calls: { op: string; args: unknown[]; fillStyle: unknown }[] = [];
  const ctx: Record<string, unknown> = {
    fillStyle: "",
    measureText: (s: string) => ({ width: s.length * 10, actualBoundingBoxAscent: 30, actualBoundingBoxDescent: 10 }),
  };
  for (const op of ["save", "restore", "beginPath", "roundRect", "fill", "strokeText", "fillText"]) {
    ctx[op] = (...args: unknown[]) => calls.push({ op, args, fillStyle: ctx.fillStyle });
  }
  return { ctx: ctx as unknown as Ctx2D, calls };
}

const words: Word[] = [
  { text: "नमस्ते", start: 0, end: 0.5 },
  { text: "दोस्तों", start: 0.5, end: 1 },
];
const line = groupWords(words)[0];

describe("drawCaption", () => {
  it("boxed: one rounded box per row, no outline", () => {
    const { ctx, calls } = recorder();
    drawCaption(ctx, line, 0.2, getCaptionStyle("boxed"), 1080, 1920);
    expect(calls.filter((c) => c.op === "roundRect")).toHaveLength(1);
    expect(calls.filter((c) => c.op === "strokeText")).toHaveLength(0);
  });

  it("pop: a pill only behind the spoken word, which is drawn without an outline", () => {
    const { ctx, calls } = recorder();
    const pop = getCaptionStyle("pop");
    drawCaption(ctx, line, 0.7, pop, 1080, 1920);
    const pills = calls.filter((c) => c.op === "roundRect");
    expect(pills).toHaveLength(1);
    expect(pills[0].args.every((n) => Number.isFinite(n))).toBe(true);
    expect(calls.filter((c) => c.op === "strokeText").map((c) => c.args[0])).toEqual(["नमस्ते"]);
    const spoken = calls.find((c) => c.op === "fillText" && c.args[0] === "दोस्तों");
    expect(pop.highlight.kind === "pill" && spoken?.fillStyle).toBe(pop.highlight.kind === "pill" && pop.highlight.textColor);
  });

  it("clean: the spoken word takes the highlight colour", () => {
    const { ctx, calls } = recorder();
    const clean = getCaptionStyle("clean");
    drawCaption(ctx, line, 0.2, clean, 1080, 1920);
    const fills = Object.fromEntries(calls.filter((c) => c.op === "fillText").map((c) => [c.args[0], c.fillStyle]));
    expect(fills["नमस्ते"]).toBe(clean.highlight.kind === "color" && clean.highlight.color);
    expect(fills["दोस्तों"]).toBe(clean.textColor);
  });

  it("subtitle: no outline and no highlight", () => {
    const { ctx, calls } = recorder();
    const sub = getCaptionStyle("subtitle");
    drawCaption(ctx, line, 0.2, sub, 1080, 1920);
    expect(calls.filter((c) => c.op === "strokeText")).toHaveLength(0);
    expect(new Set(calls.filter((c) => c.op === "fillText").map((c) => c.fillStyle))).toEqual(new Set([sub.textColor]));
  });
});

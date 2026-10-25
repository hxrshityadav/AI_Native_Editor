import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { animationFrame, ANIMATIONS } from "@/lib/captions/animation";
import { applyAppearance } from "@/lib/captions/appearance";
import { getCaptionStyle } from "@/lib/captions/styles";
import { defaultEditing } from "@/lib/editor/project";
import { FONT_CATALOG, validateFontFile } from "@/lib/editor/fontLibrary";

describe("font library", () => {
  it("has eight distinct, licensed families across five categories", () => {
    expect(new Set(FONT_CATALOG.map((font) => font.id)).size).toBe(8);
    expect(new Set(FONT_CATALOG.map((font) => font.category)).size).toBe(5);
    for (const font of FONT_CATALOG.filter((font) => font.url)) {
      const file = join(process.cwd(), "public", font.url!);
      expect(existsSync(file)).toBe(true);
      expect(existsSync(join(file, "..", "OFL.txt"))).toBe(true);
    }
  });
  it.each(["woff", "woff2", "ttf", "otf"])("accepts %s with an empty browser MIME type", (extension) => {
    expect(validateFontFile({ name: `font.${extension}`, type: "", size: 4000 })).toBeNull();
  });
  it.each([
    { name: "fake.exe", type: "font/woff2", size: 100 },
    { name: "font.woff2", type: "image/png", size: 100 },
    { name: "font.ttf", type: "font/ttf", size: 0 },
    { name: "font.ttf", type: "font/ttf", size: 11 * 1024 * 1024 },
  ])("rejects bad font metadata: %j", (file) => expect(validateFontFile(file)).not.toBeNull());
});
describe("subtitle appearance", () => {
  it("overrides style, disables effects independently, and selects a variable font", () => {
    const style = applyAppearance(getCaptionStyle("boxed"), { font: "asset:notoserif", weight: 600, boxOpacity: 0,
      highlightEnabled: false, strokeRatio: 0, shadow: false }, defaultEditing().animation, FONT_CATALOG);
    expect(style.customFont?.label).toBe("Noto Serif");
    expect(style.weight).toBe(600);
    expect(style.box).toBeNull();
    expect(style.highlight.kind).toBe("none");
    expect(style.fontSizeRatio).toBe(getCaptionStyle("boxed").fontSizeRatio);
  });
});
describe("deterministic subtitle effects", () => {
  it.each(ANIMATIONS)("produces finite reproducible frames for $name", ({ id }) => {
    const animation = { effect: id, duration: 0.25, intensity: 0.5 };
    for (const time of [0, 0.1, 0.5, 1]) {
      const frame = animationFrame(animation, time, 0, 1);
      expect(animationFrame(animation, time, 0, 1)).toEqual(frame);
      expect(Object.values(frame).every(Number.isFinite)).toBe(true);
      expect(frame.opacity).toBeGreaterThanOrEqual(0);
      expect(frame.opacity).toBeLessThanOrEqual(1);
    }
  });
  it("caps the entrance at the caption duration", () => {
    expect(animationFrame({ effect: "fade", duration: 1, intensity: 1 }, 0.1, 0, 0.1).opacity).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { applyBrandKit, brandKitFromStyle, brandKitSchema, readableTextOn, type BrandKit } from "@/lib/brandKit";
import { getCaptionStyle } from "@/lib/captions";

describe("brand kit", () => {
  it("a kit made from a style leaves that style unchanged", () => {
    for (const id of ["clean", "pop", "boxed", "bold-yellow", "subtitle"]) {
      const style = getCaptionStyle(id);
      const applied = applyBrandKit(style, brandKitFromStyle(style));
      expect(applied.font).toBe(style.font);
      expect(applied.textColor.toUpperCase()).toBe(style.textColor.toUpperCase());
      expect(applied.fontSizeRatio).toBe(style.fontSizeRatio);
      expect(applied.verticalPosition).toBe(style.verticalPosition);
      expect(applied.highlight.kind).toBe(style.highlight.kind);
    }
  });

  const kit: BrandKit = {
    enabled: true,
    font: "hind",
    textColor: "#FF0000",
    highlightColor: "#1E3A8A",
    sizeScale: 1.2,
    verticalPosition: 0.3,
  };

  it("overrides font, colours, size and position but keeps the style's shape", () => {
    const boxed = getCaptionStyle("boxed");
    const out = applyBrandKit(boxed, kit);
    expect(out).toMatchObject({ font: "hind", textColor: "#FF0000", verticalPosition: 0.3, box: boxed.box });
    expect(out.fontSizeRatio).toBeCloseTo(boxed.fontSizeRatio * 1.2);
    expect(out.highlight).toEqual({ kind: "color", color: "#1E3A8A" });
  });

  it("keeps pill text readable on the chosen pill colour", () => {
    const pop = applyBrandKit(getCaptionStyle("pop"), kit);
    expect(pop.highlight).toEqual({ kind: "pill", fill: "#1E3A8A", textColor: "#FFFFFF" });
    const light = applyBrandKit(getCaptionStyle("pop"), { ...kit, highlightColor: "#FFD60A" });
    expect(light.highlight).toMatchObject({ textColor: "#141414" });
  });

  it("leaves 'no highlight' styles without a highlight", () => {
    expect(applyBrandKit(getCaptionStyle("subtitle"), kit).highlight).toEqual({ kind: "none" });
  });

  it("picks readable text colours", () => {
    expect(readableTextOn("#FFFFFF")).toBe("#141414");
    expect(readableTextOn("#000000")).toBe("#FFFFFF");
    expect(readableTextOn("#E11D48")).toBe("#FFFFFF");
  });

  it("rejects corrupted stored kits", () => {
    expect(brandKitSchema.safeParse(kit).success).toBe(true);
    expect(brandKitSchema.safeParse({ ...kit, textColor: "red" }).success).toBe(false);
    expect(brandKitSchema.safeParse({ ...kit, font: "comic-sans" }).success).toBe(false);
    expect(brandKitSchema.safeParse({ ...kit, sizeScale: 5 }).success).toBe(false);
  });
});

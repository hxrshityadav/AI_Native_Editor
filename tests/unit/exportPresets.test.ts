import { describe, expect, it } from "vitest";
import { isNineSixteen, planExport } from "@/lib/media/exportPresets";

const size = (p: { width: number; height: number }) => `${p.width}×${p.height}`;

describe("planExport", () => {
  it("keeps a 1080×1920 clip as is for Reels", () => {
    expect(planExport({ width: 1080, height: 1920 }, "reels", "fill")).toEqual({
      width: 1080,
      height: 1920,
      fit: "fill",
      resize: false,
      quality: "high",
    });
  });

  it("downscales 4K vertical to 1080×1920 and never upscales 720p", () => {
    expect(size(planExport({ width: 2160, height: 3840 }, "reels", "fill"))).toBe("1080×1920");
    expect(planExport({ width: 720, height: 1280 }, "reels", "fill")).toMatchObject({ width: 720, height: 1280, resize: false });
  });

  it("smaller file caps at 720×1280 with medium quality", () => {
    expect(planExport({ width: 1080, height: 1920 }, "small", "fill")).toMatchObject({
      width: 720,
      height: 1280,
      resize: true,
      quality: "medium",
    });
  });

  it("original keeps size and shape, even for landscape", () => {
    expect(planExport({ width: 1920, height: 1080 }, "original", "fill")).toMatchObject({
      width: 1920,
      height: 1080,
      resize: false,
    });
  });

  it("fills landscape by cropping a centred 9:16 region, without upscaling", () => {
    expect(planExport({ width: 1280, height: 720 }, "reels", "fill")).toMatchObject({ width: 404, height: 720, fit: "cover" });
    expect(planExport({ width: 3840, height: 2160 }, "reels", "fill")).toMatchObject({ width: 1080, height: 1920, fit: "cover" });
  });

  it("fits landscape inside a 9:16 frame with bars", () => {
    expect(planExport({ width: 1280, height: 720 }, "reels", "fit")).toMatchObject({ width: 1080, height: 1920, fit: "contain" });
    expect(planExport({ width: 640, height: 360 }, "small", "fit")).toMatchObject({ width: 640, height: 1136, fit: "contain" });
  });

  it("handles 3:4 portrait like any non-9:16 frame", () => {
    expect(planExport({ width: 1080, height: 1440 }, "reels", "fill")).toMatchObject({ width: 810, height: 1440, fit: "cover" });
  });

  it("always produces even dimensions and 9:16 for box presets", () => {
    for (const [w, h] of [[1279, 721], [1001, 999], [333, 777], [4000, 3000]]) {
      for (const framing of ["fill", "fit"] as const) {
        const p = planExport({ width: w, height: h }, "reels", framing);
        expect(p.width % 2 + (p.height % 2)).toBe(0);
        expect(Math.abs(p.width / p.height - 9 / 16)).toBeLessThan(0.01);
      }
    }
  });
});

describe("isNineSixteen", () => {
  it("accepts phone sizes near 9:16", () => {
    expect(isNineSixteen(1080, 1920)).toBe(true);
    expect(isNineSixteen(1080, 1918)).toBe(true);
    expect(isNineSixteen(1080, 1440)).toBe(false);
  });
});

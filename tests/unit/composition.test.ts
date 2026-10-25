import { describe, expect, it } from "vitest";
import { defaultEditing } from "@/lib/editor/project";
import { ASPECT_RATIOS, compositionRect, planComposition } from "@/lib/media/composition";

describe("shared composition geometry", () => {
  it.each(ASPECT_RATIOS)("produces even codec dimensions for %s", (ratio) => {
    const plan = planComposition({ width: 1920, height: 1080 }, "reels", "fill", { ...defaultEditing().composition, ratio });
    const [a, b] = ratio.split(":").map(Number);
    expect(plan.width % 2 + plan.height % 2).toBe(0);
    expect(Math.abs(plan.width / plan.height - a / b)).toBeLessThan(0.005);
    const rect = compositionRect(1920, 1080, plan);
    expect(rect.width / rect.height).toBeCloseTo(1920 / 1080);
    expect(rect.width >= plan.width && rect.height >= plan.height).toBe(true);
  });
  it("positions and scales without stretching and fits the whole source", () => {
    const c = { ...defaultEditing().composition, ratio: "1:1" as const, x: 0, y: 1 };
    const plan = planComposition({ width: 1920, height: 1080 }, "reels", "fit", c);
    const rect = compositionRect(1920, 1080, plan);
    expect(rect.x).toBe(0);
    expect(rect.y + rect.height).toBe(plan.height);
    expect(rect.width / rect.height).toBeCloseTo(16 / 9);
  });
});

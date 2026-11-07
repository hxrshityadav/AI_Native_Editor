import { expect, it } from "vitest";
import { PHOTO_SIZES, clampCentre, cropFor, pixelSize, sheetLayout } from "../../src/lib/images/passport";

it("converts printed sizes to 300 DPI pixels", () => {
  expect(pixelSize(PHOTO_SIZES.find(size => size.id === "35x45")!)).toEqual({ width: 413, height: 531 });
  expect(pixelSize(PHOTO_SIZES.find(size => size.id === "2x2in")!)).toEqual({ width: 600, height: 600 });
});

it("crops the largest rectangle of the photo's aspect at zoom 1 and narrows it when zooming in", () => {
  const base = cropFor(4000, 3000, 35 / 45, 1, 2000, 1500);
  expect(base.height).toBeCloseTo(3000); expect(base.width).toBeCloseTo(3000 * 35 / 45); expect(base.x + base.width / 2).toBeCloseTo(2000);
  const zoomed = cropFor(4000, 3000, 35 / 45, 2, 2000, 1500);
  expect(zoomed.width).toBeCloseTo(base.width / 2); expect(zoomed.width / zoomed.height).toBeCloseTo(35 / 45);
  expect(cropFor(4000, 3000, 1, 0.1, 0, 0).width).toBeCloseTo(3000 / 0.5); // zoom is clamped to the minimum
});

it("keeps the centre over the image", () => {
  expect(clampCentre(100, 50, -10, 80)).toEqual({ cx: 0, cy: 50 });
});

it("lays out copies on a 6 × 4 in sheet without overlap or overflow", () => {
  const photo = { width: 413, height: 531 }, layout = sheetLayout(photo);
  expect(layout.positions.length).toBe(6); // 3 × 2 copies of 413 × 531 px on 1800 × 1200 px
  for (const { x, y } of layout.positions) { expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0); expect(x + photo.width).toBeLessThanOrEqual(layout.width); expect(y + photo.height).toBeLessThanOrEqual(layout.height); }
});

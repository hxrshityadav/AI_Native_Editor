import { expect, it } from "vitest";
import { encodeToTarget, fitWithin, imageHeader, MAX_IMAGE_BYTES, outputName, pairedDimensions, validateDimensions, validateImageFile } from "../../src/lib/images/policy";

it("validates byte limits and MIME declarations without trusting names", () => {
  for (const file of [{ size: 0, type: "image/png" }, { size: MAX_IMAGE_BYTES + 1, type: "image/jpeg" }, { size: 12, type: "image/svg+xml" }]) expect(() => validateImageFile(file)).toThrow();
  for (const type of ["image/jpeg", "image/png", "image/webp", "", "application/octet-stream"]) expect(() => validateImageFile({ size: 1024, type })).not.toThrow();
});
it("bounds dimensions before allocating decoded canvases", () => {
  for (const [width, height] of [[0, 1], [1.5, 4], [9000, 1], [8192, 8192], [Infinity, 1]]) expect(() => validateDimensions(width, height)).toThrow();
  expect(() => validateDimensions(4000, 4000)).not.toThrow();
});
it("preserves the supplied ratio and fits without upscaling or cropping", () => {
  expect(pairedDimensions(600, 400, "width", 300, true)).toEqual({ width: 300, height: 200 });
  expect(pairedDimensions(600, 400, "height", 100, true)).toEqual({ width: 150, height: 100 });
  expect(pairedDimensions(600, 400, "width", 300, false)).toEqual({ width: 300, height: 400 });
  expect(fitWithin(600, 400, 400, 400)).toEqual({ width: 400, height: 267 });
  expect(fitWithin(600, 400, 1080, 1080)).toEqual({ width: 600, height: 400 });
});
it("sniffs PNG dimensions and rejects animated or oversized headers", () => {
  const bytes = new Uint8Array(53), view = new DataView(bytes.buffer);
  bytes.set([137,80,78,71,13,10,26,10]); view.setUint32(8,13); bytes.set(new TextEncoder().encode("IHDR"),12); view.setUint32(16,600); view.setUint32(20,400);
  bytes.set(new TextEncoder().encode("IDAT"),37);
  expect(imageHeader(bytes)).toEqual({ format: "image/png", width: 600, height: 400 });
  bytes.set(new TextEncoder().encode("acTL"),37); expect(() => imageHeader(bytes)).toThrow(/Animated/);
  bytes.set(new TextEncoder().encode("IDAT"),37); view.setUint32(16,100000); expect(() => imageHeader(bytes)).toThrow(/8192/);
  expect(() => imageHeader(new Uint8Array([1,2,3]))).toThrow(/contents/);
  expect(() => imageHeader(bytes.subarray(0,33))).toThrow(/metadata limit/);
});
it("sniffs JPEG SOF and compact lossless WebP dimensions", () => {
  expect(imageHeader(Uint8Array.from([255,216,255,192,0,7,8,1,144,2,88]))).toEqual({ format: "image/jpeg", width: 600, height: 400 });
  const webp = new Uint8Array(25); webp.set(new TextEncoder().encode("RIFF")); webp.set(new TextEncoder().encode("WEBPVP8L"),8); webp[20]=47;
  expect(imageHeader(webp)).toEqual({ format: "image/webp", width: 1, height: 1 });
});
it("chooses a measured quality that meets a target", async () => {
  const result = await encodeToTarget(async quality => new Blob([new Uint8Array(Math.ceil(100 + quality * 10000))]), 0.9, 2000);
  expect(result.targetMet).toBe(true); expect(result.blob.size).toBeLessThanOrEqual(2000); expect(result.quality).toBeGreaterThan(0.18);
});
it("reports an infeasible target using the smallest measured candidate", async () => {
  const result = await encodeToTarget(async quality => new Blob([new Uint8Array(1000 + Math.ceil(quality * 1000))]), 0.8, 100);
  expect(result.targetMet).toBe(false); expect(result.blob.size).toBe(1010);
  await expect(encodeToTarget(async () => new Blob(), 0.8, -1)).rejects.toThrow(/valid/);
});
it("downloads with a new safe name and a matching extension", () => {
  expect(outputName("photo.jpeg", "converter", "image/png")).toBe("photo-converter.png");
  expect(outputName("../unsafe:name.png", "resizer", "image/webp")).not.toContain("/");
});

import { expect, it } from "vitest";
import { normalizeAvcConfig } from "@openreel/core/export/avc-config";

it("repairs only the duplicated SPS/PPS descriptor observed in Firefox export", () => {
  const broken = Uint8Array.from([1, 100, 0, 30, 3, 1, 0, 5, 0x67, 0x67, 100, 0, 30, 1, 0, 3, 0x68, 0x68, 0xce]);
  const before = broken.slice();
  expect(normalizeAvcConfig(broken)).toEqual(Uint8Array.from([1, 100, 0, 30, 255, 225, 0, 4, 0x67, 100, 0, 30, 1, 0, 2, 0x68, 0xce]));
  expect(broken).toEqual(before);
  const valid = Uint8Array.from([1, 100, 0, 30, 255, 225, 0, 4, 0x67, 100, 0, 30, 1, 0, 2, 0x68, 0xce]);
  expect(normalizeAvcConfig(valid)).toBe(valid);
  expect(normalizeAvcConfig(new Uint8Array([1, 2]))).toEqual(new Uint8Array([1, 2]));
});

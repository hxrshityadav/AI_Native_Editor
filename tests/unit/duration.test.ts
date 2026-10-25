import { describe, expect, it } from "vitest";
import { assertVideoDuration, validateVideoDuration } from "@/lib/media/duration";

describe("10-minute duration boundary", () => {
  it.each([0.5, 30, 300, 600, 600 + Number.EPSILON * 600])("accepts %s seconds", (seconds) => {
    expect(validateVideoDuration(seconds)).toBe(true);
    expect(() => assertVideoDuration(seconds)).not.toThrow();
  });
  it.each([600.000001, 600.01, 601, 0, -1, NaN, Infinity, -Infinity, undefined, null, "600"])("rejects %s", (seconds) => {
    expect(validateVideoDuration(seconds)).toBe(false);
    expect(() => assertVideoDuration(seconds)).toThrow(/10 minutes/);
  });
});

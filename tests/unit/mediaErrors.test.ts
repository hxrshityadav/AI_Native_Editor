import { describe, expect, it } from "vitest";
import { describeMediaError } from "@/lib/media/errors";

const domError = (name: string, message = "x") => new DOMException(message, name);
const named = (name: string, message: string) => Object.assign(new Error(message), { name });

describe("describeMediaError", () => {
  it.each([
    ["QuotaExceededError", /free storage/],
    ["NotReadableError", /lost access/],
    ["NotFoundError", /lost access/],
    ["EncodingError", /video processor/],
    ["NotSupportedError", /can't process/],
  ])("maps %s to specific advice", (name, pattern) => {
    const p = describeMediaError("render", domError(name));
    expect(p.message).toMatch(pattern);
    expect(p.action.length).toBeGreaterThan(20);
  });

  it("keeps the error name when it crossed the worker boundary as a plain Error", () => {
    expect(describeMediaError("render", named("QuotaExceededError", "write failed")).message).toMatch(/free storage/);
  });

  it("recognises quota errors by message too", () => {
    expect(describeMediaError("render", new Error("The quota has been exceeded.")).message).toMatch(/free storage/);
  });

  it("passes our font error through with a connection hint", () => {
    const p = describeMediaError("render", new Error("Couldn't load the caption font. Check your connection and try again."));
    expect(p.message).toMatch(/caption font/);
    expect(p.action).toMatch(/connection/);
  });

  it("never gives extraction video-encoder or storage advice", () => {
    for (const err of [domError("EncodingError"), domError("OperationError"), domError("QuotaExceededError"), new Error("WebCodecs: QuotaExceededError; Web Audio: EncodingError")]) {
      const p = describeMediaError("extract", err);
      expect(p.message).toMatch(/speech audio/);
      expect(`${p.message} ${p.action}`).not.toMatch(/video processor|other apps|tabs|storage|1080p/);
    }
  });

  it("falls back per step, keeping the raw message for device reports", () => {
    expect(describeMediaError("extract", new Error("boom")).message).toBe("Couldn't extract the speech audio on this device (boom).");
    expect(describeMediaError("render", "weird").message).toBe("The export failed (weird).");
  });
});

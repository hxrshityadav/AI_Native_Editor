import { describe, expect, it } from "vitest";
import type { ProbeResult } from "@/lib/media/types";
import { LIMITS, validateFileBasics, validateProbe } from "@/lib/media/validate";

const good: ProbeResult = {
  fileSizeBytes: 5_000_000,
  mimeType: 'video/mp4; codecs="avc1.64001f, mp4a.40.2"',
  durationSec: 30,
  video: { codec: "avc", width: 1080, height: 1920, rotation: 0, canDecode: true, hdr: false },
  audio: { codec: "aac", channels: 2, sampleRate: 48000, canDecode: true },
};

function codeOf(p: ProbeResult) {
  const r = validateProbe(p);
  return r.ok ? "OK" : r.error.code;
}

describe("validateProbe", () => {
  it("accepts a vertical clip with no warnings", () => {
    expect(validateProbe(good)).toEqual({ ok: true, warnings: [] });
  });

  it.each([
    ["NO_VIDEO_TRACK", { video: null }],
    ["VIDEO_UNDECODABLE", { video: { ...good.video!, canDecode: false } }],
    ["HEVC_UNDECODABLE", { video: { ...good.video!, codec: "hevc", canDecode: false } }],
    ["NO_AUDIO_TRACK", { audio: null }],
    ["AUDIO_UNDECODABLE", { audio: { ...good.audio!, canDecode: false } }],
    ["TOO_SHORT", { durationSec: 0.5 }],
    ["TOO_LONG", { durationSec: LIMITS.maxDurationSec + 1 }],
    ["RESOLUTION_TOO_HIGH", { video: { ...good.video!, width: 4320, height: 7680 } }],
    ["FILE_TOO_LARGE", { fileSizeBytes: LIMITS.maxBytes + 1 }],
  ] as const)("rejects %s", (code, patch) => {
    expect(codeOf({ ...good, ...patch } as ProbeResult)).toBe(code);
  });

  it("gives every rejection a reason and recovery action", () => {
    const r = validateProbe({ ...good, audio: null });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.reason.length).toBeGreaterThan(10);
      expect(r.error.action.length).toBeGreaterThan(10);
    }
  });

  it("warns, but accepts, HDR video", () => {
    const r = validateProbe({ ...good, video: { ...good.video!, hdr: true } });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(["HDR_VIDEO"]);
  });

  it("warns, but accepts, landscape video", () => {
    const r = validateProbe({ ...good, video: { ...good.video!, width: 1920, height: 1080 } });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(["NOT_VERTICAL"]);
  });
});

describe("validateFileBasics", () => {
  it("rejects empty files", () => {
    const r = validateFileBasics({ size: 0 });
    expect(!r.ok && r.error.code).toBe("FILE_EMPTY");
  });
});

import { describe, expect, it } from "vitest";
import { buildRunReport, toDeviceLogRow } from "@/lib/deviceReport";
import type { ProbeResult } from "@/lib/media/types";

const probe: ProbeResult = {
  fileSizeBytes: 31_457_280,
  mimeType: 'video/mp4; codecs="avc1"',
  durationSec: 32.04,
  video: { codec: "avc", width: 1080, height: 1920, rotation: 90, canDecode: true, hdr: true },
  audio: { codec: "aac", channels: 2, sampleRate: 48000, canDecode: true },
};

const report = buildRunReport({
  device: { model: "Pixel 7a", platform: "Android 16", browser: "Google Chrome 153", memoryGb: 8, cores: 8 },
  capabilities: {
    webCodecs: true,
    offscreenCanvas: true,
    canEncodeH264: true,
    canEncodeOpus: true,
    deviceMemoryGb: 8,
    cpuCores: 8,
    blockers: [],
    warnings: [],
  },
  probe,
  steps: { checkMs: 420, extractMs: 2100, audioKb: 128, transcribeMs: 3300, renderMs: 48_060, renderStorage: "disk", outputMb: 22.4 },
  problems: [],
  now: new Date("2026-10-25T10:00:00Z"),
});

describe("device report", () => {
  it("keeps only technical properties of the clip", () => {
    expect(report.clip).toEqual({
      durationSec: 32,
      resolution: "1080×1920",
      rotation: 90,
      videoCodec: "avc",
      audioCodec: "aac",
      sizeMb: 30,
      hdr: true,
    });
    // An allow-list by construction: nothing like a name, hash or transcript can be present.
    expect(Object.keys(report).sort()).toEqual(["capabilities", "clip", "date", "device", "problems", "reportVersion", "steps"]);
  });

  it("formats a DEVICE_LOG row with render speed relative to clip length", () => {
    expect(toDeviceLogRow(report)).toBe(
      "| 2026-10-25 | Pixel 7a, Android 16, 8 GB | Google Chrome 153 | 32 s 1080×1920 avc/aac HDR | OK, 0.4 s | 2.1 s, 128 KB | 3.3 s | 48.1 s (1.50× clip length), disk | OK |  |",
    );
  });

  it("marks missing steps and lists problems", () => {
    const row = toDeviceLogRow({ ...report, steps: {}, problems: ["RENDER: out of memory"] });
    expect(row).toContain("| — | — | — | RENDER: out of memory |");
  });
});

import type { DeviceReport as Capabilities } from "./media/capabilities";
import type { ProbeResult } from "./media/types";

/**
 * A privacy-safe summary of one lab run, for docs/DEVICE_LOG.md. It holds the
 * device, the clip's technical properties and step timings only: never the
 * file name, its content hash, audio or transcript text.
 */
export type RunReport = {
  reportVersion: 1;
  date: string;
  device: { model: string | null; platform: string | null; browser: string; memoryGb: number | null; cores: number | null };
  capabilities: { h264Encode: boolean; opusEncode: boolean } | null;
  clip: {
    durationSec: number;
    resolution: string;
    rotation: number;
    videoCodec: string | null;
    audioCodec: string | null;
    sizeMb: number;
    hdr: boolean;
  } | null;
  steps: {
    checkMs?: number;
    extractMs?: number;
    audioKb?: number;
    transcribeMs?: number;
    renderMs?: number;
    renderStorage?: "disk" | "memory";
    outputMb?: number;
  };
  /** Our own error codes and messages only. */
  problems: string[];
};

export type RunSteps = RunReport["steps"];

export type DeviceInfo = RunReport["device"];

export function buildRunReport(input: {
  device: DeviceInfo;
  capabilities: Capabilities | null;
  probe: ProbeResult | null;
  steps: RunSteps;
  problems: string[];
  now?: Date;
}): RunReport {
  const { probe } = input;
  return {
    reportVersion: 1,
    date: (input.now ?? new Date()).toISOString().slice(0, 10),
    device: input.device,
    capabilities: input.capabilities
      ? { h264Encode: input.capabilities.canEncodeH264, opusEncode: input.capabilities.canEncodeOpus }
      : null,
    clip:
      probe && probe.video
        ? {
            durationSec: round(probe.durationSec, 1),
            resolution: `${probe.video.width}×${probe.video.height}`,
            rotation: probe.video.rotation,
            videoCodec: probe.video.codec,
            audioCodec: probe.audio?.codec ?? null,
            sizeMb: round(probe.fileSizeBytes / 1024 / 1024, 1),
            hdr: probe.video.hdr,
          }
        : null,
    steps: input.steps,
    problems: input.problems,
  };
}

/** One row for the table in docs/DEVICE_LOG.md. */
export function toDeviceLogRow(r: RunReport): string {
  const s = r.steps;
  const device = [r.device.model ?? "unknown model", r.device.platform, r.device.memoryGb ? `${r.device.memoryGb} GB` : null]
    .filter(Boolean)
    .join(", ");
  const clip = r.clip
    ? `${r.clip.durationSec} s ${r.clip.resolution} ${r.clip.videoCodec}/${r.clip.audioCodec}${r.clip.hdr ? " HDR" : ""}`
    : "—";
  const ms = (v?: number) => (v === undefined ? "—" : `${(v / 1000).toFixed(1)} s`);
  const realtime =
    s.renderMs !== undefined && r.clip ? ` (${(s.renderMs / 1000 / r.clip.durationSec).toFixed(2)}× clip length)` : "";
  const cells = [
    r.date,
    device,
    r.device.browser,
    clip,
    r.clip ? `OK, ${ms(s.checkMs)}` : "—",
    s.extractMs === undefined ? "—" : `${ms(s.extractMs)}, ${s.audioKb} KB`,
    ms(s.transcribeMs),
    s.renderMs === undefined ? "—" : `${ms(s.renderMs)}${realtime}, ${s.renderStorage}`,
    r.problems.length ? r.problems.join("; ") : "OK",
    "",
  ];
  return `| ${cells.map((c) => c.replace(/\|/g, "/")).join(" | ")} |`;
}

/** Device model and OS version where the browser exposes them (Chromium's UA-CH); null elsewhere. */
export async function readDeviceInfo(): Promise<DeviceInfo> {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    userAgentData?: {
      brands: { brand: string; version: string }[];
      getHighEntropyValues(hints: string[]): Promise<{ model?: string; platform?: string; platformVersion?: string }>;
    };
  };
  let model: string | null = null;
  let platform: string | null = null;
  let browser = nav.userAgent;
  if (nav.userAgentData) {
    const hints = await nav.userAgentData.getHighEntropyValues(["model", "platformVersion"]).catch(() => null);
    model = hints?.model || null;
    platform = hints?.platform ? `${hints.platform} ${hints.platformVersion ?? ""}`.trim() : null;
    const brand = nav.userAgentData.brands.find((b) => !/Not.?A.?Brand|Chromium/i.test(b.brand)) ?? nav.userAgentData.brands[0];
    if (brand) browser = `${brand.brand} ${brand.version}`;
  }
  return {
    model,
    platform,
    browser,
    memoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    cores: nav.hardwareConcurrency || null,
  };
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

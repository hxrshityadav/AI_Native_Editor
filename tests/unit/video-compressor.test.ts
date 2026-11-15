import { afterEach, expect, it, vi } from "vitest";
import { BoundedVideoBytes } from "../../src/lib/videos/bounded-target";
import { validateVideoFile, validateVideoSource, videoSignature, videoPlan, videoOutputName, VIDEO_LIMITS, type VideoSettings, type VideoSource } from "../../src/lib/videos/policy";
import { videoSupport } from "../../src/lib/videos/engine";
import { canEncodeVideo, canEncodeAudio } from "mediabunny";
vi.mock("mediabunny", async original => ({ ...await original<typeof import("mediabunny")>(), canEncodeVideo: vi.fn(async () => true), canEncodeAudio: vi.fn(async () => true) }));
afterEach(() => { vi.clearAllMocks(); });
const source: VideoSource = { width: 1920, height: 1080, duration: 60, frameRate: 60, hasAudio: true, audioDecodable: true };
const settings: VideoSettings = { resolution: "720", quality: "balanced", mute: false, container: "mp4" };
it("enforces actual file size/MIME and container signatures independently of names", () => {
  for (const file of [{ size: 0, type: "video/mp4" }, { size: VIDEO_LIMITS.inputBytes+1, type: "video/mp4" }, { size: 30, type: "image/png" }]) expect(() => validateVideoFile(file)).toThrow();
  expect(() => validateVideoFile({ size: 100, type: "" })).not.toThrow();
  expect(videoSignature(Uint8Array.from([0,0,0,16,102,116,121,112,105,115,111,109]))).toBe("bmff");
  expect(videoSignature(Uint8Array.from([26,69,223,163]))).toBe("webm");
  expect(() => videoSignature(new Uint8Array(32))).toThrow(/contents/);
});
it("preserves the existing exact ten-minute policy and bounds decoded frame dimensions", () => {
  expect(() => validateVideoSource({ ...source, duration: 600 })).not.toThrow();
  for (const duration of [0, NaN, Infinity, 600.001]) expect(() => validateVideoSource({ ...source, duration })).toThrow();
  for (const [width,height] of [[5000,1000],[3840,3840],[2.5,100]]) expect(() => validateVideoSource({ ...source, width, height })).toThrow();
});
it("fits standard resolution boxes, portrait and 4:3 without upscaling", () => {
  expect(videoPlan(source, settings)).toMatchObject({ width: 1280, height: 720, frameRate: 30 });
  expect(videoPlan({ ...source, width: 1080, height: 1920 }, settings)).toMatchObject({ width: 720, height: 1280 });
  expect(videoPlan({ ...source, width: 1600, height: 1200 }, { ...settings, resolution: "1080" })).toMatchObject({ width: 1440, height: 1080 });
  expect(videoPlan({ ...source, width: 320, height: 180 }, { ...settings, resolution: "1080" })).toMatchObject({ width: 320, height: 180 });
});
it("keeps estimates distinct from targets, bounds bitrate, and only mutes explicitly", () => {
  const target = videoPlan(source, { ...settings, targetBytes: 2000000 });
  expect(target.estimatedBytes).toBeLessThanOrEqual(2000000); expect(target.audioBitrate).toBe(128000);
  expect(videoPlan(source, { ...settings, targetBytes: 1 }).targetWithinBudget).toBe(false);
  expect(videoPlan(source, { ...settings, mute: true }).audioBitrate).toBe(0);
  expect(() => videoPlan(source, { ...settings, bitrateKbps: -1 })).toThrow();
  expect(() => videoPlan(source, { ...settings, targetBytes: Infinity })).toThrow();
});
it("enforces encoded output memory before writes, including seeks and page boundaries", async () => {
  const bytes = new BoundedVideoBytes(1048580);
  bytes.write(new Uint8Array([1,2,3,4]),1048574); bytes.write(new Uint8Array([9]),1048575);
  const blob = bytes.blob("video/mp4"), data = new Uint8Array(await blob.arrayBuffer());
  expect(blob.type).toBe("video/mp4"); expect(data.slice(-4)).toEqual(new Uint8Array([1,9,3,4]));
  expect(() => bytes.write(new Uint8Array(5),1048576)).toThrow(/memory limit/);
  expect(() => bytes.write(new Uint8Array(1),-1)).toThrow();
  bytes.clear(); expect(bytes.blob("video/mp4").size).toBe(0); expect(blob.size).toBe(1048578);
});
it("checks concrete video/audio codecs and offers recovery instead of dropping audio", async () => {
  const info = { ...source, format: "video/mp4", videoCodec: "avc", audioCodec: "aac", notes: [] };
  vi.mocked(canEncodeVideo).mockResolvedValueOnce(false);
  expect((await videoSupport(info, settings)).mp4).toMatch(/No H.264/);
  vi.mocked(canEncodeAudio).mockResolvedValue(false);
  const support = await videoSupport(info, settings); expect(support.mp4).toMatch(/explicitly enable Mute/); expect(support.webm).toMatch(/Audio/);
  expect(await videoSupport(info, { ...settings, mute: true })).toEqual({ mp4: null, webm: null });
  vi.mocked(canEncodeAudio).mockResolvedValue(true);
});
it("uses an output extension matching the verified container", () => {
  expect(videoOutputName("phone.MOV", "mp4")).toBe("phone-compressed.mp4");
  expect(videoOutputName("../unsafe:name.webm", "webm")).not.toContain("/");
});

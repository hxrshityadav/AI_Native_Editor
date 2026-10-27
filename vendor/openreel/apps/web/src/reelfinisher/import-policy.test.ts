import { expect, it, vi } from "vitest";
import { MediaImportService } from "@openreel/core/media/media-import-service";
import type { MediaBunnyEngine } from "@openreel/core/media/mediabunny-engine";
import type { FFmpegFallback } from "@openreel/core/media/ffmpeg-fallback";

it.each([600, 600.001, NaN])("validates video duration %s before thumbnail/audio work", async (duration) => {
  const engine = { extractMetadata: vi.fn().mockResolvedValue({ hasVideo: true, hasAudio: false, canDecode: true, duration, width: 320, height: 180 }), generateThumbnails: vi.fn().mockResolvedValue([]), generateWaveform: vi.fn() };
  const service = new MediaImportService(engine as unknown as MediaBunnyEngine, {} as FFmpegFallback);
  vi.spyOn(service, "validateFormat").mockResolvedValue({ supported: true, format: "mp4" });
  const result = await service.importMedia(new File(["fixture"], "local.mp4", { type: "video/mp4" }));
  expect(result.success).toBe(duration === 600);
  if (duration !== 600) {
    expect(result.error).toMatch(/10 minutes/);
    expect(engine.generateThumbnails).not.toHaveBeenCalled();
    expect(engine.generateWaveform).not.toHaveBeenCalled();
  }
});

it("rejects an undecodable codec with recovery instead of silently accepting blank playback", async () => {
  const engine = { extractMetadata: vi.fn().mockResolvedValue({ hasVideo: true, hasAudio: true, canDecode: true, canDecodeVideo: false, duration: 4 }), generateThumbnails: vi.fn() };
  const service = new MediaImportService(engine as unknown as MediaBunnyEngine, {} as FFmpegFallback);
  vi.spyOn(service, "validateFormat").mockResolvedValue({ supported: true, format: "mp4" });
  const result = await service.importMedia(new File(["fixture"], "local.mp4", { type: "video/mp4" }));
  expect(result).toMatchObject({ success: false, error: expect.stringMatching(/Convert it locally/) });
  expect(engine.generateThumbnails).not.toHaveBeenCalled();
});

import { afterEach, expect, it, vi } from "vitest";
import { extractAudioWav } from "./extract-audio";

const mocks = vi.hoisted(() => ({ dispose: vi.fn(), config: vi.fn(), execute: vi.fn(), tracks: [{ id: 10, canDecode: vi.fn(async () => true) }, { id: 20, canDecode: vi.fn(async () => true) }] }));
vi.mock("./native-media-bridge", () => ({ nativeMediaAvailable: () => false, extractAudioWavViaNative: vi.fn(), NoAudioStreamError: class extends Error {} }));
vi.mock("mediabunny", () => ({
  ALL_FORMATS: [], BlobSource: class {}, WavOutputFormat: class {},
  Input: class { getAudioTracks = async () => mocks.tracks; dispose = mocks.dispose; },
  BufferTarget: class { buffer = new ArrayBuffer(4); }, Output: class {},
  Conversion: { init: async (config: unknown) => { mocks.config(config); return { isValid: true, execute: mocks.execute }; } },
}));
afterEach(() => { vi.clearAllMocks(); });

it("extracts the requested stream locally and discards video/other audio", async () => {
  const result = await extractAudioWav(new Blob(), 1);
  expect(result.type).toBe("audio/wav");
  const config = mocks.config.mock.calls[0][0];
  expect(config.video).toEqual({ discard: true });
  expect(config.audio(mocks.tracks[0])).toEqual({ discard: true });
  expect(config.audio(mocks.tracks[1])).toEqual({ codec: "pcm-s16", forceTranscode: true });
  expect(mocks.execute).toHaveBeenCalledOnce();
  expect(mocks.dispose).toHaveBeenCalledOnce();
});
it("rejects a missing recorded stream and releases the input", async () => {
  await expect(extractAudioWav(new Blob(), 3)).rejects.toThrow();
  expect(mocks.execute).not.toHaveBeenCalled();
  expect(mocks.dispose).toHaveBeenCalledOnce();
});

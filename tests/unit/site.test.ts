import { afterEach, expect, it, vi } from "vitest";
import { siteOrigin } from "../../src/lib/site";
import sitemap from "../../src/app/sitemap";
import robots from "../../src/app/robots";

afterEach(() => vi.unstubAllEnvs());

it("publishes only real information pages under the configured production origin", () => {
  vi.stubEnv("SITE_URL", "https://reel.example/");
  expect(siteOrigin()).toBe("https://reel.example");
  expect(sitemap().map(entry => entry.url)).toEqual(["https://reel.example/", "https://reel.example/privacy", "https://reel.example/supported-formats", "https://reel.example/tools", "https://reel.example/tools/image-compressor", "https://reel.example/tools/image-resizer", "https://reel.example/tools/image-converter", "https://reel.example/tools/video-compressor", "https://reel.example/tools/passport-photo", "https://reel.example/tools/heic-to-jpg", "https://reel.example/tools/background-remover", "https://reel.example/tools/trim-video", "https://reel.example/tools/remove-audio", "https://reel.example/tools/convert-to-mp4", "https://reel.example/tools/extract-audio", "https://reel.example/tools/audio-converter", "https://reel.example/tools/audio-cutter", "https://reel.example/tools/increase-volume", "https://reel.example/tools/video-to-gif", "https://reel.example/tools/compress-video-to-size", "https://reel.example/tools/audio-to-video", "https://reel.example/tools/text-to-speech", ...["noise-remover","vocal-remover","remove-music","transcribe-to-text","video-translator","ai-dubbing","text-to-video","image-to-video","shorts-maker","lecture-to-notes","pdf-to-audio"].map(slug=>`https://reel.example/tools/${slug}`)]);
  expect(robots().sitemap).toBe("https://reel.example/sitemap.xml");
});

it("does not invent public URLs when the deployment origin is unknown", () => {
  vi.stubEnv("SITE_URL", "");
  expect(siteOrigin()).toBeUndefined();
  expect(sitemap()).toEqual([]);
  expect(robots().sitemap).toBeUndefined();
});

it.each(["http://localhost:3000", "https://reel.example/path", "https://user:secret@reel.example", "https://reel.example/?test=1"])("rejects an invalid canonical origin", origin => {
  vi.stubEnv("SITE_URL", origin);
  expect(siteOrigin).toThrow(/HTTPS origin/);
});

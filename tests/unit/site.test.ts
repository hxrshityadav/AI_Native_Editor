import { afterEach, expect, it, vi } from "vitest";
import { siteOrigin } from "../../src/lib/site";
import sitemap from "../../src/app/sitemap";
import robots from "../../src/app/robots";

afterEach(() => vi.unstubAllEnvs());

it("publishes only real information pages under the configured production origin", () => {
  vi.stubEnv("SITE_URL", "https://reel.example/");
  expect(siteOrigin()).toBe("https://reel.example");
  expect(sitemap().map(entry => entry.url)).toEqual(["https://reel.example/", "https://reel.example/privacy", "https://reel.example/supported-formats", "https://reel.example/tools", "https://reel.example/tools/image-compressor", "https://reel.example/tools/image-resizer", "https://reel.example/tools/image-converter"]);
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

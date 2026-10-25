// End-to-end test for phone limits, simulated in Chromium: an encoder that stops at 1080p (common on
// Android) must not block 4K clips, and a failing WebCodecs audio decoder must not stop audio
// extraction. Simulations patch browser APIs before the page loads; they are not real-device results.
// Requires `npm run build`, ffmpeg and ffprobe. Run: npm run e2e

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "playwright";
import { frameEnergiesDb, speechRegions } from "../sync/syncMetrics.mjs";
import { createChecks, download, ff, makeFixtures, probe, ROOT, startServer, stopServer, streams } from "./helpers.mjs";

const OUT = join(ROOT, "tests/e2e/.out-phone");
const PORT = 3123;
const URL_ = `http://localhost:${PORT}/lab`;
const { check, finish } = createChecks();

/** Encoder capped at 1920×1080 pixels, as on many phones. */
const ENCODER_1080P = `{
  const original = VideoEncoder.isConfigSupported.bind(VideoEncoder);
  VideoEncoder.isConfigSupported = async (config) =>
    config.width * config.height > 1920 * 1080 ? { supported: false, config } : original(config);
}`;
/** WebCodecs audio decoding fails the way Android's platform decoder can. */
const AUDIO_DECODER_FAILS = `{
  const Original = AudioDecoder;
  window.AudioDecoder = class extends Original {
    constructor(init) { super(init); this.fail = init.error; }
    decode() { setTimeout(() => this.fail(new DOMException("Decoding error.", "EncodingError"))); }
  };
}`;
const WEB_AUDIO_FAILS = `{
  BaseAudioContext.prototype.decodeAudioData = () => Promise.reject(new DOMException("Unable to decode audio data", "EncodingError"));
}`;

async function openLab(browser, initScripts) {
  const context = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true });
  for (const script of initScripts) await context.addInitScript(script);
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  await page.goto(URL_);
  return { context, page };
}

async function main() {
  const f = makeFixtures(OUT);
  // Vertical 4K, short so the test stays quick.
  const k4 = f("vertical-4k.mp4");
  ff("-f", "lavfi", "-i", "testsrc2=s=2160x3840:r=30:d=3", "-f", "lavfi", "-i", "sine=frequency=300:sample_rate=48000:duration=3",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", k4);
  // Noise "phrases" at known times, to check the fallback keeps timing, not just length.
  const PHRASES = [[0.8, 1.9], [2.6, 3.4], [4.1, 5.6]];
  const phrases = f("phrases.mp4");
  ff("-f", "lavfi", "-i", "color=c=gray:s=360x640:r=30:d=6.5", "-f", "lavfi", "-i", "anoisesrc=d=6.5:c=pink:a=0.5:r=48000",
    "-af", `volume='if(${PHRASES.map(([a, b]) => `between(t,${a},${b})`).join("+")},1,0.003)':eval=frame`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", phrases);

  const server = await startServer(PORT);
  const browser = await chromium.launch();
  try {
    // ---------- 4K on a phone whose encoder stops at 1080p ----------
    const { context, page } = await openLab(browser, [ENCODER_1080P]);
    await page.getByTestId("file-input").setInputFiles(k4);
    await page.locator('[data-testid="check-ok"], [data-testid="check-error"]').first().waitFor({ timeout: 60_000 });
    check("4K clip is accepted on a phone that can't encode 4K", await page.getByTestId("check-ok").isVisible(),
      (await page.locator('[data-testid="check-ok"], [data-testid="check-error"]').first().innerText()).slice(0, 160));

    check("default export is 1080×1920 and allowed", (await page.getByTestId("export-size").innerText()).includes("1080×1920") &&
      (await page.getByTestId("render-button").isEnabled()));
    await page.locator("label", { has: page.getByTestId("preset-original") }).click();
    await page.getByTestId("encode-unsupported").waitFor({ timeout: 10_000 });
    check(
      "Original size (4K) is explained and blocked instead of failing mid-export",
      (await page.getByTestId("encode-unsupported").innerText()).includes("2160×3840") && (await page.getByTestId("render-button").isDisabled()),
    );
    await page.locator("label", { has: page.getByTestId("preset-reels") }).click();
    await page.getByTestId("encode-unsupported").waitFor({ state: "detached", timeout: 10_000 });
    await page.getByTestId("render-button").click();
    await page.locator('[data-testid="render-done"], [data-testid="render-error"]').first().waitFor({ timeout: 180_000 });
    const out = await download(page, "mp4-link", join(OUT, "from-4k.mp4"));
    const v = streams(probe(out), "video")[0];
    check("4K clip exports at 1080×1920", v.width === 1080 && v.height === 1920, `${v.width}×${v.height}`);
    await context.close();

    // ---------- WebCodecs audio decoder fails: extraction falls back to Web Audio ----------
    const fallback = await openLab(browser, [AUDIO_DECODER_FAILS]);
    await fallback.page.getByTestId("file-input").setInputFiles(phrases);
    await fallback.page.getByTestId("check-ok").waitFor({ timeout: 30_000 });
    await fallback.page.getByTestId("extract-button").click();
    await fallback.page.locator('[data-testid="extract-done"], [data-testid="extract-error"]').first().waitFor({ timeout: 60_000 });
    const done = await fallback.page.getByTestId("extract-done").isVisible();
    check("extraction succeeds through Web Audio when the WebCodecs decoder fails", done,
      done ? "" : await fallback.page.getByTestId("extract-error").innerText());
    if (done) {
      const bytes = await fallback.page.evaluate(async () => {
        const src = document.querySelector('[data-testid="extract-done"] audio').src;
        return Array.from(new Uint8Array(await (await fetch(src)).arrayBuffer()));
      });
      const ogg = join(OUT, "fallback.ogg");
      writeFileSync(ogg, Buffer.from(bytes));
      const info = probe(ogg);
      const a = streams(info, "audio")[0];
      const sourceSec = Number(probe(phrases).format.duration);
      check(
        "fallback audio is mono Opus, 48 kHz, full length",
        a.codec_name === "opus" && a.channels === 1 && Number(a.sample_rate) === 48000 && Math.abs(Number(info.format.duration) - sourceSec) < 0.15,
        `${a.codec_name} ${a.channels} ch ${a.sample_rate} Hz ${Number(info.format.duration).toFixed(2)} s vs ${sourceSec.toFixed(2)} s`,
      );
      const raw = execFileSync("ffmpeg", ["-v", "error", "-i", ogg, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"]);
      const { regions } = speechRegions(frameEnergiesDb(new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4), 16000));
      const drift = regions.map((r, i) => Math.round((r.start - PHRASES[i]?.[0]) * 1000));
      check("fallback audio keeps speech timing (phrase starts ±20 ms)", regions.length === PHRASES.length && drift.every((d) => Math.abs(d) <= 20), `drift ms: ${drift}`);
    }
    await fallback.context.close();

    // ---------- Both decoders fail: an honest, audio-specific error ----------
    const both = await openLab(browser, [AUDIO_DECODER_FAILS, WEB_AUDIO_FAILS]);
    await both.page.getByTestId("file-input").setInputFiles(f("vertical.mp4"));
    await both.page.getByTestId("check-ok").waitFor({ timeout: 30_000 });
    await both.page.getByTestId("extract-button").click();
    await both.page.getByTestId("extract-error").waitFor({ timeout: 60_000 });
    const text = await both.page.getByTestId("extract-error").innerText();
    check("when both fail: says it's the speech audio, no tab/4K advice", /speech audio/.test(text) && !/tabs|other apps|1080p|video processor/.test(text), text.replace(/\n+/g, " "));
    await both.context.close();
  } finally {
    await browser.close();
    stopServer(server);
  }
  finish();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

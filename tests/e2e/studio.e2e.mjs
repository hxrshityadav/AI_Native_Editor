// End-to-end test for /studio: the desktop three-pane flow and the phone step-by-step flow.
// Requires `npm run build` first, plus ffmpeg and ffprobe on PATH. Run: npm run e2e

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "playwright";
import { countPixels, createChecks, decodeErrors, download, ff, frameDiff, makeFixtures, probe, ROOT, startServer, stopServer, streams } from "./helpers.mjs";

const OUT = join(ROOT, "tests/e2e/.out-studio");
const PORT = 3115;
const URL_ = `http://localhost:${PORT}/studio`;
const { check, finish } = createChecks();

const WORDS = [
  { text: "namaste", start: 0.5, end: 1.2 },
  { text: "doston", start: 1.2, end: 1.9 },
  { text: "aaj", start: 2.0, end: 2.6 },
];

/** Opens the studio with a mocked transcription route; records what was uploaded. */
async function openStudio(browser, contextOptions) {
  const context = await browser.newContext({ ...contextOptions, acceptDownloads: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  const uploads = [];
  await page.route("**/api/transcribe", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { humanCheckSiteKey: null, provider: { name: "Groq", privacyUrl: "https://groq.com/privacy-policy/" }, romanizerName: "Groq" } });
    uploads.push(route.request().postDataBuffer());
    await route.fulfill({ json: { provider: { id: "groq", displayName: "Groq (mock)" }, words: WORDS, warning: null } });
  });
  await page.goto(URL_);
  return { context, page, uploads };
}

const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function main() {
  const f = makeFixtures(OUT);
  for (const seconds of [600, 601]) {
    ff("-f", "lavfi", "-i", `color=s=32x64:r=1:d=${seconds}`, "-f", "lavfi", "-i", `anullsrc=r=48000:cl=mono`,
      "-t", String(seconds), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", f(`duration-${seconds}.mp4`));
  }
  const server = await startServer(PORT);
  const browser = await chromium.launch();
  try {
    const missing = await browser.newContext();
    const missingPage = await missing.newPage();
    let unexpectedUploads = 0;
    missingPage.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/api/transcribe")) unexpectedUploads++;
    });
    await missingPage.goto(URL_);
    await missingPage.getByTestId("file-input").first().setInputFiles(f("vertical.mp4"));
    await missingPage.getByTestId("check-ok").waitFor();
    await missingPage.getByTestId("continue-captions").click();
    await missingPage.getByText("AI transcription & word editor", { exact: true }).evaluate((el) => { el.parentElement.open = true; });
    await missingPage.getByTestId("make-captions").click();
    await missingPage.getByTestId("transcribe-error").waitFor();
    const setup = await missingPage.getByTestId("transcribe-error").innerText();
    check("setup: missing key names GROQ_API_KEY and .env.local before extraction or upload",
      setup.includes("GROQ_API_KEY") && setup.includes(".env.local") && unexpectedUploads === 0 &&
      !(await missingPage.getByTestId("extract-progress").count()));
    await missing.close();

    const boundary = await openStudio(browser, { viewport: { width: 1440, height: 900 } });
    await boundary.page.getByTestId("file-input").first().setInputFiles(f("duration-600.mp4"));
    await boundary.page.getByTestId("check-ok").waitFor();
    await boundary.page.getByTestId("continue-captions").click();
    await boundary.page.getByText("AI transcription & word editor", { exact: true }).evaluate((el) => { el.parentElement.open = true; });
    await boundary.page.getByTestId("make-captions").click();
    await boundary.page.getByTestId("word").first().waitFor({ timeout: 120_000 });
    const multipart = boundary.uploads[0];
    const start = multipart.indexOf(Buffer.from("OggS"));
    let end = start;
    let granule = 0;
    while (multipart.toString("ascii", end, end + 4) === "OggS") {
      granule = Number(multipart.readBigInt64LE(end + 6));
      const count = multipart[end + 26];
      let length = 27 + count;
      for (let i = 0; i < count; i++) length += multipart[end + 27 + i];
      end += length;
    }
    const skip = multipart.readUInt16LE(start + 27 + multipart[start + 26] + 10);
    const audioSeconds = (granule - skip) / 48_000;
    writeFileSync(f("duration-600-speech.ogg"), multipart.subarray(start, end));
    check("duration: exact 600-second video produces audio within the API duration boundary", audioSeconds > 599.9 && audioSeconds <= 600, `${audioSeconds} s`);
    check("duration: corrected Opus end marker and checksum decode cleanly", decodeErrors(f("duration-600-speech.ogg")) === "");
    await boundary.context.close();

    // ---------- Desktop: three panes ----------
    const { context, page, uploads } = await openStudio(browser, { viewport: { width: 1440, height: 900 } });

    check("desktop: steps rail visible", await page.getByRole("navigation", { name: "Editor tools" }).isVisible());
    check(
      "desktop: later steps locked until a video is picked",
      (await page.getByTestId("nav-captions").getAttribute("aria-disabled")) === "true" &&
        (await page.getByTestId("next-button").isDisabled()),
    );

    await page.getByTestId("file-input").first().setInputFiles(f("garbage.mp4"));
    await page.getByTestId("check-error").waitFor({ timeout: 30_000 });
    check("desktop: unreadable file rejected with a reason and a way out", (await page.getByText("Choose another video").isVisible()));

    await page.getByTestId("file-input").first().setInputFiles(f("vertical.mp4"));
    await page.getByTestId("check-ok").waitFor({ timeout: 30_000 });
    check("desktop: video step shows the clip in the rail", (await page.getByTestId("nav-video").innerText()).includes("720×1280"));

    await page.getByTestId("file-input").first().setInputFiles(f("duration-600.mp4"));
    await page.getByTestId("check-ok").waitFor({ timeout: 30_000 });
    check("duration: exactly 600 seconds accepted", await page.getByTestId("continue-captions").isEnabled());
    await page.getByTestId("file-input").first().setInputFiles(f("duration-601.mp4"));
    await page.getByTestId("check-error").waitFor({ timeout: 30_000 });
    check("duration: valid to invalid clears preview and locks processing", (await page.getByTestId("check-error").innerText()).includes("10 minutes") &&
      await page.getByTestId("next-button").isDisabled() &&
      (await page.getByTestId("nav-captions").getAttribute("aria-disabled")) === "true" &&
      (await page.getByTestId("nav-export").getAttribute("aria-disabled")) === "true" && uploads.length === 0);
    await page.screenshot({ path: f("desktop-duration-error.png"), fullPage: true });
    await page.getByTestId("file-input").first().setInputFiles(f("vertical.mp4"));
    await page.getByTestId("check-ok").waitFor({ timeout: 30_000 });
    check("duration: invalid to valid permits continuing", await page.getByTestId("continue-captions").isEnabled());

    await page.getByTestId("continue-captions").click();
    await page.getByText("AI transcription & word editor", { exact: true }).evaluate((el) => { el.parentElement.open = true; });
    check("desktop: full disclosure shown before anything is sent", await page.getByTestId("transcribe-disclosure").isVisible());
    check("desktop: export accepts video-only edits", (await page.getByTestId("nav-export").getAttribute("aria-disabled")) === "false");
    await page.getByTestId("make-captions").click();
    await page.getByTestId("word").first().waitFor({ timeout: 60_000 });
    check(
      "desktop: one click extracts locally, then uploads only Ogg Opus speech audio, as Hinglish",
      uploads.length === 1 &&
        uploads[0].includes(Buffer.from("OpusHead")) &&
        uploads[0].length < 60_000 &&
        /name="language"\r\n\r\nhinglish/.test(uploads[0].toString("latin1")),
      `${uploads[0]?.length} B`,
    );
    check("desktop: disclosure folds away after captions are made", !(await page.getByTestId("transcribe-disclosure").isVisible()));
    check("desktop: rail shows the word count", (await page.getByTestId("nav-captions").innerText()).includes("3 words"));

    await page.getByTestId("word").nth(0).click();
    await page.getByTestId("word-text").fill("Namaste");
    await page.getByTestId("word-text").press("Enter");
    check("desktop: word edited", (await page.getByTestId("word").nth(0).innerText()) === "Namaste");

    await page.getByTestId("next-button").click();
    await page.locator("label", { has: page.getByTestId("style-boxed") }).click();
    check("desktop: style chosen", (await page.getByTestId("nav-style").innerText()).includes("Boxed"));

    await page.getByTestId("next-button").click();
    await page.getByTestId("render-button").click();
    await page.getByTestId("render-done").waitFor({ timeout: 120_000 });
    const mp4 = await download(page, "mp4-link", f("studio-out.mp4"));
    const info = probe(mp4);
    const v = streams(info, "video")[0];
    check(
      "desktop: export is H.264 720×1280 with the original AAC audio",
      v?.codec_name === "h264" && v?.width === 720 && v?.height === 1280 && streams(info, "audio")[0]?.codec_name === "aac",
    );
    const band = frameDiff(f("vertical.mp4"), mp4, 1.0, 720, 1280, 0.7, 0.78);
    check("desktop: Boxed captions burned in", band > 15, `Δ${band.toFixed(2)}`);
    const srt = readFileSync(await download(page, "srt-link", f("studio-out.srt")), "utf8");
    check("desktop: SRT has the edited words", srt.includes("Namaste doston"));

    await page.getByTestId("save-status").count(); // draft is saved by now (debounced write long past)
    await page.reload();
    await page.getByTestId("file-input").first().setInputFiles(f("vertical.mp4"));
    await page.getByTestId("check-ok").waitFor({ timeout: 30_000 });
    await page.getByTestId("continue-captions").click();
    await page.getByText("AI transcription & word editor", { exact: true }).evaluate((el) => { el.parentElement.open = true; });
    await page.getByTestId("save-status").filter({ hasText: "Restored" }).waitFor({ timeout: 10_000 });
    check(
      "desktop: reopening the same video restores captions and edits without uploading",
      (await page.getByTestId("word").nth(0).innerText()) === "Namaste" && uploads.length === 1,
    );
    check("desktop: no sideways scroll", await noSideScroll(page));

    // ---------- Export presets ----------
    /** Picks a clip, makes captions, opens Export, applies the choices, renders; returns the ffprobe video stream. */
    async function exportWith(file, choices, out) {
      await page.getByTestId("nav-video").click(); // as a user would: back to Video, "Use a different video"
      await page.getByTestId("file-input").first().setInputFiles(f(file));
      await page.getByTestId("check-ok").waitFor({ timeout: 30_000 });
      await page.getByTestId("continue-captions").click();
    await page.getByText("AI transcription & word editor", { exact: true }).evaluate((el) => { el.parentElement.open = true; });
      if (!(await page.getByTestId("word").first().isVisible())) {
        await page.getByTestId("make-captions").click();
        await page.getByTestId("word").first().waitFor({ timeout: 60_000 });
      }
      await page.getByTestId("nav-export").click();
      for (const id of choices) await page.locator("label", { has: page.getByTestId(id) }).click();
      const shown = (await page.getByTestId("export-size").innerText()).match(/(\d+)×(\d+)/).slice(1).join("x");
      const framed = await page.getByTestId("preview-frame").getAttribute("data-frame");
      await page.getByTestId("render-button").click();
      await page.getByTestId("render-done").waitFor({ timeout: 120_000 });
      const path = await download(page, "mp4-link", f(out));
      const v = streams(probe(path), "video")[0];
      return { shown, framed, actual: `${v.width}x${v.height}`, path };
    }

    const fill = await exportWith("landscape.mp4", ["preset-reels", "framing-fill"], "preset-fill.mp4");
    check("preset: landscape Fill crops to 9:16 without upscaling", fill.actual === "404x720" && fill.shown === "404x720", JSON.stringify(fill));
    check("preset: preview frame matches the export", fill.framed === fill.actual, fill.framed);

    const fit = await exportWith("landscape.mp4", ["preset-reels", "framing-fit"], "preset-fit.mp4");
    const nearBlack = (r, g, b) => r < 24 && g < 24 && b < 24;
    const topBlack = countPixels(fit.path, 1.0, 1080, 1920, 0.05, 0.2, nearBlack) / (1080 * 1920 * 0.15);
    const middleBlack = countPixels(fit.path, 1.0, 1080, 1920, 0.45, 0.55, nearBlack) / (1080 * 1920 * 0.1);
    check(
      "preset: landscape Fit is 1080×1920 with bars above and the video in the middle",
      fit.actual === "1080x1920" && fit.framed === "1080x1920" && topBlack > 0.95 && middleBlack < 0.05,
      `bars ${(topBlack * 100).toFixed(0)}% black, middle ${(middleBlack * 100).toFixed(0)}% black`,
    );

    const original = await exportWith("landscape.mp4", ["preset-original"], "preset-original.mp4");
    check(
      "preset: Original keeps 1280×720 and asks no framing question",
      original.actual === "1280x720" && !(await page.getByTestId("framing-fill").count()),
    );

    const small = await exportWith("vertical-1080.mp4", ["preset-small"], "preset-small.mp4");
    check("preset: Smaller file brings 1080×1920 down to 720×1280", small.actual === "720x1280" && small.shown === "720x1280", small.actual);
    await context.close();

    const retry = await openStudio(browser, { viewport: { width: 1440, height: 900 } });
    let submissions = 0;
    let respondEmpty = false;
    await retry.page.route("**/api/transcribe", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      submissions++;
      await new Promise((r) => setTimeout(r, 700));
      if (submissions === 1) return route.fulfill({ status: 504, json: { error: { code: "PROVIDER_TIMEOUT", message: "Transcription took too long.", action: "Try again." } } });
      return route.fulfill({ json: { provider: { id: "groq", displayName: "Groq (mock)" }, words: respondEmpty ? [] : WORDS, warning: null } });
    });
    await retry.page.getByTestId("file-input").first().setInputFiles(f("vertical.mp4"));
    await retry.page.getByTestId("check-ok").waitFor();
    await retry.page.getByTestId("continue-captions").click();
    await retry.page.getByText("AI transcription & word editor", { exact: true }).evaluate((el) => { el.parentElement.open = true; });
    await retry.page.getByTestId("make-captions").evaluate((button) => { button.click(); button.click(); });
    await retry.page.getByTestId("transcribe-error").waitFor({ timeout: 60_000 });
    check("transcription: duplicate clicks send only one request and timeout has recovery", submissions === 1 &&
      (await retry.page.getByTestId("transcribe-error").innerText()).includes("Try again"));
    await retry.page.getByTestId("make-captions").click();
    await retry.page.getByTestId("word").first().waitFor();
    check("transcription: retry succeeds after timeout", submissions === 2);
    respondEmpty = true;
    await retry.page.getByTestId("make-captions").click();
    await retry.page.getByTestId("no-speech").waitFor();
    check("transcription: empty result shows no speech and retains video-only export", (await retry.page.getByTestId("nav-export").getAttribute("aria-disabled")) === "false");
    await retry.context.close();

    // ---------- Phone: step by step ----------
    const phone = await openStudio(browser, devices["Pixel 7"]);
    const p = phone.page;
    const title = () => p.getByTestId("mobile-step-title").innerText();
    check("phone: tool selector and heading shown", (await p.getByRole("navigation", { name: "Editor tools" }).isVisible()) && (await title()) === "Video");
    await p.getByTestId("file-input").first().setInputFiles(f("vertical.mp4"));
    await p.getByTestId("check-ok").waitFor({ timeout: 30_000 });
    await p.getByTestId("next-button").click();
    check("phone: Next goes to Captions", (await title()) === "Captions");
    await p.getByText("AI transcription & word editor", { exact: true }).evaluate((el) => { el.parentElement.open = true; });
    await p.getByTestId("make-captions").click();
    await p.getByTestId("word").first().waitFor({ timeout: 60_000 });
    await p.getByTestId("word").first().scrollIntoViewIfNeeded();
    check("phone: word editor reachable under the preview", await p.getByTestId("word").first().isVisible());
    await p.getByTestId("back-button").click();
    check("phone: Back returns to Video", (await title()) === "Video");
    await p.getByTestId("next-button").click();
    await p.getByTestId("next-button").click();
    await p.getByTestId("next-button").click();
    check("phone: reaches Export", (await title()) === "Export");
    await p.getByTestId("render-button").click();
    await p.getByTestId("render-done").waitFor({ timeout: 120_000 });
    const phoneMp4 = probe(await download(p, "mp4-link", f("studio-phone.mp4")));
    check("phone: export works", streams(phoneMp4, "video")[0]?.codec_name === "h264");
    const nav = await Promise.all(["back-button", "render-button", "mp4-link"].map((id) => p.getByTestId(id).boundingBox()));
    check("phone: main buttons are at least 40 px tall", nav.every((b) => b && b.height >= 40), nav.map((b) => b?.height.toFixed(0)).join(", "));
    check("phone: no sideways scroll", await noSideScroll(p));
    await p.screenshot({ path: f("phone-export.png"), fullPage: true });
    await p.getByTestId("back-button").click();
    await p.getByTestId("back-button").click();
    await p.getByTestId("back-button").click();
    await p.getByTestId("file-input").first().setInputFiles(f("duration-601.mp4"));
    await p.getByTestId("check-error").waitFor();
    check("phone: long video rejected with Next disabled", await p.getByTestId("next-button").isDisabled() && await noSideScroll(p));
    await p.screenshot({ path: f("phone-duration-error.png"), fullPage: true });
    await phone.context.close();
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

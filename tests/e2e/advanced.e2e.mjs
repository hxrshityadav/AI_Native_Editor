// Composition, uploaded fonts, deterministic effects, overlays, and non-destructive pause cuts.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "playwright";
import { countPixels, createChecks, decodeErrors, download, ff, probe, ROOT, startServer, stopServer, streams } from "./helpers.mjs";
import { frameEnergiesDb, speechRegions } from "../sync/syncMetrics.mjs";

const OUT = join(ROOT, "tests/e2e/.out-advanced");
const PORT = 3127;
const { check, finish } = createChecks();
const words = [{ text: "Your", start: 0.6, end: 1 }, { text: "story", start: 1, end: 1.4 }, { text: "नमस्ते", start: 3.6, end: 4 }, { text: "world", start: 4, end: 4.4 }];

async function open(browser, options = {}) {
  const context = await browser.newContext({ ...options, acceptDownloads: true });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.log("PAGE ERROR", error.message));
  await page.route("**/api/transcribe", (route) => route.fulfill({ json: route.request().method() === "GET"
    ? { humanCheckSiteKey: null, provider: { name: "Groq", privacyUrl: "https://groq.com/privacy-policy/" }, romanizerName: "Groq" }
    : { provider: { id: "groq", displayName: "Groq (mock)" }, words, warning: null } }));
  await page.goto(`http://localhost:${PORT}/studio-legacy`);
  return { context, page };
}
async function render(page, name) {
  await page.getByTestId("nav-export").click();
  await page.getByTestId("render-button").click();
  await page.locator('[data-testid="render-done"], [data-testid="render-error"]').first().waitFor({ timeout: 120_000 });
  if (await page.getByTestId("render-error").isVisible()) throw new Error(await page.getByTestId("render-error").innerText());
  return download(page, "mp4-link", join(OUT, name));
}
async function setRange(page, label, value) {
  await page.getByRole("slider", { name: label, exact: true }).fill(String(value));
}
async function samplePreview(page, time, path) {
  await page.locator("video").evaluate(async (video, time) => {
    video.pause();
    await new Promise((resolve) => { video.addEventListener("seeked", resolve, { once: true }); video.currentTime = time; });
  }, time);
  await page.waitForTimeout(100);
  const png = await page.getByTestId("preview-frame").locator("canvas").evaluate((canvas) => canvas.toDataURL());
  writeFileSync(path, Buffer.from(png.split(",")[1], "base64"));
}
function previewDifference(png, mp4, time) {
  const image = execFileSync("ffmpeg", ["-v", "error", "-i", png, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 64 << 20 });
  const video = execFileSync("ffmpeg", ["-v", "error", "-ss", String(time), "-i", mp4, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 64 << 20 });
  if (image.length !== video.length) return Infinity;
  let sum = 0; for (let i = 0; i < image.length; i++) sum += Math.abs(image[i] - video[i]);
  return sum / image.length;
}
async function main() {
  mkdirSync(OUT, { recursive: true });
  const source = join(OUT, "studio-source.mp4");
  ff("-f", "lavfi", "-i", "color=c=red:s=640x360:r=30:d=6,drawbox=x=320:y=0:w=320:h=360:c=blue:t=fill",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=6",
    "-af", "volume='if(between(t,0.5,1.5)+between(t,3.5,4.5),1,0)':eval=frame",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", source);
  const server = await startServer(PORT);
  const browser = await chromium.launch(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {});
  console.log(`Advanced suite browser: ${process.env.E2E_CHANNEL ?? "Playwright Chromium"}`);
  try {
    const { context, page } = await open(browser, { viewport: { width: 1440, height: 900 } });
    await page.getByTestId("file-input").first().setInputFiles(source);
    await page.getByTestId("check-ok").waitFor();
    await page.getByLabel("Aspect ratio", { exact: true }).selectOption("1:1");
    await page.getByTestId("continue-captions").click();
    await page.getByText("AI transcription & word editor", { exact: true }).evaluate((el) => { el.parentElement.open = true; });
    await page.getByText("AI transcription & word editor", { exact: true }).evaluate((el) => { el.parentElement.open = true; });
    await page.getByTestId("make-captions").click();
    await page.getByTestId("word").first().waitFor({ timeout: 60_000 });
    for (const ratio of ["9:16", "16:9", "1:1", "4:3"]) {
      await page.getByTestId("nav-video").click();
      await page.getByLabel("Aspect ratio", { exact: true }).selectOption(ratio);
      const output = await render(page, `ratio-${ratio.replace(":", "-")}.mp4`);
      const video = streams(probe(output), "video")[0];
      const [a, b] = ratio.split(":").map(Number);
      check(`composition: ${ratio} MP4 and preview dimensions agree`, Math.abs(video.width / video.height - a / b) < 0.01 &&
        (await page.getByTestId("preview-frame").getAttribute("data-frame")) === `${video.width}x${video.height}`);
      check(`composition: ${ratio} decodes cleanly`, decodeErrors(output) === "");
    }
    await page.getByTestId("nav-video").click();
    await page.getByLabel("Aspect ratio", { exact: true }).selectOption("1:1");
    check("export: changing composition invalidates the previous downloadable render", !(await page.getByTestId("nav-export").innerText()).includes("Ready to download"));
    await setRange(page, "Horizontal crop position", 0);
    const left = await render(page, "crop-left.mp4");
    await page.getByTestId("nav-video").click();
    await setRange(page, "Horizontal crop position", 1);
    const right = await render(page, "crop-right.mp4");
    const red = (r, g, b) => r > 180 && g < 70 && b < 70;
    check("composition: crop position changes the actual source region", countPixels(left, 2, 360, 360, 0, 0.5, red) > countPixels(right, 2, 360, 360, 0, 0.5, red) + 10_000);

    await page.getByTestId("nav-video").click();
    await setRange(page, "Horizontal crop position", 0.5);
    await page.getByLabel("Composition framing").selectOption("fit");
    await page.getByLabel("Letterbox color").fill("#00ff00");
    const fit = await render(page, "fit-green.mp4");
    check("composition: Fit uses the chosen letterbox color", countPixels(fit, 2, 640, 640, 0, 0.15, (r, g, b) => g > 180 && r < 50 && b < 50) > 50_000);
    await page.getByTestId("nav-style").click();
    await page.getByText("Professional presets", { exact: true }).click();
    await page.getByRole("button", { name: "Editorial", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept("Studio favorite"));
    await page.getByRole("button", { name: "Save current subtitle preset", exact: true }).click();
    await page.getByRole("button", { name: "Bold Creator", exact: true }).click();
    await page.getByRole("button", { name: "Studio favorite", exact: true }).click();
    check("presets: a saved custom preset reapplies styling without resetting composition", await page.getByLabel("Font weight", { exact: true }).inputValue() === "600" &&
      await page.getByTestId("preview-frame").getAttribute("data-frame") === "640x640");
    await page.locator("label", { has: page.getByTestId("style-clean") }).click();
    const upload = page.getByLabel("Upload font", { exact: true });
    await upload.setInputFiles({ name: "broken.ttf", mimeType: "font/ttf", buffer: Buffer.from("not a font") });
    await page.getByRole("alert").filter({ hasText: "couldn't parse" }).waitFor();
    check("fonts: malformed font is rejected with recovery", true);
    await upload.setInputFiles(join(ROOT, "public/fonts/catalog/notoserif/font.ttf"));
    await page.getByRole("button", { name: "Apply uploaded font" }).click();
    await page.getByLabel("Text color", { exact: true }).fill("#ff00ff");
    await setRange(page, "Caption vertical position", 0.35);
    await page.getByRole("checkbox", { name: "Show safe areas and drag captions on the preview" }).check();
    const box = await page.getByTestId("preview-frame").boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.35);
    await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.51, box.y + box.height * 0.51); await page.mouse.up();
    check("placement: drag snaps normalized caption position to center", Number(await page.getByRole("slider", { name: "Caption horizontal position", exact: true }).inputValue()) === 0.5);
    await page.getByRole("checkbox", { name: "Show safe areas and drag captions on the preview" }).uncheck();
    await page.getByText("Subtitle animations", { exact: true }).click();
    await page.getByRole("button", { name: "Word pop", exact: true }).click();
    const png = join(OUT, "preview-custom-font.png");
    await samplePreview(page, 0.7, png);
    const custom = await render(page, "custom-font.mp4");
    const difference = previewDifference(png, custom, 0.7);
    check("fonts/animation: uploaded font and Word Pop match preview/export pixels", difference < 8, `mean RGB delta ${difference.toFixed(2)}`);
    check("fonts: uploaded face is used in the export (magenta caption pixels)", countPixels(custom, 0.7, 640, 640, 0.35, 0.65, (r, g, b) => r > 150 && g < 100 && b > 150) > 50);
    for (const effect of ["No animation", "Fade in", "Slide up", "Scale in", "Bounce", "Typewriter", "Word reveal"]) {
      await page.getByTestId("nav-style").click();
      await page.getByText("Subtitle animations", { exact: true }).click();
      await page.getByRole("button", { name: effect, exact: true }).click();
      const still = join(OUT, `preview-${effect.replaceAll(" ", "-")}.png`);
      await samplePreview(page, 0.73, still);
      const animationOutput = await render(page, `effect-${effect.replaceAll(" ", "-")}.mp4`);
      const delta = previewDifference(still, animationOutput, 0.73);
      check(`animation: ${effect} matches exported pixels`, delta < 8, `mean RGB delta ${delta.toFixed(2)}`);
    }
    await page.getByTestId("nav-style").click();
    await page.getByText("Subtitle animations", { exact: true }).click();
    await page.getByRole("button", { name: "Word pop", exact: true }).click();
    // A custom font parser accepts native WOFF2 as well as the tested TTF face.
    await upload.setInputFiles(join(ROOT, "public/fonts/poppins/poppins-latin-700-normal.woff2"));
    await page.getByRole("button", { name: "Apply uploaded font" }).click();
    const woff = await render(page, "uploaded-woff2.mp4");
    check("fonts: a user-uploaded WOFF2 face renders into a decodable MP4", decodeErrors(woff) === "");
    await page.getByTestId("nav-style").click();
    await page.getByTestId("nav-text").click();
    await page.getByRole("button", { name: "Add title", exact: true }).click();
    await page.getByLabel("Title 1 text").fill("REAL TITLE");
    await page.getByLabel("Title 1 color").fill("#00ffff");
    const titled = await render(page, "title.mp4");
    check("overlays: title is burned into the MP4", countPixels(titled, 0.7, 640, 640, 0.1, 0.4, (r, g, b) => r < 100 && g > 150 && b > 150) > 50);
    await page.getByTestId("nav-captions").click();
    await page.getByTestId("nav-silence").click();
    await page.getByRole("button", { name: "Analyze pauses locally" }).click();
    await page.getByRole("status").filter({ hasText: "pause candidates" }).waitFor({ timeout: 60_000 });
    const candidates = await page.getByRole("checkbox", { name: /Remove pause/ }).count();
    check("silence: actual decoded audio produces reviewable pause candidates", candidates >= 2, `${candidates} intervals`);
    const applied = [];
    for (let i = 1; i <= candidates; i++) applied.push({ start: Number(await page.getByLabel(`Pause ${i} start`, { exact: true }).inputValue()), end: Number(await page.getByLabel(`Pause ${i} end`, { exact: true }).inputValue()) });
    await page.getByRole("button", { name: "Preview proposed cuts without applying", exact: true }).click();
    await page.getByLabel("Output playhead", { exact: true }).fill(((applied[0].start + applied[0].end) / 2).toFixed(2)); await page.waitForTimeout(200);
    check("silence: proposed cuts skip in preview before applying", await page.locator("video").evaluate((video, end) => video.currentTime >= end - 0.03, applied[0].end));
    const previewOnly = await render(page, "proposals-not-applied.mp4");
    check("silence: previewing proposals leaves export unchanged", Math.abs(Number(probe(previewOnly).format.duration) - 6) < 0.1);
    await page.getByTestId("nav-silence").click();
    await page.getByTestId("apply-cuts").click();
    const cutOutput = await render(page, "cut.mp4");
    const cutInfo = probe(cutOutput);
    const videoDuration = Number(streams(cutInfo, "video")[0].duration);
    const audioDuration = Number(streams(cutInfo, "audio")[0].duration);
    check("silence: edited duration shortens and audio/video remain synchronized", videoDuration < 4.5 && videoDuration > 2 && Math.abs(videoDuration - audioDuration) < 0.08,
      `video ${videoDuration}, audio ${audioDuration}`);
    check("silence: every edited frame and audio sample decodes cleanly", decodeErrors(cutOutput) === "");
    const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", cutOutput, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], { maxBuffer: 64 << 20 });
    const decoded = new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
    const { regions } = speechRegions(frameEnergiesDb(decoded, 16000));
    const mapped = (time) => time - applied.reduce((removed, cut) => removed + Math.max(0, Math.min(time, cut.end) - cut.start), 0);
    const expected = [0.5, 3.5].map(mapped);
    check("silence: decoded audio phrase onsets follow the edit mapping within 50 ms", regions.length === 2 && regions.every((region, i) => Math.abs(region.start - expected[i]) < 0.05),
      `onsets ${regions.map((r) => r.start).join(", ")}, expected ${expected.join(", ")}`);
    const srt = readFileSync(await download(page, "srt-link", join(OUT, "cut.srt")), "utf8");
    check("silence: SRT has remapped Hindi/English captions", srt.includes("नमस्ते") && !srt.includes("00:00:03,600"));
    await page.getByRole("button", { name: "Undo settings" }).click();
    const undone = await render(page, "undo-cuts.mp4");
    check("timeline: Undo restores original duration", Math.abs(Number(probe(undone).format.duration) - 6) < 0.1);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await page.getByTestId("nav-style").click();
    await page.screenshot({ path: join(OUT, "desktop-studio.png"), fullPage: true });
    await page.waitForTimeout(600);
    await page.reload();
    await page.getByTestId("file-input").first().setInputFiles(source);
    await page.getByTestId("check-ok").waitFor();
    await page.getByTestId("continue-captions").click();
    await page.getByText("AI transcription & word editor", { exact: true }).evaluate((el) => { el.parentElement.open = true; });
    await page.getByTestId("save-status").filter({ hasText: "Restored" }).waitFor();
    await page.getByTestId("nav-style").click();
    await page.getByText("Subtitle animations", { exact: true }).click();
    check("persistence: selected animation survives reload", await page.getByRole("button", { name: "Word pop", exact: true }).getAttribute("aria-pressed") === "true");
    await page.getByText("Professional presets", { exact: true }).click();
    check("persistence: custom subtitle preset survives reload", await page.getByRole("button", { name: "Studio favorite", exact: true }).count() === 1);
    check("persistence: uploaded font selection is restored", (await page.getByRole("button").filter({ hasText: "poppins-latin-700-normal" }).first().getAttribute("aria-pressed")) === "true");
    await page.getByTestId("nav-text").click();
    check("persistence: title text is restored", await page.getByLabel("Title 1 text").inputValue() === "REAL TITLE");
    await page.getByTestId("nav-video").click();
    check("persistence: composition ratio and letterbox color are restored", await page.getByLabel("Aspect ratio", { exact: true }).inputValue() === "1:1" && await page.getByLabel("Letterbox color").inputValue() === "#00ff00");
    const restoredCut = await render(page, "restored-cuts.mp4");
    check("persistence: restored cuts drive the exported timeline", Math.abs(Number(probe(restoredCut).format.duration) - Number(cutInfo.format.duration)) < 0.08);
    await page.getByTestId("nav-style").click();
    const localCard = page.getByRole("listitem").filter({ hasText: "poppins-latin-700-normal" });
    page.once("dialog", (dialog) => dialog.accept("My uploaded font"));
    await localCard.getByRole("button", { name: "Rename", exact: true }).click();
    await page.getByRole("listitem").filter({ hasText: "My uploaded font" }).waitFor();
    await page.getByLabel("Search fonts", { exact: true }).fill("My uploaded font");
    const favorite = page.getByRole("button", { name: "Favorite My uploaded font", exact: true });
    await favorite.click();
    check("fonts: uploaded font can be renamed, searched, and favorited", await favorite.getAttribute("aria-pressed") === "true" && await page.getByRole("list", { name: "Font choices" }).getByRole("listitem").count() === 1);
    const beforeRemoval = await page.evaluate(() => [...document.fonts].filter((font) => font.family.startsWith("RF-local")).length);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("listitem").getByRole("button", { name: "Remove", exact: true }).click();
    await page.getByText("No matching fonts. Clear the search or change category.").waitFor();
    check("fonts: removal clears the stored face and reports no matching fonts", await page.getByRole("list", { name: "Font choices" }).getByRole("listitem").count() === 0 &&
      await page.evaluate(() => [...document.fonts].filter((font) => font.family.startsWith("RF-local")).length) === beforeRemoval - 1);
    await context.close();

    const mobile = await open(browser, devices["Pixel 7"]);
    await mobile.page.getByTestId("file-input").first().setInputFiles(source);
    await mobile.page.getByTestId("check-ok").waitFor();
    await mobile.page.getByLabel("Aspect ratio", { exact: true }).selectOption("16:9");
    await mobile.page.getByTestId("next-button").click();
    await mobile.page.getByText("AI transcription & word editor", { exact: true }).evaluate((el) => { el.parentElement.open = true; });
    await mobile.page.getByTestId("make-captions").click();
    await mobile.page.getByTestId("word").first().waitFor();
    await mobile.page.getByTestId("next-button").click();
    check("mobile: typography controls remain accessible without horizontal overflow", await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await mobile.page.screenshot({ path: join(OUT, "mobile-studio.png"), fullPage: true });
    await mobile.context.close();
  } finally { await browser.close(); stopServer(server); }
  finish();
}
main().catch((error) => { console.error(error); process.exit(1); });

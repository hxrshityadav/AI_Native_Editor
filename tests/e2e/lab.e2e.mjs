// End-to-end test for /lab against real ffmpeg-generated fixtures.
// Requires `npm run build` first, plus ffmpeg and ffprobe on PATH.
// Run: npm run e2e

import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const ROOT = new URL("../..", import.meta.url).pathname;
const OUT = join(ROOT, "tests/e2e/.out");
const PORT = 3107;
const BASE = `http://localhost:${PORT}`;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

// ---------- fixtures ----------

function ff(...args) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
}

function probe(file) {
  return JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]).toString(),
  );
}

function makeFixtures() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const f = (name) => join(OUT, name);
  const bg = "color=c=0x2a4d69:s=720x1280:r=30:d=4";
  const tone = "sine=frequency=440:sample_rate=48000:duration=4";

  ff("-f", "lavfi", "-i", bg, "-f", "lavfi", "-i", tone, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", f("vertical.mp4"));
  ff("-f", "lavfi", "-i", "color=c=0x2a4d69:s=1280x720:r=30:d=3", "-f", "lavfi", "-i", tone, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", f("landscape.mp4"));
  ff("-display_rotation", "90", "-i", f("landscape.mp4"), "-c", "copy", f("rotated.mp4"));
  ff("-f", "lavfi", "-i", "color=c=0x2a4d69:s=540x960:r=30:d=3", "-f", "lavfi", "-i", tone, "-c:v", "libvpx-vp9", "-b:v", "500k", "-c:a", "libopus", "-shortest", f("vp9-opus.webm"));
  ff("-f", "lavfi", "-i", bg, "-c:v", "libx264", "-pix_fmt", "yuv420p", f("no-audio.mp4"));
  ff("-f", "lavfi", "-i", tone, "-c:a", "aac", f("audio-only.m4a"));
  writeFileSync(f("garbage.mp4"), Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 7919) % 256)));
  return f;
}

// ---------- server ----------

async function startServer() {
  const env = { ...process.env, PORT: String(PORT) };
  delete env.GROQ_API_KEY; // the real route must report NOT_CONFIGURED
  const server = spawn(join(ROOT, "node_modules/.bin/next"), ["start", "-p", String(PORT)], {
    cwd: ROOT,
    env,
    stdio: "pipe",
    detached: true, // own process group, so stopServer() also kills next-server children
  });
  server.stderr.on("data", (d) => process.stderr.write(d));
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/lab`)).ok) return server;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  stopServer(server);
  throw new Error("next start did not become ready. Did you run `npm run build`?");
}

function stopServer(server) {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
}

// ---------- helpers ----------

const MOCK_WORDS = [
  { text: "नमस्ते", start: 0.5, end: 1.2 },
  { text: "दोस्तों", start: 1.2, end: 1.9 },
  { text: "welcome", start: 2.0, end: 2.6 },
];

async function pick(page, file) {
  await page.goto(`${BASE}/lab`);
  await page.getByTestId("file-input").setInputFiles(file);
  await page.locator('[data-testid="check-ok"], [data-testid="check-error"]').first().waitFor({ timeout: 30_000 });
}

async function download(page, testId, dest) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId(testId).click()]);
  await dl.saveAs(dest);
  return dest;
}

async function renderAndSave(page, dest) {
  await page.getByTestId("render-button").click();
  await page.locator('[data-testid="render-done"], [data-testid="render-error"]').first().waitFor({ timeout: 120_000 });
  if (await page.getByTestId("render-error").isVisible()) {
    throw new Error(`render failed: ${await page.getByTestId("render-error").innerText()}`);
  }
  return download(page, "mp4-link", dest);
}

/** Mean absolute luma difference between two files' frames at time t, within a horizontal band. */
function frameDiff(a, b, t, width, height, bandTop, bandBottom) {
  const gray = (file) =>
    execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"]);
  const ga = gray(a);
  const gb = gray(b);
  let sum = 0;
  let n = 0;
  for (let y = Math.floor(height * bandTop); y < Math.floor(height * bandBottom); y++) {
    for (let x = 0; x < width; x++) {
      sum += Math.abs(ga[y * width + x] - gb[y * width + x]);
      n++;
    }
  }
  return sum / n;
}

const streams = (info, type) => info.streams.filter((s) => s.codec_type === type);

// ---------- tests ----------

async function main() {
  const f = makeFixtures();
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("pageerror:", e.message));

    // 1. Full happy path on a vertical H.264/AAC clip.
    await pick(page, f("vertical.mp4"));
    check("vertical: accepted", await page.getByTestId("check-ok").isVisible());
    check("vertical: placeholder captions are labelled", (await page.getByTestId("caption-source").innerText()).includes("placeholder"));

    await page.getByTestId("extract-button").click();
    await page.locator('[data-testid="extract-done"], [data-testid="extract-error"]').first().waitFor({ timeout: 60_000 });
    if (await page.getByTestId("extract-error").isVisible()) console.log("      extract error:", await page.getByTestId("extract-error").innerText());
    check("extract: completed", await page.getByTestId("extract-done").isVisible());
    const audioBytes = await page.evaluate(async () => {
      const src = document.querySelector('[data-testid="extract-done"] audio').src;
      return Array.from(new Uint8Array(await (await fetch(src)).arrayBuffer()));
    });
    writeFileSync(f("speech.ogg"), Buffer.from(audioBytes));
    const audioInfo = probe(f("speech.ogg"));
    const a0 = streams(audioInfo, "audio")[0];
    check("extract: Ogg container", audioInfo.format.format_name === "ogg", audioInfo.format.format_name);
    check("extract: Opus mono", a0?.codec_name === "opus" && a0?.channels === 1, `${a0?.codec_name} ${a0?.channels}ch`);
    check("extract: audio only", streams(audioInfo, "video").length === 0);
    check("extract: duration ≈ 4 s", Math.abs(Number(audioInfo.format.duration) - 4) < 0.15, audioInfo.format.duration);
    check("extract: small (< 40 KB for 4 s)", audioBytes.length < 40_000, `${audioBytes.length} B`);

    check("transcribe: disclosure names provider before upload", (await page.getByTestId("transcribe-disclosure").innerText()).includes("Groq"));

    // Real route, no key configured: must fail honestly with a recovery action.
    await page.getByTestId("transcribe-button").click();
    await page.getByTestId("transcribe-error").waitFor({ timeout: 15_000 });
    const notConfigured = await page.getByTestId("transcribe-error").innerText();
    check("transcribe: unconfigured server reports it", /not configured/i.test(notConfigured) && /GROQ_API_KEY/.test(notConfigured));

    // Real route rejects a non-Opus upload (byte sniffing).
    const sniff = await page.evaluate(async () => {
      const form = new FormData();
      form.append("audio", new Blob([new Uint8Array(64)], { type: "audio/ogg" }), "x.ogg");
      const r = await fetch("/api/transcribe", { method: "POST", body: form });
      return r.status;
    });
    check("route: rejects when not configured before reading body", sniff === 503, String(sniff));

    // Mocked provider response through the real client wiring.
    let uploaded = null;
    let uploads = 0;
    await page.route("**/api/transcribe", async (route) => {
      uploads++;
      uploaded = route.request().postDataBuffer();
      await route.fulfill({ json: { provider: { id: "groq", displayName: "Groq (mock)" }, words: MOCK_WORDS } });
    });
    await page.getByTestId("language-select").selectOption("hi");
    await page.getByTestId("transcribe-button").click();
    await page.getByTestId("transcribe-done").waitFor({ timeout: 15_000 });
    const wordTexts = () => page.getByTestId("word").allInnerTexts();
    check("transcribe: words appear in the editor", (await wordTexts()).join(" ") === "नमस्ते दोस्तों welcome");
    check("transcribe: upload is the extracted Ogg, not the video", uploaded !== null && uploaded.includes(Buffer.from("OpusHead")) && uploaded.length < 60_000, `${uploaded?.length} B`);
    check("preview: captions now come from transcript", (await page.getByTestId("caption-source").innerText()).includes("from the transcript"));

    // Editing: fix a word's text, nudge a timing with the keyboard, delete + undo + delete.
    await page.getByTestId("word").nth(0).click();
    await page.getByTestId("word-text").fill("Namaste");
    await page.getByTestId("word-text").press("Enter");
    check("edit: text fix applies", (await wordTexts())[0] === "Namaste");
    await page.getByTestId("word").nth(1).click();
    await page.keyboard.press("}");
    check("edit: Shift+] moves end 50 ms later", (await page.getByTestId("word-end").innerText()) === "0:01.95");
    await page.getByTestId("word").nth(2).click();
    await page.keyboard.press("Delete");
    const afterDelete = (await wordTexts()).length;
    await page.keyboard.press("Control+z");
    const afterUndo = (await wordTexts()).length;
    check("edit: delete then undo", afterDelete === 2 && afterUndo === 3, `${afterDelete} → ${afterUndo}`);
    await page.getByTestId("word").nth(2).click();
    await page.keyboard.press("Delete");
    check("edit: caption source says edited", (await page.getByTestId("caption-source").innerText()).includes("with your edits"));

    const srt = readFileSync(await download(page, "srt-link", f("out.srt")), "utf8");
    check(
      "srt: reflects edits",
      srt.startsWith("1\n00:00:00,500 --> 00:00:01,950\nNamaste दोस्तों\n") && !srt.includes("welcome"),
      JSON.stringify(srt.slice(0, 60)),
    );

    // Autosave: reload, re-pick the same file, edits come back without a new upload.
    await page.getByTestId("save-status").filter({ hasText: "Saved in this browser only" }).waitFor({ timeout: 5_000 });
    const uploadsBefore = uploads;
    await page.reload();
    await pick(page, f("vertical.mp4"));
    await page.getByTestId("save-status").filter({ hasText: "Restored" }).waitFor({ timeout: 10_000 });
    check("autosave: edits restored after reload", (await wordTexts()).join(" ") === "Namaste दोस्तों");
    check("autosave: restore needs no new upload", uploads === uploadsBefore, `${uploads - uploadsBefore} uploads`);

    // Render from the restored draft: proves restored edits drive the export.
    const t0 = Date.now();
    const outMp4 = await renderAndSave(page, f("out-vertical.mp4"));
    const info = probe(outMp4);
    const v = streams(info, "video")[0];
    const a = streams(info, "audio")[0];
    check("render: H.264", v?.codec_name === "h264", v?.codec_name);
    check("render: 720×1280 preserved", v?.width === 720 && v?.height === 1280, `${v?.width}x${v?.height}`);
    check("render: original AAC audio copied", a?.codec_name === "aac", a?.codec_name);
    check("render: duration ≈ source", Math.abs(Number(info.format.duration) - 4) < 0.15, info.format.duration);
    check("render: MP4 container", info.format.format_name.includes("mp4"), info.format.format_name);
    console.log(`      render took ${Date.now() - t0} ms`);

    const captionBand = frameDiff(f("vertical.mp4"), outMp4, 1.0, 720, 1280, 0.62, 0.82);
    const topBand = frameDiff(f("vertical.mp4"), outMp4, 1.0, 720, 1280, 0.05, 0.3);
    const deletedBand = frameDiff(f("vertical.mp4"), outMp4, 2.3, 720, 1280, 0.62, 0.82);
    const afterBand = frameDiff(f("vertical.mp4"), outMp4, 3.5, 720, 1280, 0.62, 0.82);
    check("render: captions burned in at 1.0 s", captionBand > 5 && topBand < 2, `caption band Δ${captionBand.toFixed(2)}, top Δ${topBand.toFixed(2)}`);
    check("render: deleted word not burned in (2.3 s)", deletedBand < 2, `Δ${deletedBand.toFixed(2)}`);
    check("render: no caption after last word (3.5 s)", afterBand < 2, `Δ${afterBand.toFixed(2)}`);

    // Start over deletes the draft: a fresh pick shows placeholder words again.
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("start-over").click();
    const backToPlaceholder = await page
      .getByTestId("caption-source")
      .filter({ hasText: "placeholder" })
      .waitFor({ timeout: 5_000 })
      .then(() => true, () => false);
    check("start over: back to placeholder words", backToPlaceholder);
    await page.reload();
    await pick(page, f("vertical.mp4"));
    await page.waitForTimeout(1_000); // give a (wrong) restore time to happen
    check("start over: draft deleted", (await page.getByTestId("caption-source").innerText()).includes("placeholder"));

    // 2. Rotation metadata (phone footage) is baked into the frames.
    await pick(page, f("rotated.mp4"));
    const rotatedText = await page.getByTestId("check-ok").innerText();
    check("rotated: probed as 720×1280 with rotation", rotatedText.includes("720×1280") && /rotated/.test(rotatedText));
    const rot = probe(await renderAndSave(page, f("out-rotated.mp4")));
    const rv = streams(rot, "video")[0];
    const sideRot = (rv?.side_data_list ?? []).find((s) => "rotation" in s)?.rotation ?? 0;
    check("rotated: output upright 720×1280, no rotation metadata", rv?.width === 720 && rv?.height === 1280 && sideRot === 0, `${rv?.width}x${rv?.height} rot ${sideRot}`);

    // 3. VP9/Opus WebM → MP4 with Opus copied (Opus-in-MP4).
    await pick(page, f("vp9-opus.webm"));
    const webm = probe(await renderAndSave(page, f("out-webm.mp4")));
    check("webm: H.264 + Opus-in-MP4", streams(webm, "video")[0]?.codec_name === "h264" && streams(webm, "audio")[0]?.codec_name === "opus");

    // 4. Rejections carry a reason and an action.
    for (const [file, pattern] of [
      ["no-audio.mp4", /no sound/i],
      ["audio-only.m4a", /no video picture/i],
      ["garbage.mp4", /couldn't read/i],
    ]) {
      await pick(page, f(file));
      const err = page.getByTestId("check-error");
      const text = (await err.isVisible()) ? await err.innerText() : "";
      check(`reject: ${file}`, pattern.test(text) && text.split("\n").length >= 2, text.replace(/\n/g, " / "));
      check(`reject: ${file} disables later steps`, await page.getByTestId("render-button").isDisabled());
    }
  } finally {
    await browser.close();
    stopServer(server);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

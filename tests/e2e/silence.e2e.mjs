// End-to-end test for Remove Silence: analysis on the device, review, apply/undo/redo, the preview
// jumping over cuts, and an export that really contains the cuts with audio and video in sync.
// Requires `npm run build`, ffmpeg and ffprobe. Run: npm run e2e

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { frameEnergiesDb, speechRegions } from "../sync/syncMetrics.mjs";
import { createChecks, download, ff, makeFixtures, probe, ROOT, startServer, stopServer, streams } from "./helpers.mjs";

const OUT = join(ROOT, "tests/e2e/.out-silence");
const PORT = 3125;
const { check, finish } = createChecks();

// "Speech" bursts (pink noise) and silences of known length. The 0.3 s gap is a natural pause and
// must stay; 2.5 s, 2 s and the 1.5 s tail are silences. Each burst that follows a cut starts with a
// white flash in the top-left corner, so audio/video sync can be measured in the export.
const BURSTS = [[0.5, 2.5], [5, 7], [7.3, 8.5], [10.5, 11.5]];
const FLASHES = [5, 10.5];
const TOTAL = 13;

function makeClip(path, bursts, flashes, total) {
  const gate = bursts.map(([a, b]) => `between(t,${a},${b})`).join("+");
  const boxes = flashes.map((t) => `drawbox=x=0:y=0:w=200:h=200:color=white:t=fill:enable='between(t,${t},${t + 0.1})'`).join(",");
  ff("-f", "lavfi", "-i", `color=c=0x202020:s=720x1280:r=30:d=${total}`, "-f", "lavfi", "-i", `anoisesrc=d=${total}:c=pink:a=0.5:r=48000`,
    "-filter_complex", `[0:v]${boxes || "null"}[v];[1:a]volume='if(${gate},1,0.001)':eval=frame[a]`, "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-g", "30", "-c:a", "aac", "-b:a", "128k", path);
}

/** Times (s) of frames whose top-left corner is bright. */
function flashTimes(file) {
  const times = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "frame=pts_time", "-of", "csv=p=0", file])
    .toString().trim().split("\n").map(Number);
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-fps_mode", "passthrough", "-vf", "crop=200:200:0:0,scale=4:4,format=gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 26 });
  const found = [];
  for (let f = 0; f < times.length; f++) {
    const mean = raw.subarray(f * 16, f * 16 + 16).reduce((a, b) => a + b, 0) / 16;
    if (mean > 200 && (found.length === 0 || times[f] - found.at(-1) > 0.5)) found.push(times[f]);
  }
  return found;
}

function audioLevels(file) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  return frameEnergiesDb(new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4), 16000);
}

function audioOnsets(file) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  // Bridge only gaps under 0.1 s: the cuts leave 0.25 s pauses, and onsets (not ends) are what sync needs.
  // Ends are not compared: Chromium's Opus encoder (used where there is no AAC encoder, e.g. Linux)
  // leaves a short decay tail after an abrupt stop, which the source doesn't have.
  return speechRegions(frameEnergiesDb(new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4), 16000), { minSilenceSec: 0.1 }).regions.map((r) => r.start);
}

async function main() {
  const f = makeFixtures(OUT);
  const clip = f("silences.mp4");
  makeClip(clip, BURSTS, FLASHES, TOTAL);
  const steady = f("no-silence.mp4");
  makeClip(steady, [[0, 6]], [], 6);

  const server = await startServer(PORT);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("pageerror:", e.message));
    await page.goto(`http://localhost:${PORT}/lab`);
    await page.getByTestId("file-input").setInputFiles(clip);
    await page.getByTestId("check-ok").waitFor({ timeout: 30_000 });

    const panel = page.getByTestId("silence-panel");
    check("silence tool says it stays on the device", (await panel.innerText()).includes("Analysis stays on this device"));
    const analyze = async () => { await panel.getByRole("button", { name: "Analyze pauses locally", exact: true }).click(); await page.waitForFunction(() => { const button = [...document.querySelectorAll("button")].find((button) => button.textContent === "Analyze pauses locally"); return button && !button.disabled; }); await panel.getByRole("img", { name: "Source audio level with proposed cuts", exact: true }).waitFor({ timeout: 60000 }); };
    await analyze();
    check("finds the 3 real silences and keeps the 0.3 s pause", await panel.getByRole("checkbox").count() === 3);
    check("shows measured levels", await panel.getByRole("img", { name: "Source audio level with proposed cuts", exact: true }).isVisible());
    await page.getByLabel("Minimum silence", { exact: true }).fill("2.2"); await analyze();
    check("minimum pause narrows suggestions", await panel.getByRole("checkbox").count() === 1);
    await page.getByLabel("Minimum silence", { exact: true }).fill("0.6"); await analyze();
    check("restoring minimum restores the defaults", await panel.getByRole("checkbox").count() === 3);
    await panel.getByLabel("Remove pause 2", { exact: true }).uncheck(); check("a suggestion can be kept instead", await panel.getByRole("checkbox", { checked: true }).count() === 2); await panel.getByLabel("Remove pause 2", { exact: true }).check();
    await panel.getByRole("button", { name: "Preview proposed cuts without applying", exact: true }).click();
    const jumped = await page.evaluate(async () => { const video = document.querySelector('[data-testid="preview-frame"] video'); video.muted = true; video.currentTime = 3; await video.play(); await new Promise((resolve) => setTimeout(resolve, 600)); video.pause(); return video.currentTime; });
    check("preview playback jumps over a proposed cut", jumped > 4.8);
    const outputSec = Number((await page.getByTestId("apply-cuts").innerText()).match(/([0-9.]+) s output/)[1]);
    await page.getByTestId("apply-cuts").click();
    check("apply reports the new length", await panel.getByText(/^3 applied cuts/).isVisible());
    // Shared undo/redo is exercised in the manual and ripple suites.

    // Export with the cuts.
    await page.getByTestId("render-button").click();
    await page.locator('[data-testid="render-done"], [data-testid="render-error"]').first().waitFor({ timeout: 180_000 });
    const renderError = await page.getByTestId("render-error").isVisible();
    check("export with cuts succeeds", !renderError, renderError ? await page.getByTestId("render-error").innerText() : "");
    if (!renderError) {
      const out = await download(page, "mp4-link", join(OUT, "cut.mp4"));
      const info = probe(out);
      const v = streams(info, "video")[0];
      const a = streams(info, "audio")[0];
      check("export duration matches the edit decision list (±0.1 s)", Math.abs(Number(info.format.duration) - outputSec) < 0.1,
        `file ${Number(info.format.duration).toFixed(2)} s, EDL ${outputSec} s`);
      check("video and audio tracks have the same length (±0.1 s)", Math.abs(Number(v.duration) - Number(a.duration)) < 0.1, `v ${v.duration} a ${a.duration}`);

      const flashes = flashTimes(out);
      const onsets = audioOnsets(out);
      const pairs = flashes.map((t) => onsets.reduce((best, o) => (Math.abs(o - t) < Math.abs(best - t) ? o : best), Infinity) - t);
      check(
        "after cuts, each flash still lines up with its sound (±40 ms)",
        flashes.length === FLASHES.length && pairs.every((d) => Math.abs(d) <= 0.04),
        `flashes ${flashes.map((t) => t.toFixed(2))} · offsets ms ${pairs.map((d) => Math.round(d * 1000))}`,
      );
      // The 7.02–7.31 s pause (0.29 s) sits 2.02–2.31 s after the first flash (source 5.0 s) in the output.
      // It must still be there as a clear dip; its level is compared, not counted as a gap, because the
      // Opus tail (see audioOnsets) can fill part of it.
      const levels = audioLevels(out);
      const db = (t) => levels[Math.round(t * 100)];
      const pauseMin = Math.min(...Array.from({ length: 20 }, (_, i) => db(flashes[0] + 2.07 + i * 0.01)));
      const speech = db(flashes[0] + 1.0);
      check("the 0.3 s natural pause survives the export", speech - pauseMin >= 20, `speech ${speech.toFixed(0)} dB, pause min ${pauseMin.toFixed(0)} dB`);

      const srt = readFileSync(await download(page, "srt-link", join(OUT, "cut.srt")), "utf8");
      const lastEnd = srt.match(/--> (\d\d):(\d\d):(\d\d),(\d\d\d)/g)?.map((m) => {
        const [, h, mi, s, ms] = m.match(/(\d\d):(\d\d):(\d\d),(\d\d\d)/);
        return +h * 3600 + +mi * 60 + +s + +ms / 1000;
      }).at(-1);
      check("SRT is on the cut timeline", lastEnd !== undefined && lastEnd <= outputSec + 0.01, `last cue ends ${lastEnd} s`);
    }

    // A clip with no silence must leave an empty review and clear previous cuts.
    await page.getByTestId("file-input").setInputFiles(steady);
    await page.getByTestId("check-ok").waitFor({ timeout: 30000 });
    await analyze();
    check("no silence: says so instead of inventing cuts", await panel.getByRole("checkbox").count() === 0);
    check("picking a new video cleared the old cuts", await panel.getByText(/applied cuts/).count() === 0);
    await context.close();
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

// End-to-end test for /lab against real ffmpeg-generated fixtures.
// Requires `npm run build` first, plus ffmpeg and ffprobe on PATH.
// Run: npm run e2e

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import {
  countPixels,
  createChecks,
  decodeErrors,
  topLevelBoxes,
  download,
  frameDiff,
  makeFixtures,
  probe,
  ROOT,
  startServer,
  stopServer,
  streams,
} from "./helpers.mjs";

const OUT = join(ROOT, "tests/e2e/.out");
const PORT = 3107;
const BASE = `http://localhost:${PORT}`;
const { check, finish } = createChecks();

// ---------- helpers ----------

const MOCK_WORDS = [
  { text: "namaste", start: 0.5, end: 1.2 },
  { text: "doston", start: 1.2, end: 1.9 },
  { text: "welcome", start: 2.0, end: 2.6 },
];

async function pick(page, file) {
  await page.goto(`${BASE}/lab`);
  await page.getByTestId("file-input").setInputFiles(file);
  await page.locator('[data-testid="check-ok"], [data-testid="check-error"]').first().waitFor({ timeout: 30_000 });
}

/** Picks a caption style the way a user does: by clicking its label. */
async function chooseStyle(page, id) {
  await page.locator("label", { has: page.getByTestId(`style-${id}`) }).click();
  return page.getByTestId(`style-${id}`).isChecked();
}

async function renderAndSave(page, dest) {
  await page.getByTestId("render-button").click();
  await page.locator('[data-testid="render-done"], [data-testid="render-error"]').first().waitFor({ timeout: 120_000 });
  if (await page.getByTestId("render-error").isVisible()) {
    throw new Error(`render failed: ${await page.getByTestId("render-error").innerText()}`);
  }
  return download(page, "mp4-link", dest);
}

// ---------- tests ----------

async function main() {
  const f = makeFixtures(OUT);
  const server = await startServer(PORT);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const fontRequests = [];
    context.on("request", (r) => r.url().includes("/fonts/") && fontRequests.push(new URL(r.url()).pathname));
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
    const flows = await Promise.all(
      ["flow-1", "flow-2", "transcribe-disclosure", "flow-4", "flow-5"].map((id) => page.getByTestId(id).getAttribute("data-leaves-device")),
    );
    check("data flow: every step says where data goes; only Transcribe leaves the device", flows.join() === "false,false,true,false,false", flows.join());

    await context.setOffline(true);
    const offlineShown = await page.getByTestId("offline-note").isVisible();
    const offlineDisabled = await page.getByTestId("transcribe-button").isDisabled();
    await context.setOffline(false);
    await page.getByTestId("offline-note").waitFor({ state: "detached", timeout: 5_000 });
    check("offline: transcribe disabled with an explanation, restored when back online", offlineShown && offlineDisabled && (await page.getByTestId("transcribe-button").isEnabled()));

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
    let romanizeFailsNext = false;
    let holdNext = false;
    let uploads = 0;
    await page.route("**/api/transcribe", async (route) => {
      if (route.request().method() !== "POST") return route.fallback(); // the config GET goes to the real server
      uploads++;
      uploaded = route.request().postDataBuffer();
      if (holdNext) {
        // A slow network: answer late, after the user may have cancelled.
        holdNext = false;
        await new Promise((r) => setTimeout(r, 2_000));
        return route.fulfill({ json: { provider: { id: "groq", displayName: "Groq (mock)" }, words: MOCK_WORDS, warning: null } }).catch(() => {});
      }
      if (romanizeFailsNext) {
        romanizeFailsNext = false;
        const hindi = [{ text: "नमस्ते", start: 0.5, end: 1.2 }];
        const warning = { message: "Couldn't convert the captions to Roman script, so they are in Hindi script.", action: "Transcribe again to retry." };
        return route.fulfill({ json: { provider: { id: "groq", displayName: "Groq (mock)" }, words: hindi, warning } });
      }
      await route.fulfill({ json: { provider: { id: "groq", displayName: "Groq (mock)" }, words: MOCK_WORDS, warning: null } });
    });
    check("hinglish: is the default caption language", (await page.getByTestId("language-select").inputValue()) === "hinglish");

    // A failed romanization is shown honestly, with the Hindi-script words and a way forward.
    holdNext = true;
    await page.getByTestId("transcribe-button").click();
    await page.getByTestId("transcribe-status").waitFor();
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByTestId("transcribe-status").waitFor({ state: "detached", timeout: 5_000 });
    await page.waitForTimeout(2_500); // the late answer must not land after cancelling
    check(
      "transcribe: cancel returns to idle; a late answer is ignored",
      !(await page.getByTestId("transcribe-error").isVisible()) && !(await page.getByTestId("transcribe-done").isVisible()),
    );

    romanizeFailsNext = true;
    await page.getByTestId("transcribe-button").click();
    await page.getByTestId("transcribe-warning").waitFor({ timeout: 15_000 });
    check("hinglish: fallback warning shown", (await page.getByTestId("transcribe-warning").innerText()).includes("Hindi script"));
    check("hinglish: request asked for Hinglish", uploaded !== null && /name="language"\r\n\r\nhinglish/.test(uploaded.toString("latin1")));

    await page.getByTestId("transcribe-button").click();
    await page.getByTestId("transcribe-done").waitFor({ timeout: 15_000 });
    const wordTexts = () => page.getByTestId("word").allInnerTexts();
    check("transcribe: Hinglish words appear in the editor", (await wordTexts()).join(" ") === "namaste doston welcome");
    check("hinglish: no warning when romanized", !(await page.getByTestId("transcribe-warning").isVisible()));
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
      srt.startsWith("1\n00:00:00,500 --> 00:00:01,950\nNamaste doston\n") && !srt.includes("welcome"),
      JSON.stringify(srt.slice(0, 60)),
    );

    // Pick a style before reloading: it is saved with the draft and used by the render below.
    check("style: Pop selectable", await chooseStyle(page, "pop"));

    // Autosave: reload, re-pick the same file, edits come back without a new upload.
    await page.getByTestId("save-status").filter({ hasText: "Saved in this browser only" }).waitFor({ timeout: 5_000 });
    const uploadsBefore = uploads;
    await page.reload();
    await pick(page, f("vertical.mp4"));
    await page.getByTestId("save-status").filter({ hasText: "Restored" }).waitFor({ timeout: 10_000 });
    check("autosave: edits restored after reload", (await wordTexts()).join(" ") === "Namaste doston");
    check("autosave: restore needs no new upload", uploads === uploadsBefore, `${uploads - uploadsBefore} uploads`);
    check("style: restored with the draft", await page.getByRole("radio", { name: "Pop" }).isChecked());

    // Render from the restored draft: proves restored edits drive the export.
    const t0 = Date.now();
    // Measure the longest main-thread stall while rendering (a 16 ms timer that can't fire is a stall).
    await page.evaluate(() => {
      let last = performance.now();
      window.__stall = { max: 0, id: setInterval(() => {
        const now = performance.now();
        window.__stall.max = Math.max(window.__stall.max, now - last);
        last = now;
      }, 16) };
    });
    const outMp4 = await renderAndSave(page, f("out-vertical.mp4"));
    const stallMs = await page.evaluate(() => (clearInterval(window.__stall.id), window.__stall.max));
    console.log(`      longest main-thread stall during render: ${stallMs.toFixed(0)} ms`);
    await page.getByTestId("run-report").locator("summary").click();
    const reportText = await page.getByTestId("report-text").inputValue();
    const reportJson = JSON.parse(reportText.slice(reportText.indexOf("{")));
    check(
      "device report: has step timings and clip details",
      reportText.startsWith("| ") && reportJson.steps.renderMs > 0 && reportJson.steps.checkMs > 0 && reportJson.clip.resolution === "720×1280",
    );
    check("device report: no file name or transcript", !/vertical|Namaste|doston/i.test(reportText));
    check("render: ran in a worker, streamed to device storage", (await page.getByTestId("render-storage").getAttribute("data-storage")) === "disk");
    const info = probe(outMp4);
    const v = streams(info, "video")[0];
    const a = streams(info, "audio")[0];
    check("render: H.264", v?.codec_name === "h264", v?.codec_name);
    check("render: 720×1280 preserved", v?.width === 720 && v?.height === 1280, `${v?.width}x${v?.height}`);
    check("render: original AAC audio copied", a?.codec_name === "aac", a?.codec_name);
    check("render: duration ≈ source", Math.abs(Number(info.format.duration) - 4) < 0.15, info.format.duration);
    check("render: MP4 container", info.format.format_name.includes("mp4"), info.format.format_name);
    const boxes = topLevelBoxes(outMp4).filter((t) => ["ftyp", "moov", "mdat"].includes(t));
    check("render: fast start (moov before mdat), as YouTube recommends", boxes.join(",") === "ftyp,moov,mdat", boxes.join(","));
    const decodeErr = decodeErrors(outMp4);
    check("render: every frame and sample decodes after the moov move", decodeErr === "", decodeErr.slice(0, 200));
    const done = page.getByTestId("render-done");
    check(
      "render: AAC source audio copied, no compatibility warning",
      (await done.getAttribute("data-audio")) === "aac" && !(await page.getByTestId("audio-compat-warning").isVisible()),
    );
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
    check("style: Boxed selectable", await chooseStyle(page, "boxed"));
    const rotMp4 = await renderAndSave(page, f("out-rotated.mp4"));
    const rot = probe(rotMp4);
    check("style: Boxed font files fetched", fontRequests.some((u) => u.includes("/fonts/mukta/mukta-devanagari-700")), fontRequests.join(" "));
    const boxBand = frameDiff(f("rotated.mp4"), rotMp4, 1.0, 720, 1280, 0.71, 0.77);
    check("style: Boxed draws a dark band behind the text", boxBand > 15, `Δ${boxBand.toFixed(2)}`);

    // Brand kit: red text in Hind, moved up to 30% from the top, applied on top of Boxed.
    await page.getByTestId("brand-kit").locator("summary").click();
    await page.getByTestId("brand-kit-enabled").check();
    await page.getByTestId("brand-font").selectOption("hind");
    await page.getByTestId("brand-text-color").fill("#ff0000");
    await page.getByTestId("brand-position").fill("0.3");
    const kitMp4 = await renderAndSave(page, f("out-kit.mp4"));
    const isRed = (r, g, b) => r > 200 && g < 60 && b < 60;
    const redNear30 = countPixels(kitMp4, 1.0, 720, 1280, 0.25, 0.35, isRed);
    const redNear74 = countPixels(kitMp4, 1.0, 720, 1280, 0.7, 0.8, isRed);
    check("brand kit: red captions burned in at the kit position", redNear30 > 500 && redNear74 === 0, `red px @30%: ${redNear30}, @74%: ${redNear74}`);
    check("brand kit: Hind font fetched for the render", fontRequests.some((u) => u.includes("/fonts/hind/hind-latin-600")));
    await page.reload();
    await pick(page, f("rotated.mp4"));
    check("brand kit: summary says on while collapsed", (await page.getByTestId("brand-kit").locator("summary").innerText()).includes("(on)"));
    await page.getByTestId("brand-kit").locator("summary").click();
    check(
      "brand kit: kept after reload",
      (await page.getByTestId("brand-kit-enabled").isChecked()) &&
        (await page.getByTestId("brand-font").inputValue()) === "hind" &&
        (await page.getByTestId("brand-text-color").inputValue()) === "#ff0000",
    );
    const rv = streams(rot, "video")[0];
    const sideRot = (rv?.side_data_list ?? []).find((s) => "rotation" in s)?.rotation ?? 0;
    check("rotated: output upright 720×1280, no rotation metadata", rv?.width === 720 && rv?.height === 1280 && sideRot === 0, `${rv?.width}x${rv?.height} rot ${sideRot}`);

    // 3. VP9/Opus WebM → MP4 with Opus copied (Opus-in-MP4).
    await pick(page, f("vp9-opus.webm"));

    // Cancel mid-render: back to a clean, re-renderable state with no error shown.
    await page.getByTestId("render-button").click();
    await page.getByTestId("render-progress").waitFor({ timeout: 30_000 });
    const leaveBlocked = () =>
      page.evaluate(() => {
        const e = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      });
    const blockedWhileRendering = await leaveBlocked();
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByTestId("render-progress").waitFor({ state: "detached", timeout: 5_000 });
    check("leave warning: on while rendering, off afterwards", blockedWhileRendering && !(await leaveBlocked()));
    check(
      "cancel: stops cleanly",
      !(await page.getByTestId("render-error").isVisible()) &&
        !(await page.getByTestId("render-done").isVisible()) &&
        (await page.getByTestId("render-button").isEnabled()),
    );

    const webm = probe(await renderAndSave(page, f("out-webm.mp4")));
    // This Linux Chromium can't encode AAC, so the Opus source stays Opus, and the user is told.
    // Chrome on Android, Windows and Mac can encode AAC; there the output is AAC (not testable here).
    const webmAudio = streams(webm, "audio")[0]?.codec_name;
    const reported = await page.getByTestId("render-done").getAttribute("data-audio");
    check("webm: H.264 video; audio codec matches what the app reports", streams(webm, "video")[0]?.codec_name === "h264" && webmAudio === reported, `${webmAudio} / ${reported}`);
    check("webm: non-AAC audio comes with a compatibility warning", webmAudio === "aac" || (await page.getByTestId("audio-compat-warning").isVisible()));

    // 4. Phone formats: HDR is accepted with a warning; HEVC depends on the browser's decoder.
    await pick(page, f("hdr.webm"));
    const hdrOk = await page.getByTestId("check-ok").isVisible();
    const hdrText = hdrOk ? await page.getByTestId("check-ok").innerText() : await page.getByTestId("check-error").innerText();
    check("hdr: accepted with a washed-out-colour warning", hdrOk && /HDR video/.test(hdrText), hdrText.replace(/\n/g, " / ").slice(0, 160));
    await pick(page, f("hevc.mp4"));
    const hevcOk = await page.getByTestId("check-ok").isVisible();
    const hevcText = hevcOk ? "accepted" : await page.getByTestId("check-error").innerText();
    check("hevc: accepted, or rejected with a recovery action", hevcOk || /High efficiency video/.test(hevcText), hevcText.replace(/\n/g, " / "));

    // 5. Rejections carry a reason and an action.
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

  finish();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

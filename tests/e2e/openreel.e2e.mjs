import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, firefox, devices } from "playwright";
import { createChecks, ff, probe, streams, decodeErrors, countPixels, ROOT, startServer, stopServer } from "./helpers.mjs";
const OUT = join(ROOT, process.env.OPENREEL_TEST_DIR || "tests/e2e/.out-openreel"), PORT = Number(process.env.OPENREEL_TEST_PORT || 3141), BASE = `http://localhost:${PORT}`;
const { check, finish } = createChecks();
mkdirSync(OUT, { recursive: true });
const source = join(OUT, "blue.mp4"), second = join(OUT, "red.mp4");
for (const [file, color, frequency] of [[source, "blue", 440], [second, "red", 880]]) ff("-f", "lavfi", "-i", `color=c=${color}:s=320x180:r=30:d=4`, "-f", "lavfi", "-i", `sine=frequency=${frequency}:sample_rate=48000:duration=4`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file);
writeFileSync(join(OUT, "invalid.mp4"), "invalid video bytes");
ff("-f", "lavfi", "-i", "color=c=black:s=16x16:r=1:d=601", "-c:v", "libx264", "-pix_fmt", "yuv420p", join(OUT, "too-long.mp4"));
async function editor(page) { await page.goto(BASE + "/studio"); const frame = page.frameLocator('iframe[title="Reel Finisher video editor"]'); await frame.getByRole("heading", { name: /Your footage/ }).waitFor(); await page.getByText("Loading the editor…", { exact: true }).waitFor({ state: "hidden" }); return frame; }
async function dismissTour(frame) { const skip = frame.getByRole("button", { name: "Skip tour", exact: true }).first(); await skip.waitFor({ timeout: 5000 }).then(() => skip.click()).catch(() => {}); }
async function seek(frame, time) { const control = frame.getByLabel("Playhead timecode", { exact: true }); await control.fill(String(time)); await control.press("Enter"); }
async function addMedia(frame, filename, first = false) {
  await frame.getByAltText(filename, { exact: true }).hover(); await frame.getByRole("button", { name: "Add to timeline", exact: true }).first().click();
  if (first) await frame.getByRole("button", { name: "Match Video", exact: true }).click();
}
async function tools(frame, tab = "Captions") { await frame.getByRole("button", { name: "Captions & tools", exact: true }).click(); await frame.getByRole("navigation", { name: "Editor tools", exact: true }).getByRole("button", { name: tab, exact: true }).click(); }
async function closeTools(frame) { await frame.getByRole("button", { name: "Close tools", exact: true }).click(); }
async function exported(page, frame, filename) {
  await frame.getByRole("button", { name: "Export", exact: true }).click();
  const event = page.waitForEvent("download", { timeout: 120000 });
  await frame.getByRole("button", { name: "Export Video", exact: true }).click();
  const result = await event; if (await result.failure()) throw new Error("Export download failed");
  const path = join(OUT, filename); await result.saveAs(path); return path;
}
async function savedProject(page) {
  await page.waitForTimeout(2500);
  return page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => { const request = indexedDB.open("openreel-autosave"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try { const records = await new Promise((resolve, reject) => { const request = database.transaction("autosaves").objectStore("autosaves").getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); return JSON.parse(records.sort((a, b) => b.timestamp - a.timestamp)[0].data); } finally { database.close(); }
  });
}
const server = await startServer(PORT, { env: { REEL_ENABLE_CLOUD: "" } });
const isFirefox = process.env.OPENREEL_BROWSER === "firefox";
const browser = isFirefox ? await firefox.launch({ executablePath: join(ROOT, "output/firefox-test/firefox/firefox.exe") }) : await chromium.launch({ headless: true, ...(process.env.OPENREEL_CHANNEL ? { channel: process.env.OPENREEL_CHANNEL } : {}) });
try {
  for (const path of ["transcribe", "edit-plan"]) { const response = await fetch(`${BASE}/api/${path}`, { method: "POST", body: "never read" }); check(`local: ${path} route rejects processing`, response.status === 403 && (await response.json()).code === "LOCAL_ONLY"); }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  // Edge opens its own downloads-hub page after a download; it is outside the application.
  const requests = []; context.on("request", (request) => { if (!/^(?:edge|chrome):\/\//.test(request.url())) requests.push({ url: request.url(), method: request.method() }); });
  const page = await context.newPage(); let frame = await editor(page);
  await frame.getByRole("button", { name: /^Landscape/ }).click(); await dismissTour(frame);
  check("host: containing page and iframe are cross-origin isolated", await page.evaluate(() => crossOriginIsolated) && await page.frames().find((f) => f.url().includes("/editor/")).evaluate(() => crossOriginIsolated));
  await frame.locator('input[aria-label="Import media"]').setInputFiles([source, second]);
  await frame.getByText("red.mp4", { exact: true }).waitFor({ timeout: 30000 });
  await frame.locator('input[aria-label="Import media"]').setInputFiles(join(OUT, "invalid.mp4")); await frame.getByText("Cannot import media", { exact: true }).waitFor({ timeout: 30000 }); check("import: unsupported media gives a recovery error", true);
  await frame.locator('input[aria-label="Import media"]').setInputFiles(join(OUT, "too-long.mp4")); await frame.getByText(/Videos must have a readable duration and be 10 minutes/).waitFor({ timeout: 30000 }); check("import: native studio rejects a 601-second video", true);
  await addMedia(frame, "blue.mp4", true); await seek(frame, 4); await addMedia(frame, "red.mp4");
  await seek(frame, 0); await frame.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => { const input = document.querySelector("iframe").contentDocument.querySelector('input[aria-label="Playhead timecode"]'); return input && !/^00:00:00:0[0-5]$/.test(input.value); });
  await frame.getByRole("button", { name: "Pause", exact: true }).click(); check("playback: editor preview advances and pauses", true);
  await frame.getByRole("button", { name: "Select clip blue.mp4", exact: true }).click();
  await seek(frame, 1); await frame.getByRole("button", { name: "Trim start to playhead (Q)", exact: true }).click();
  const trimmed = await savedProject(page); check("trim: native trim keeps source and output bounds", trimmed.timeline.tracks.flatMap(t => t.clips).some(c => c.startTime === 1 && c.inPoint === 1 && c.duration === 3));
  await frame.getByRole("button", { name: "Undo", exact: true }).first().click();
  await frame.getByRole("button", { name: "Select clip blue.mp4", exact: true }).click(); await seek(frame, 2); await frame.getByRole("button", { name: "Split (S)", exact: true }).click();
  const split = await savedProject(page); check("split: native split preserves both source intervals", split.timeline.tracks.flatMap(t => t.clips).filter(c => c.inPoint === 2 && c.startTime === 2 && c.outPoint === 4).length === 1);
  await frame.getByRole("button", { name: "Undo", exact: true }).first().click();
  await frame.getByRole("button", { name: "Select clip blue.mp4", exact: true }).click();
  await frame.getByRole("button", { name: "Edit Volume value", exact: true }).click();
  await frame.getByLabel("Volume value", { exact: true }).fill("50"); await frame.getByLabel("Volume value", { exact: true }).press("Enter");
  check("audio: native clip gain persists", (await savedProject(page)).timeline.tracks.flatMap(t => t.clips).some(c => c.startTime === 0 && c.volume === 0.5));
  await frame.getByRole("button", { name: "Select clip blue.mp4", exact: true }).click({ button: "right" });
  await frame.getByRole("menuitem", { name: "Separate Audio", exact: true }).click();
  await page.waitForFunction(async () => {
    const db = await new Promise(resolve => { const req = indexedDB.open("openreel-autosave"); req.onsuccess = () => resolve(req.result); });
    const records = await new Promise(resolve => { const req = db.transaction("autosaves").objectStore("autosaves").getAll(); req.onsuccess = () => resolve(req.result); }); db.close();
    const latest = records.sort((a,b) => b.timestamp - a.timestamp)[0];
    return latest && JSON.parse(latest.data).timeline.tracks.some(track => track.type === "audio" && track.clips.length);
  });
  const separated = await savedProject(page);
  check("audio: separation creates a native audio track", separated.timeline.tracks.some(t => t.type === "audio" && t.clips.length), JSON.stringify({ media: separated.mediaLibrary.items.length, tracks: separated.timeline.tracks.map(t => ({ type: t.type, count: t.clips.length })) }));
  await tools(frame); await frame.getByLabel("Caption text", { exact: true }).fill("नमस्ते doston"); await frame.getByLabel("Start (s)", { exact: true }).fill("0.5"); await frame.getByLabel("End (s)", { exact: true }).fill("3");
  await frame.getByLabel("Text color", { exact: true }).fill("#00ff00"); await frame.getByLabel("Font size", { exact: true }).fill("0.1");
  await frame.getByRole("button", { name: "Add caption to timeline", exact: true }).click(); await frame.getByRole("button", { name: "Save caption changes", exact: true }).waitFor();
  const srtEvent = page.waitForEvent("download"); await frame.getByRole("button", { name: "Download captions SRT", exact: true }).click(); const srt = await srtEvent; const srtFile = join(OUT, "captions.srt"); await srt.saveAs(srtFile);
  check("captions: Hindi SRT preserves output timing", readFileSync(srtFile, "utf8").includes("00:00:00,500 --> 00:00:03,000\nनमस्ते doston"));
  await closeTools(frame); await seek(frame, 1); await page.waitForFunction(() => { const canvas = document.querySelector("iframe").contentDocument.querySelector("canvas"); if (!canvas) return false; const pixel = canvas.getContext("2d").getImageData(5,5,1,1).data; return pixel[2] > 180 && pixel[0] < 50; }, undefined, { timeout: 20000 }); await page.screenshot({ path: join(OUT, "desktop.png") });
  const canvasUrl = await frame.locator("canvas").first().evaluate((canvas) => canvas.toDataURL("image/png")); const previewPng = join(OUT,"caption-preview.png"); writeFileSync(previewPng, Buffer.from(canvasUrl.split(",")[1], "base64"));
  const persisted = await savedProject(page);
  check("project: multiple local files use native tracks and one caption extension", persisted.mediaLibrary.items.length === 3 && persisted.timeline.tracks.flatMap((track) => track.clips).length === 3 && persisted.textClips[0].metadata.reelFinisher.version === 1, JSON.stringify({ media: persisted.mediaLibrary.items.length, tracks: persisted.timeline.tracks.map(t => ({ type: t.type, clips: t.clips.map(c => ({ start: c.startTime, duration: c.duration, in: c.inPoint, out: c.outPoint })) })) }));
  const output = await exported(page, frame, "native.mp4"), details = probe(output), video = streams(details, "video")[0], audio = streams(details, "audio")[0];
  check("export: downloaded native MP4 decodes with synchronized A/V duration", video.codec_name === "h264" && audio && Math.abs(Number(video.duration) - Number(audio.duration)) < 0.05 && Math.abs(Number(video.duration) - 8) < 0.05 && !decodeErrors(output));
  const rms = (time) => { const pcm = execFileSync("ffmpeg", ["-v", "error", "-ss", String(time), "-i", output, "-t", "0.5", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], { maxBuffer: 1000000 }); let sum = 0; for (let i = 0; i < pcm.length; i += 4) sum += pcm.readFloatLE(i) ** 2; return Math.sqrt(sum / (pcm.length / 4)); };
  check("export: audio gain matches the edited clip", Math.abs(rms(1) / rms(5) - 0.5) < 0.06);
  const previewRgb = execFileSync("ffmpeg", ["-v", "error", "-i", previewPng, "-vf", "scale=320:180", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1000000 }); const exportRgb = execFileSync("ffmpeg", ["-v", "error", "-ss", "1", "-i", output, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1000000 }); let difference = 0; for(let i = 0; i < previewRgb.length; i++) difference += Math.abs(previewRgb[i] - exportRgb[i]); check("captions: shared preview/export pixels agree", difference / previewRgb.length < 8, `mean RGB difference ${(difference / previewRgb.length).toFixed(2)}`);
  check("export: Hindi caption is painted in front of video", countPixels(output, 1, 320, 180, 0.4, 0.95, (r, g, b) => g > 130 && g > r * 1.5 && g > b * 1.5) > 60);
  check("export: caption disappears outside its timing", countPixels(output, 3.5, 320, 180, 0.4, 0.95, (r, g, b) => g > 130 && g > r * 1.5 && g > b * 1.5) === 0);
  check("export: second source appears at its output position", countPixels(output, 5, 320, 180, 0, 1, (r, g, b) => r > 180 && b < 50) > 50000);
  await frame.getByRole("button", { name: "Undo", exact: true }).first().click(); await tools(frame); check("history: native undo removes the caption", await frame.getByLabel("Choose caption", { exact: true }).locator("option").count() === 1); await closeTools(frame); await frame.getByRole("button", { name: "Redo", exact: true }).first().click();
  await tools(frame); check("history: native redo restores the caption", await frame.getByLabel("Choose caption", { exact: true }).locator("option").count() === 2); await closeTools(frame);
  await seek(frame, 2); await frame.getByRole("button", { name: "Mark In point", exact: true }).click();
  await seek(frame, 4); await frame.getByRole("button", { name: "Mark Out point", exact: true }).click();
  await frame.getByRole("button", { name: "Ripple delete marked range", exact: true }).click();
  const removedRange = await savedProject(page);
  check("range: In/Out deletion closes exactly two seconds", removedRange.timeline.duration === 6 && removedRange.timeline.tracks.flatMap(t => t.clips).some(c => c.startTime === 2 && c.inPoint === 0 && c.duration === 4));
  check("range: caption end follows the same output map", removedRange.textClips[0].startTime === 0.5 && removedRange.textClips[0].duration === 1.5);
  const audioBounds = removedRange.timeline.tracks.filter(t => t.type === "audio").flatMap(t => t.clips).map(c => ({ start: c.startTime, duration: c.duration, in: c.inPoint, out: c.outPoint }));
  check("range: separate audio is trimmed with its video", audioBounds.some(c => c.start === 0 && c.duration === 2 && c.in === 0 && c.out === 2), JSON.stringify(audioBounds));
  await frame.getByRole("button", { name: "Undo", exact: true }).first().click();
  check("range: one undo restores video and captions", (await savedProject(page)).timeline.duration === 8);
  await frame.getByRole("button", { name: "Redo", exact: true }).first().click();
  await seek(frame, 2.5);
  await page.waitForFunction(() => { const canvas = document.querySelector("iframe").contentDocument.querySelector("canvas"); const p = canvas?.getContext("2d")?.getImageData(5,5,1,1).data; return p && p[0] > 180 && p[2] < 50; });
  const rangeOutput = await exported(page, frame, "range.mp4"), rangeProbe = probe(rangeOutput);
  check("range export: downloaded A/V lasts six seconds", Math.abs(Number(streams(rangeProbe, "video")[0].duration) - 6) < 0.05 && Math.abs(Number(streams(rangeProbe, "audio")[0].duration) - 6) < 0.05 && !decodeErrors(rangeOutput));
  check("range export: source switches at the preview's new boundary", countPixels(rangeOutput, 2.5, 320, 180, 0, 1, (r,g,b) => r > 180 && b < 50) > 50000);
  const samples = execFileSync("ffmpeg", ["-v", "error", "-ss", "2.5", "-i", rangeOutput, "-t", "0.25", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], { maxBuffer: 1000000 });
  let crossings = 0; for (let i = 4; i < samples.length; i += 4) if (samples.readFloatLE(i - 4) <= 0 && samples.readFloatLE(i) > 0) crossings++;
  check("range export: audio switches with the picture", Math.abs(crossings / 0.25 - 880) < 15);
  const independent = await context.newPage();
  await independent.goto(BASE);
  await independent.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const video = document.createElement("video"); video.muted = true; video.controls = true; document.body.replaceChildren(video);
    video.src = URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
    await video.play();
    await new Promise((resolve, reject) => { video.onended = resolve; video.onerror = () => reject(new Error("Independent playback failed")); });
    if (Math.abs(video.currentTime - 6) > 0.1) throw new Error("Independent playback timing differs");
  }, readFileSync(rangeOutput).toString("base64"));
  check("range export: independent HTML video plays to the expected end", true); await independent.close();
  if (process.env.OPENREEL_SPEECH_FIXTURE) {
    const speechFile = join(OUT, "speech.mp4"); ff("-f", "lavfi", "-i", "color=c=blue:s=320x180:r=30", "-i", process.env.OPENREEL_SPEECH_FIXTURE, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", speechFile);
    await seek(frame, 8); await frame.locator('input[aria-label="Import media"]').setInputFiles(speechFile); await frame.getByText("speech.mp4", { exact: true }).waitFor({ timeout: 30000 }); await addMedia(frame, "speech.mp4");
    await tools(frame, "Local Whisper"); const sourceSelect = frame.getByLabel("Source clip", { exact: true }); const withSpeech = await savedProject(page); const speechMedia = withSpeech.mediaLibrary.items.find((item) => item.name === "speech.mp4"); const speechClip = withSpeech.timeline.tracks.flatMap((track) => track.clips).find((clip) => clip.mediaId === speechMedia.id); await sourceSelect.selectOption(speechClip.id);
    await frame.getByRole("button", { name: "Download Whisper Tiny", exact: true }).click(); await frame.getByRole("button", { name: "Cancel / reset local model", exact: true }).click(); check("model: download cancellation resets the worker", await frame.getByRole("button", { name: "Download Whisper Tiny", exact: true }).isVisible()); await frame.getByRole("button", { name: "Download Whisper Tiny", exact: true }).click();
    await frame.getByRole("button", { name: "Transcribe Selected Clip", exact: true }).waitFor();
    await page.waitForFunction(() => { const f = document.querySelector("iframe"); const error = f.contentDocument.querySelector(".rf-dialog [role=alert]"); if (error) throw new Error(error.textContent); return [...f.contentDocument.querySelectorAll("button")].some((button) => button.textContent.includes("Transcribe Selected Clip") && !button.disabled); }, undefined, { timeout: 300000 });
    check("model: optional fast model installs", true);
    await frame.getByRole("button", { name: "Transcribe Selected Clip", exact: true }).click(); await frame.getByRole("button", { name: /Add \d+ as Editable Text/ }).waitFor({ timeout: 240000 }); check("model: real speech produces local caption segments", true); await closeTools(frame);
  }
  await page.waitForFunction(async () => { const registration = await navigator.serviceWorker.getRegistration("/editor/"); return registration?.active?.state === "activated"; }, undefined, { timeout: 60000 });
  await page.evaluate(async () => { const cache = await caches.open("website-unrelated-test"); await cache.put("/unrelated", new Response("keep")); });
  const unexpected = requests.filter((request) => !["GET", "HEAD"].includes(request.method) || !(request.url.startsWith(BASE) || request.url.startsWith("blob:") || request.url.startsWith("data:"))); if (unexpected.length) console.log("UNEXPECTED_REQUESTS", unexpected.map((request) => ({ protocol: new URL(request.url).protocol, origin: new URL(request.url).origin, method: request.method, path: new URL(request.url).pathname.slice(0,100) })));
  check("network: all editor processing uses local GETs or confirmed model assets", requests.every((request) => ["GET", "HEAD"].includes(request.method) && (request.url.startsWith(BASE) || request.url.startsWith("blob:") || request.url.startsWith("data:") || (process.env.OPENREEL_SPEECH_FIXTURE && request.url.startsWith("https://media.openreel.video/models/")))));
  await context.setOffline(true); await page.reload(); frame = page.frameLocator('iframe[title="Reel Finisher video editor"]');
  await frame.getByRole("button", { name: /^Recover / }).first().click({ timeout: 30000 }); await frame.getByRole("button", { name: "Captions & tools", exact: true }).waitFor();
  check("offline: reload recovers the editor and original local media", (await savedProject(page)).mediaLibrary.items.length >= 2);
  check("offline: detached audio survives save/reload", (await savedProject(page)).timeline.tracks.some(t => t.type === "audio" && t.clips.some(c => c.duration === 2)));
  check("offline: editor worker leaves website caches intact", await page.evaluate(async () => !!await (await caches.open("website-unrelated-test")).match("/unrelated")));
  if (process.env.OPENREEL_SPEECH_FIXTURE) {
    await tools(frame, "Local Whisper");
    const recovered = await savedProject(page), speechMedia = recovered.mediaLibrary.items.find((item) => item.name === "speech.mp4");
    const speechClip = recovered.timeline.tracks.flatMap((track) => track.clips).find((clip) => clip.mediaId === speechMedia.id);
    await frame.getByLabel("Source clip", { exact: true }).selectOption(speechClip.id);
    await frame.getByRole("button", { name: "Download Whisper Tiny", exact: true }).click();
    await page.waitForFunction(() => { const doc = document.querySelector("iframe").contentDocument; const error = doc.querySelector(".rf-dialog [role=alert]"); if (error) throw new Error(error.textContent); return [...doc.querySelectorAll("button")].some((button) => button.textContent.includes("Transcribe Selected Clip") && !button.disabled); }, undefined, { timeout: 120000 });
    await frame.getByRole("button", { name: "Transcribe Selected Clip", exact: true }).click(); await frame.getByRole("button", { name: /Add \d+ as Editable Text/ }).waitFor({ timeout: 240000 });
    check("offline: installed Whisper transcribes real speech after reload", true); await closeTools(frame);
  }
  await tools(frame); await frame.getByLabel("Choose caption", { exact: true }).selectOption({ index: 1 }); await frame.getByLabel("Caption text", { exact: true }).fill("Offline edit"); await frame.getByRole("button", { name: "Save caption changes", exact: true }).click(); await closeTools(frame);
  const offline = await exported(page, frame, "offline.mp4"); check("offline: editing and downloaded export work without a network", !decodeErrors(offline));
  await context.close();
  const phoneProfile = { ...devices["Pixel 7"] }; if (isFirefox) delete phoneProfile.isMobile;
  const mobile = await browser.newContext({ ...phoneProfile, acceptDownloads: true }); const phone = await mobile.newPage(); const phoneFrame = await editor(phone); await phoneFrame.getByRole("button", { name: /^Reel \/ Short/ }).click(); await dismissTour(phoneFrame); await tools(phoneFrame); check("phone: caption controls fit the browser viewport", await phoneFrame.getByLabel("Caption text", { exact: true }).isVisible() && await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await phone.screenshot({ path: join(OUT, "phone.png") }); await mobile.close();
} catch (error) { const current = browser.contexts()[0]?.pages()[0]; if (current) { await current.screenshot({path:join(OUT,"failure.png")}); console.log("FAILURE UI", (await current.frames().find(f=>f.url().includes("/editor/")).locator("body").innerText()).slice(-4000)); } throw error; } finally { await browser.close(); await stopServer(server); }
finish();

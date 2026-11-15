import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, createChecks, ff, probe, streams, decodeErrors } from "./helpers.mjs";

// Audio Cutter zoomable waveform: zoom and scroll bounds, windowed detail, keyboard nudging, playback and export in sync.
const OUT = join(ROOT, "output/launch-cutter-zoom"), PORT = Number(process.env.ZOOM_TEST_PORT || 3167), BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const f = name => join(OUT, name);
ff("-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "60", "-af", "volume='0.2+0.8*mod(floor(t),2)':eval=frame", "-c:a", "libmp3lame", "-b:a", "128k", f("long.mp3"));
ff("-f", "lavfi", "-i", "sine=frequency=660:sample_rate=48000", "-t", "3", "-c:a", "pcm_s16le", f("short.wav"));

const { check, finish } = createChecks();
const server = await startServer(PORT);
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const requests = []; context.on("request", req => requests.push({ url: req.url(), method: req.method() }));
const page = await context.newPage(), errors = [];
page.on("pageerror", e => errors.push(e.message));
let workerUrl; page.on("worker", worker => { workerUrl = worker.url(); });
const wave = page.getByTestId("zoom-waveform");
const view = async () => [Number(await wave.getAttribute("data-view-start")), Number(await wave.getAttribute("data-view-end"))];
const field = async label => Number(await page.getByLabel(label, { exact: true }).inputValue());
const setRange = (locator, value) => locator.evaluate((el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v === "max" ? el.max : String(v)); el.dispatchEvent(new Event("input", { bubbles: true })); }, value);
const load = async file => { await page.goto(`${BASE}/tools/audio-cutter`); await page.getByLabel("Choose file", { exact: true }).setInputFiles(file); await wave.waitFor({ timeout: 60000 }); };

try {
  await load(f("long.mp3"));
  let [a, b] = await view(); const total = b;
  check("initial view shows the whole 60 s file", a === 0 && Math.abs(b - 60) < 0.1, `${a}–${b}`);
  check("zoom out and fit are disabled at the whole-file view", await page.getByRole("button", { name: "Zoom out" }).isDisabled());
  await page.getByRole("button", { name: "Zoom in" }).click(); await page.getByRole("button", { name: "Zoom in" }).click();
  [a, b] = await view();
  check("zoom in twice shows a quarter-length window centred on the middle", Math.abs(b - a - total / 4) < 0.01 && Math.abs((a + b) / 2 - total / 2) < 0.01, `${a}–${b}`);
  await setRange(page.getByLabel("Waveform scroll position"), 40);
  [a, b] = await view();
  check("scrolling moves the window and stays inside the file", Math.abs(a - 40) < 0.2 && b <= total + 0.001, `${a}–${b}`);
  await setRange(page.getByLabel("Waveform scroll position"), "max");
  [a, b] = await view();
  check("scroll bound: the window ends exactly at the file end", Math.abs(b - total) < 0.01, `${a}–${b}`);
  for (let i = 0; i < 10; i++) { const zoomIn = page.getByRole("button", { name: "Zoom in" }); if (await zoomIn.isDisabled()) break; await zoomIn.click(); }
  [a, b] = await view();
  check("zoom bound: the window stops at 0.5 s and Zoom in disables", Math.abs(b - a - 0.5) < 0.01 && await page.getByRole("button", { name: "Zoom in" }).isDisabled(), `${(b - a).toFixed(3)} s`);
  await page.getByText("Loading detail").waitFor({ state: "detached", timeout: 30000 });
  const bars = await wave.locator("svg rect").count();
  check("short windows load exact peaks for that window from the worker", bars >= 600, `${bars} rects`);
  await page.getByRole("button", { name: "Show the whole file" }).click();
  [a, b] = await view();
  check("fit returns to the whole file", a === 0 && Math.abs(b - total) < 0.001);

  // Keyboard nudging on the edge handles, then the same selection drives playback and the exported file.
  await page.getByRole("slider", { name: "Selection start" }).focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  check("ArrowRight nudges the start by 0.1 s", Math.abs(await field("Start seconds") - 0.5) < 0.001, String(await field("Start seconds")));
  await page.keyboard.press("Shift+ArrowRight"); await page.keyboard.press("PageUp"); await page.keyboard.press("PageUp");
  check("Shift nudges 1 s and PageUp 5 s", Math.abs(await field("Start seconds") - 11.5) < 0.001, String(await field("Start seconds")));
  await page.keyboard.press("Alt+ArrowLeft");
  check("Alt nudges 0.01 s (fields show tenths)", Math.abs(await page.getByRole("slider", { name: "Selection start" }).getAttribute("aria-valuenow") - 11.49) < 0.001);
  await page.getByRole("slider", { name: "Selection end" }).focus();
  await page.keyboard.press("Home");
  check("the end can never move before the start", Math.abs(await field("End seconds") - 11.6) < 0.06 && await field("End seconds") > await field("Start seconds"), `${await field("Start seconds")}–${await field("End seconds")}`);
  for (let i = 0; i < 3; i++) await page.keyboard.press("PageUp");
  await page.keyboard.press("Shift+ArrowLeft"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  const start = Number(await page.getByRole("slider", { name: "Selection start" }).getAttribute("aria-valuenow")), end = Number(await page.getByRole("slider", { name: "Selection end" }).getAttribute("aria-valuenow"));
  check("selection after nudging is 11.49–25.99 s", Math.abs(start - 11.49) < 0.001 && Math.abs(end - 25.99) < 0.001, `${start}–${end}`);
  await page.getByRole("button", { name: "Zoom to selection" }).click();
  [a, b] = await view();
  check("zoom to selection frames the selection with a margin", a < start && b > end && b - a < 20, `${a}–${b}`);

  await page.getByRole("button", { name: "Play selection" }).click();
  await page.getByRole("button", { name: "Stop" }).waitFor();
  await page.getByRole("button", { name: "Play selection" }).waitFor({ timeout: 25000 });
  const stopped = await page.locator("audio[aria-label='Original preview']").evaluate(el => el.currentTime);
  check("playback starts at the selection and stops at its end", Math.abs(stopped - end) < 0.1, `stopped at ${stopped.toFixed(3)} s`);

  await page.getByRole("radio", { name: "M4R ringtone", exact: true }).check();
  await page.getByRole("button", { name: "Cut audio", exact: true }).click();
  await page.getByRole("link", { name: "Download audio", exact: true }).waitFor({ timeout: 120000 });
  const event = page.waitForEvent("download"); await page.getByRole("link", { name: "Download audio", exact: true }).click();
  const download = await event, path = f("zoomed.m4r"); await download.saveAs(path);
  const duration = Number(probe(path).format.duration);
  check("export uses the exact selection: a 14.50 s AAC .m4r", download.suggestedFilename().endsWith(".m4r") && streams(probe(path), "audio")[0].codec_name === "aac" && Math.abs(duration - (end - start)) < 0.05 && decodeErrors(path) === "", `${duration.toFixed(3)} s for ${(end - start).toFixed(2)} s`);

  // Ringtone limit still applies after zooming and nudging.
  await page.getByRole("button", { name: "Adjust settings" }).click();
  await page.getByRole("slider", { name: "Selection end" }).focus(); for (let i = 0; i < 6; i++) await page.keyboard.press("PageUp");
  check("the 40 s M4R limit still blocks a longer selection", await page.getByText(/iPhone ringtones can be at most 40 seconds/).isVisible() && await page.getByRole("button", { name: "Cut audio", exact: true }).isDisabled());

  // Short file: zoom limit and cancellation.
  await load(f("short.wav"));
  for (let i = 0; i < 6; i++) { const zoomIn = page.getByRole("button", { name: "Zoom in" }); if (await zoomIn.isDisabled()) break; await zoomIn.click(); }
  [a, b] = await view();
  check("short file: zoom stops at a 0.5 s window", Math.abs(b - a - 0.5) < 0.01, `${a}–${b}`);
  await page.route(workerUrl, async route => { await new Promise(resolve => setTimeout(resolve, 4000)); await route.continue().catch(() => {}); });
  await page.getByRole("button", { name: "Cut audio", exact: true }).click(); await page.getByRole("button", { name: "Cancel operation" }).click(); await page.unroute(workerUrl);
  await page.getByText(/Cancelled\. Your file is unchanged/).waitFor();
  check("cancellation: no download and the tool can run again", await page.getByRole("link", { name: /^Download / }).count() === 0 && await page.getByRole("button", { name: "Cut audio", exact: true }).isEnabled());

  check("no browser exceptions", errors.length === 0, errors.join(" | "));
  check("privacy: only same-origin GET/HEAD requests", requests.every(req => ["GET", "HEAD"].includes(req.method) && (req.url.startsWith(BASE) || /^(blob:|data:)/.test(req.url))));
} catch (error) { await page.screenshot({ path: f("failure.png"), fullPage: true }).catch(() => {}); console.log("VISIBLE_ERRORS", await page.getByRole("alert").allTextContents().catch(() => [])); throw error; }
finally { await browser.close(); stopServer(server); }
finish();

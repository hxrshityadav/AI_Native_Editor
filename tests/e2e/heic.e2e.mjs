import { chromium, devices } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, createChecks, probe, streams } from "./helpers.mjs";

// HEIC to JPG, verified on real downloaded JPEGs. Fixtures were encoded with pillow-heif (tests/fixtures/README.md).
const OUT = join(ROOT, "output/launch-heic"), PORT = Number(process.env.HEIC_TEST_PORT || 3157), BASE = `http://localhost:${PORT}`;
const SAMPLE = join(ROOT, "tests/fixtures/sample.heic"), PORTRAIT = join(ROOT, "tests/fixtures/portrait.heic");
mkdirSync(OUT, { recursive: true });
const { check, finish } = createChecks();
const server = await startServer(PORT, { env: { REEL_ENABLE_CLOUD: "" } });
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const requests = []; context.on("request", req => requests.push({ url: req.url(), method: req.method() }));
const page = await context.newPage();
let workerUrl; page.on("worker", worker => { workerUrl = worker.url(); });
const dimensions = path => { const stream = streams(probe(path), "video")[0]; return [stream.width, stream.height]; };
const pixel = (path, x, y) => execFileSync("ffmpeg", ["-v", "error", "-i", path, "-vf", `crop=2:2:${x - x % 2}:${y - y % 2},format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).subarray(0, 3);
const near = (rgb, [r, g, b], tolerance = 18) => Math.abs(rgb[0] - r) <= tolerance && Math.abs(rgb[1] - g) <= tolerance && Math.abs(rgb[2] - b) <= tolerance;
const choose = files => page.getByLabel("Choose HEIC photos", { exact: true }).setInputFiles(files);
async function save(name) { const event = page.waitForEvent("download"); await page.getByRole("link", { name: `Download ${name}`, exact: true }).click(); const file = await event, path = join(OUT, name); await file.saveAs(path); return { path, suggested: file.suggestedFilename() }; }

try {
  await page.goto(BASE + "/tools/heic-to-jpg", { waitUntil: "networkidle" });
  const beforeConvert = requests.length;
  await choose([SAMPLE, PORTRAIT]);
  await page.getByRole("button", { name: "Convert 2 photos to JPG" }).waitFor();
  check("batch: both photos are listed and waiting", (await page.getByRole("list", { name: "Photos to convert" }).getByRole("listitem").count()) === 2);
  await page.getByRole("button", { name: "Convert 2 photos to JPG" }).click();
  await page.getByRole("link", { name: "Download portrait.jpg" }).waitFor({ timeout: 60000 });
  check("lazy loading: the decoder worker loads only when converting", !!workerUrl && !requests.slice(0, beforeConvert).some(req => req.url === workerUrl) && requests.slice(beforeConvert).some(req => req.url === workerUrl), workerUrl);
  const landscape = await save("sample.jpg"), portrait = await save("portrait.jpg");
  check("output: real JPEGs with the HEIC dimensions", JSON.stringify(dimensions(landscape.path)) === "[640,480]" && JSON.stringify(dimensions(portrait.path)) === "[480,640]" && readFileSync(landscape.path)[0] === 0xff && readFileSync(landscape.path)[1] === 0xd8);
  check("output: decoded pixels match the source colours", near(pixel(landscape.path, 40, 40), [230, 40, 40]) && near(pixel(landscape.path, 480, 360), [250, 220, 40]) && near(pixel(landscape.path, 600, 40), [30, 120, 220]), [...pixel(landscape.path, 40, 40)].join(","));
  check("status: completion is announced", await page.getByText("All 2 JPGs are ready. Download each one from the list.").isVisible());

  await page.getByRole("button", { name: "Start over" }).click();
  await choose([{ name: "fake.heic", mimeType: "image/heic", buffer: Buffer.from(readFileSync(SAMPLE)).fill(0, 0, 16) }]);
  await page.getByRole("button", { name: "Convert 1 photo to JPG" }).click();
  await page.getByText(/not a HEIC or HEIF image/).waitFor({ timeout: 30000 });
  check("validation: a file without a HEIF header is rejected on its row", await page.getByRole("link", { name: /^Download / }).count() === 0);

  await page.getByRole("button", { name: "Start over" }).click(); await choose([SAMPLE]);
  let release, entered; const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  await page.route(workerUrl, async r => { entered(); await gate; await r.continue().catch(() => {}); });
  await page.getByRole("button", { name: "Convert 1 photo to JPG" }).click();
  await Promise.race([started, new Promise((_, reject) => setTimeout(() => reject(new Error("Cancellation fixture did not start")), 15000))]);
  await page.getByRole("button", { name: "Cancel operation" }).click(); release(); await page.unroute(workerUrl);
  await page.getByText(/Conversion cancelled/).waitFor();
  check("cancellation: nothing is published and the photo waits", await page.getByRole("link", { name: /^Download / }).count() === 0 && await page.getByRole("button", { name: "Convert 1 photo to JPG" }).isVisible());
  await page.getByRole("button", { name: "Convert 1 photo to JPG" }).click(); await page.getByRole("link", { name: "Download sample.jpg" }).waitFor({ timeout: 60000 });
  check("retry: conversion succeeds after cancelling", true);

  const phone = await browser.newPage(devices["Pixel 7"]);
  await phone.goto(BASE + "/tools/heic-to-jpg"); await phone.getByLabel("Choose HEIC photos", { exact: true }).setInputFiles([SAMPLE, PORTRAIT]);
  await phone.getByRole("button", { name: "Convert 2 photos to JPG" }).waitFor();
  check("mobile: the batch list fits without horizontal overflow", await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phone.screenshot({ path: join(OUT, "phone.png"), fullPage: true }); await phone.close();

  const html = await (await fetch(BASE + "/tools/heic-to-jpg")).text();
  check("SEO: unique title, H1 and FAQ are server-rendered", html.includes("<title>HEIC to JPG Converter · Reel Finisher</title>") && html.includes("Frequently asked questions") && html.includes("<h1"));
  check("privacy: only same-origin GET/HEAD requests", requests.every(req => ["GET", "HEAD"].includes(req.method) && (req.url.startsWith(BASE) || /^(blob:|data:)/.test(req.url))));
  await page.screenshot({ path: join(OUT, "desktop.png"), fullPage: true });
} catch (error) { await page.screenshot({ path: join(OUT, "failure.png"), fullPage: true }).catch(() => {}); throw error; }
finally { await browser.close(); await stopServer(server); }
finish();

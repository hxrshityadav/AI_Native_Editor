import { chromium, devices } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, createChecks, probe, streams } from "./helpers.mjs";

// Passport Photo and the resizer's target size, verified on real downloaded files.
const OUT = join(ROOT, "output/launch-passport"), PORT = Number(process.env.PASSPORT_TEST_PORT || 3155), BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const { check, finish } = createChecks();
const server = await startServer(PORT, { env: { REEL_ENABLE_CLOUD: "" } });
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const requests = []; context.on("request", req => requests.push({ url: req.url(), method: req.method() }));
const page = await context.newPage();
const dimensions = path => { const stream = streams(probe(path), "video")[0]; return [stream.width, stream.height]; };
// 2 × 2 sample at even coordinates: 4:2:0 JPEG chroma cannot be cropped to a single pixel.
const pixel = (path, x, y) => execFileSync("ffmpeg", ["-v", "error", "-i", path, "-vf", `crop=2:2:${x - x % 2}:${y - y % 2},format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).subarray(0, 3);
const near = (rgb, [r, g, b], tolerance = 14) => Math.abs(rgb[0] - r) <= tolerance && Math.abs(rgb[1] - g) <= tolerance && Math.abs(rgb[2] - b) <= tolerance;
async function save(link, name) { const event = page.waitForEvent("download"); await page.getByRole("link", { name: link, exact: true }).click(); const file = await event, path = join(OUT, name); await file.saveAs(path); return { path, suggested: file.suggestedFilename() }; }
const adjust = async () => { const button = page.getByRole("button", { name: "Adjust settings" }); if (await button.count()) await button.click(); };
const portrait = async (width, height) => Buffer.from((await page.evaluate(([w, h]) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
  x.fillStyle = "#d22"; x.fillRect(0, 0, w, h / 2); x.fillStyle = "#22d"; x.fillRect(0, h / 2, w, h / 2); return c.toDataURL("image/png");
}, [width, height])).split(",")[1], "base64");

try {
  await page.goto(BASE + "/tools/passport-photo");
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "portrait.png", mimeType: "image/png", buffer: await portrait(1200, 1600) });
  await page.getByRole("button", { name: "Create passport photo", exact: true }).waitFor();
  check("upload: shows the crop frame and controls", await page.getByRole("group", { name: /Photo position/ }).isVisible() && await page.getByLabel("Photo size", { exact: true }).inputValue() === "35x45");

  await page.getByRole("button", { name: "Create passport photo", exact: true }).click(); await page.getByRole("link", { name: "Download photo", exact: true }).waitFor();
  const photo = await save("Download photo", "passport-35x45.jpg");
  check("export: 35 × 45 mm photo is a real 413 × 531 px JPEG", JSON.stringify(dimensions(photo.path)) === "[413,531]" && readFileSync(photo.path)[0] === 0xff && readFileSync(photo.path)[1] === 0xd8 && photo.suggested === "portrait-passport-35x45.jpg", photo.suggested);
  check("export: framing keeps the subject's top and bottom halves", near(pixel(photo.path, 206, 60), [221, 34, 34]) && near(pixel(photo.path, 206, 470), [34, 34, 221]));
  await page.getByRole("link", { name: "Download 6 × 4 in print sheet" }).waitFor();
  const sheet = await save("Download 6 × 4 in print sheet", "passport-sheet.jpg");
  check("print sheet: 6 × 4 in at 300 DPI with a white border", JSON.stringify(dimensions(sheet.path)) === "[1800,1200]" && near(pixel(sheet.path, 5, 5), [255, 255, 255], 6));

  await adjust();
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Zoom out" }).click();
  await page.getByRole("radio", { name: "Light blue" }).check();
  check("settings: a change invalidates the old download", await page.getByRole("link", { name: "Download photo" }).count() === 0);
  await page.getByRole("button", { name: "Create passport photo", exact: true }).click(); await page.getByRole("link", { name: "Download photo", exact: true }).waitFor();
  const filled = await save("Download photo", "passport-filled.jpg");
  check("fill: zoomed-out empty area uses the chosen background colour", near(pixel(filled.path, 3, 3), [220, 233, 245]), [...pixel(filled.path, 3, 3)].join(","));

  await adjust();
  const frame = page.getByRole("group", { name: /Photo position/ });
  await frame.focus(); await page.keyboard.press("0");
  check("keyboard: 0 resets the zoom", (await page.locator("text=/^100%$/").count()) > 0);
  await page.getByLabel("Photo size", { exact: true }).selectOption("2x2in");
  await page.getByRole("button", { name: "Create passport photo", exact: true }).click(); await page.getByRole("link", { name: "Download photo", exact: true }).waitFor();
  const square = await save("Download photo", "passport-2x2.jpg");
  check("sizes: 2 × 2 in exports 600 × 600 px", JSON.stringify(dimensions(square.path)) === "[600,600]");

  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "vector.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  await page.getByRole("alert").filter({ hasText: /not supported/ }).waitFor();
  check("validation: unsupported files are rejected with a reason", await page.getByRole("link", { name: "Download photo" }).count() === 0);

  await page.goto(BASE + "/tools/image-resizer");
  const noise = Buffer.from((await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 600; c.height = 400; const x = c.getContext("2d"), data = x.createImageData(600, 400); let r = 7; for (let i = 0; i < data.data.length; i += 4) { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; data.data[i] = r & 255; data.data[i + 1] = r >>> 8 & 255; data.data[i + 2] = r >>> 16 & 255; data.data[i + 3] = 255; } x.putImageData(data, 0, 0); return c.toDataURL("image/png"); })).split(",")[1], "base64");
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "noise.png", mimeType: "image/png", buffer: noise });
  await page.getByRole("button", { name: "Resize image", exact: true }).waitFor();
  await page.getByLabel("Width (px)", { exact: true }).fill("300");
  await page.getByText("Format, quality and file size").click();
  await page.getByRole("radio", { name: "WebP", exact: true }).check();
  await page.getByLabel("Target size (KB, optional)").fill("20");
  await page.getByRole("button", { name: "Resize image", exact: true }).click(); await page.getByRole("link", { name: "Download resized image" }).waitFor();
  const resized = await save("Download resized image", "resized-target.webp"), bytes = readFileSync(resized.path).length;
  const achieved = await page.getByText("Target achieved").isVisible();
  check("resizer target: dimensions and the reported outcome match the real file", JSON.stringify(dimensions(resized.path)) === "[300,200]" && readFileSync(resized.path).subarray(8, 12).toString() === "WEBP" && (achieved ? bytes <= 20000 : await page.getByText("Closest possible result").isVisible()), `${bytes} bytes, achieved=${achieved}`);

  const phone = await browser.newPage(devices["Pixel 7"]);
  await phone.goto(BASE + "/tools/passport-photo");
  await phone.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "portrait.png", mimeType: "image/png", buffer: await portrait(600, 800) });
  await phone.getByRole("button", { name: "Create passport photo", exact: true }).waitFor();
  check("mobile: passport workspace fits without horizontal overflow", await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phone.screenshot({ path: join(OUT, "phone.png"), fullPage: true }); await phone.close();

  const html = await (await fetch(BASE + "/tools/passport-photo")).text();
  check("SEO: unique title, H1 and FAQ are server-rendered", html.includes("<title>Passport Photo Maker · Reel Finisher</title>") && html.includes("Frequently asked questions") && html.includes("<h1"));
  check("privacy: only same-origin GET/HEAD requests", requests.every(req => ["GET", "HEAD"].includes(req.method) && (req.url.startsWith(BASE) || /^(blob:|data:)/.test(req.url))));
  await page.screenshot({ path: join(OUT, "desktop.png"), fullPage: true });
} catch (error) { await page.screenshot({ path: join(OUT, "failure.png"), fullPage: true }).catch(() => {}); throw error; }
finally { await browser.close(); await stopServer(server); }
finish();

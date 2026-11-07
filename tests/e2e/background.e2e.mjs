import { chromium, devices } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, createChecks, probe, streams } from "./helpers.mjs";

// Background Remover, verified on real downloaded files (alpha and colour sampled with ffmpeg).
const OUT = join(ROOT, "output/launch-background"), PORT = Number(process.env.BACKGROUND_TEST_PORT || 3158), BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const { check, finish } = createChecks();
const server = await startServer(PORT, { env: { REEL_ENABLE_CLOUD: "" } });
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const requests = []; context.on("request", req => requests.push({ url: req.url(), method: req.method() }));
const page = await context.newPage();
let workerUrl; page.on("worker", worker => { workerUrl = worker.url(); });
const dimensions = path => { const stream = streams(probe(path), "video")[0]; return [stream.width, stream.height]; };
const rgba = (path, x, y) => [...execFileSync("ffmpeg", ["-v", "error", "-i", path, "-vf", `crop=1:1:${x}:${y},format=rgba`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"]).subarray(0, 4)];
async function save(name, saveAs) { const event = page.waitForEvent("download"); await page.getByRole("link", { name, exact: true }).click(); const file = await event, path = join(OUT, saveAs); await file.saveAs(path); return { path, suggested: file.suggestedFilename() }; }
const adjust = async () => { const button = page.getByRole("button", { name: "Adjust settings" }); if (await button.count()) await button.click(); };
const remove = async link => { await page.getByRole("button", { name: "Remove background", exact: true }).click(); await page.getByRole("link", { name: link, exact: true }).waitFor({ timeout: 120000 }); };

try {
  await page.goto(BASE + "/tools/background-remover", { waitUntil: "networkidle" });
  const photo = Buffer.from((await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 640; c.height = 480; const x = c.getContext("2d");
    x.fillStyle = "#d9d9d9"; x.fillRect(0, 0, 640, 480); x.fillStyle = "#c01818"; x.beginPath(); x.arc(320, 250, 150, 0, Math.PI * 2); x.fill();
    return c.toDataURL("image/png");
  })).split(",")[1], "base64");
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "subject.png", mimeType: "image/png", buffer: photo });
  await page.getByRole("button", { name: "Remove background", exact: true }).waitFor();
  const beforeRemove = requests.length;
  check("lazy loading: model and runtime are not downloaded before removing", !requests.some(req => /u2netp|\/ort\//.test(req.url)));

  await remove("Download PNG");
  const cut = await save("Download PNG", "cutout.png");
  const centre = rgba(cut.path, 320, 250), corner = rgba(cut.path, 10, 10);
  check("model: runtime and weights load from this site only when removing", requests.slice(beforeRemove).some(req => req.url === `${BASE}/models/u2netp/u2netp.onnx`) && requests.slice(beforeRemove).some(req => req.url === `${BASE}/ort/ort-wasm-simd-threaded.wasm`));
  check("output: real PNG at the original dimensions", JSON.stringify(dimensions(cut.path)) === "[640,480]" && readFileSync(cut.path).subarray(1, 4).toString() === "PNG" && cut.suggested === "subject-cutout.png");
  check("output: subject kept opaque with its colour, background transparent", centre[3] > 200 && Math.abs(centre[0] - 192) < 20 && corner[3] < 40, `centre ${centre} corner ${corner}`);

  await adjust(); await page.getByRole("radio", { name: "White", exact: true }).check();
  check("settings: a change invalidates the old download", await page.getByRole("link", { name: /^Download / }).count() === 0);
  await remove("Download PNG");
  const white = await save("Download PNG", "cutout-white.png"), whiteCorner = rgba(white.path, 10, 10);
  check("background colour: removed area becomes opaque white", whiteCorner[3] === 255 && whiteCorner.slice(0, 3).every(value => value > 240), String(whiteCorner));

  await adjust(); await page.getByRole("radio", { name: "Transparent", exact: true }).check(); await page.getByRole("radio", { name: "WebP", exact: true }).check();
  await remove("Download WebP");
  const webp = await save("Download WebP", "cutout.webp");
  check("WebP: real WebP with transparency", readFileSync(webp.path).subarray(8, 12).toString() === "WEBP" && rgba(webp.path, 10, 10)[3] < 40);

  await adjust();
  await page.route(workerUrl, async route => { await new Promise(resolve => setTimeout(resolve, 4000)); await route.continue().catch(() => {}); });
  await page.getByRole("button", { name: "Remove background", exact: true }).click();
  await page.getByRole("button", { name: "Cancel operation" }).click(); await page.unroute(workerUrl);
  await page.getByText(/Background removal cancelled/).waitFor();
  check("cancellation: nothing is published after cancelling", await page.getByRole("link", { name: /^Download / }).count() === 0);
  await remove("Download WebP"); check("retry: removal succeeds after cancelling", true);

  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "vector.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  await page.getByRole("alert").filter({ hasText: /not supported/ }).waitFor();
  check("validation: unsupported files are rejected with a reason", await page.getByRole("link", { name: /^Download / }).count() === 0);

  const phone = await browser.newPage(devices["Pixel 7"]);
  await phone.goto(BASE + "/tools/background-remover"); await phone.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "subject.png", mimeType: "image/png", buffer: photo });
  await phone.getByRole("button", { name: "Remove background", exact: true }).waitFor();
  check("mobile: workspace fits without horizontal overflow", await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phone.close();

  const html = await (await fetch(BASE + "/tools/background-remover")).text();
  check("SEO: unique title, H1 and FAQ are server-rendered", html.includes("<title>Background Remover · Reel Finisher</title>") && html.includes("Frequently asked questions") && html.includes("<h1"));
  check("privacy: only same-origin GET/HEAD requests", requests.every(req => ["GET", "HEAD"].includes(req.method) && (req.url.startsWith(BASE) || /^(blob:|data:)/.test(req.url))), requests.find(req => !req.url.startsWith(BASE) && !/^(blob:|data:)/.test(req.url))?.url);
  await page.screenshot({ path: join(OUT, "desktop.png"), fullPage: false });
} catch (error) { await page.screenshot({ path: join(OUT, "failure.png"), fullPage: true }).catch(() => {}); console.log("VISIBLE_ERRORS", await page.getByRole("alert").allTextContents().catch(() => [])); throw error; }
finally { await browser.close(); await stopServer(server); }
finish();

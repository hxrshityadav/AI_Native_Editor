// Scratch: design-review screenshots of the resizer and converter (not part of the test suite).
import { chromium } from "playwright";
import { join } from "node:path";
import { ROOT, startServer, stopServer } from "../tests/e2e/helpers.mjs";
const OUT = join(ROOT, "output/site"), BASE = "http://localhost:3172";
const server = await startServer(3172, { env: { REEL_ENABLE_CLOUD: "" } });
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    await page.goto(BASE + "/tools/image-resizer");
    const png = Buffer.from((await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 1600; c.height = 1000; const x = c.getContext("2d");
      const g = x.createLinearGradient(0, 0, 1600, 1000); g.addColorStop(0, "#0ea5e9"); g.addColorStop(1, "#f43f5e"); x.fillStyle = g; x.fillRect(0, 0, 1600, 1000);
      x.clearRect(0, 0, 220, 220); for (let i = 0; i < 300; i++) { x.fillStyle = `hsl(${i * 41 % 360} 80% 62%)`; x.fillRect(i * 113 % 1600, i * 71 % 1000, 30 + i % 40, 30 + i % 40); } return c.toDataURL("image/png"); })).split(",")[1], "base64");
    await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Resize image", exact: true }).waitFor();
    await page.getByRole("button", { name: "Aspect ratio locked" }).click(); await page.getByLabel("Height (px)", { exact: true }).fill("1600");
    await page.screenshot({ path: join(OUT, `resizer-${name}-configure.png`), fullPage: name === "phone" });
    await page.getByRole("button", { name: "Aspect ratio unlocked" }).click(); await page.getByLabel("Fit preset").selectOption("1080");
    await page.getByRole("button", { name: "Resize image", exact: true }).click(); await page.getByRole("link", { name: "Download resized image" }).waitFor();
    await page.screenshot({ path: join(OUT, `resizer-${name}-result.png`), fullPage: true });
    await page.goto(BASE + "/tools/image-converter");
    await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Convert image", exact: true }).waitFor(); await page.getByRole("radio", { name: "JPEG", exact: true }).check();
    await page.screenshot({ path: join(OUT, `converter-${name}-configure.png`), fullPage: name === "phone" });
    await page.getByRole("button", { name: "Convert image", exact: true }).click(); await page.getByRole("link", { name: "Download converted image" }).waitFor();
    await page.screenshot({ path: join(OUT, `converter-${name}-result.png`), fullPage: false });
    await page.close();
  }
} finally { await browser.close(); await stopServer(server); }

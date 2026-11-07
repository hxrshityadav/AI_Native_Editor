// Scratch: screenshots of the staged compressor workspace for design review (not part of the test suite).
import { chromium } from "playwright";
import { join } from "node:path";
import { ROOT, startServer, stopServer } from "../tests/e2e/helpers.mjs";
const OUT = join(ROOT, "output/site"), BASE = "http://localhost:3170";
const server = await startServer(3170, { env: { REEL_ENABLE_CLOUD: "" } });
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    await page.goto(BASE + "/tools/image-compressor");
    await page.screenshot({ path: join(OUT, `ws-${name}-1-upload.png`) });
    const png = Buffer.from((await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 1600; c.height = 1000; const x = c.getContext("2d");
      const g = x.createLinearGradient(0, 0, 1600, 1000); g.addColorStop(0, "#f59e0b"); g.addColorStop(1, "#7c3aed"); x.fillStyle = g; x.fillRect(0, 0, 1600, 1000);
      for (let i = 0; i < 400; i++) { x.fillStyle = `hsl(${i * 37 % 360} 70% 60%)`; x.beginPath(); x.arc(i * 97 % 1600, i * 53 % 1000, 8 + i % 30, 0, 7); x.fill(); } return c.toDataURL("image/png"); })).split(",")[1], "base64");
    await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "sunset-photo.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Compress image", exact: true }).waitFor();
    await page.screenshot({ path: join(OUT, `ws-${name}-2-configure.png`), fullPage: name === "phone" });
    await page.getByRole("button", { name: "200 KB" }).click();
    await page.getByRole("button", { name: "Compress image", exact: true }).click(); await page.getByRole("link", { name: "Download compressed image" }).waitFor();
    await page.screenshot({ path: join(OUT, `ws-${name}-3-result.png`), fullPage: true });
    await page.close();
  }
} finally { await browser.close(); await stopServer(server); }

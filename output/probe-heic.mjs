import { chromium } from "playwright";
import { join } from "node:path";
import { ROOT, startServer, stopServer } from "../tests/e2e/helpers.mjs";
const server = await startServer(3173, { env: { REEL_ENABLE_CLOUD: "" } });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage(); const urls = []; page.on("request", r => urls.push(r.url())); let worker; page.on("worker", w => { worker = w.url(); });
  await page.goto("http://localhost:3173/tools/heic-to-jpg", { waitUntil: "networkidle" }); const before = urls.length;
  await page.getByLabel("Choose HEIC photos", { exact: true }).setInputFiles(join(ROOT, "tests/fixtures/sample.heic"));
  await page.getByRole("button", { name: "Convert 1 photo to JPG" }).click(); await page.getByRole("link", { name: "Download sample.jpg" }).waitFor({ timeout: 60000 });
  console.log("worker", worker); console.log("after convert:", urls.slice(before).map(u => u.replace("http://localhost:3173", "")).join("\n"));
} finally { await browser.close(); await stopServer(server); }

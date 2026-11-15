import { chromium } from "playwright";
import { startServer, stopServer } from "../tests/e2e/helpers.mjs";
const server = await startServer(3171, { env: { REEL_ENABLE_CLOUD: "" } });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ reducedMotion: "reduce" }); await page.goto("http://localhost:3171/tools");
  console.log(await page.locator("main ul a").first().evaluate(el => ({ html: el.outerHTML.slice(0, 160), d: getComputedStyle(el).transitionDuration, m: matchMedia("(prefers-reduced-motion: reduce)").matches })));
} finally { await browser.close(); await stopServer(server); }

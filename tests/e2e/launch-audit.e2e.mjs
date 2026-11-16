import { chromium, firefox, devices } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, createChecks } from "./helpers.mjs";

const PORT=Number(process.env.REEL_E2E_PORT || 3144), BASE = `http://localhost:${PORT}`, OUT = join(ROOT, "output/launch-browser");
mkdirSync(OUT, { recursive: true });
const { check, finish } = createChecks();
const server = await startServer(PORT);
const firefoxPath = join(ROOT, "output/firefox-test/firefox/firefox.exe");
const results = [];
const PUBLIC = ["/", "/tools", "/privacy", "/supported-formats", "/tools/image-compressor"];
try {
  for (const path of ["/", "/privacy", "/supported-formats"]) {
    const response = await fetch(BASE + path), html = await response.text();
    check(`public ${path}: server-rendered page, title and crawlable links`, response.ok && /<h1/.test(html) && /<title>/.test(html) && /href="\//.test(html));
    check(`public ${path}: no cross-origin isolation headers`, !response.headers.has("Cross-Origin-Embedder-Policy"));
  }
  const robots = await (await fetch(BASE + "/robots.txt")).text();
  const sitemap = await (await fetch(BASE + "/sitemap.xml")).text();
  check("SEO: robots excludes model and runtime asset paths", ["/local-models/", "/local-ai/", "/pdfjs/"].every(path => robots.includes(`Disallow: ${path}`)));
  check("SEO: sitemap is XML without removed routes", sitemap.includes("<urlset") && !/\/studio|\/editor|\/lab|shorts-maker/.test(sitemap));
  for (const path of ["/studio", "/studio-legacy", "/lab", "/editor/index.html", "/tools/shorts-maker", "/api/transcribe"]) check(`removed ${path}: returns 404`, (await fetch(BASE + path)).status === 404);
  check("errors: unknown route returns 404", (await fetch(BASE + "/unknown-launch-test")).status === 404);
  for (const [name, type, options] of [
    ["Chrome", chromium, { channel: "chrome" }],
    ["Edge", chromium, { channel: "msedge" }],
    ["Firefox", firefox, existsSync(firefoxPath) ? { executablePath: firefoxPath } : {}],
  ]) {
    const browser = await type.launch(options);
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const external = [], errors = [];
      page.on("request", req => { if (!req.url().startsWith(BASE) && !/^(blob:|data:)/.test(req.url())) external.push(new URL(req.url()).origin); });
      page.on("pageerror", error => errors.push(error.message));
      for (const path of PUBLIC) await page.goto(BASE + path, { waitUntil: "networkidle" });
      const capabilities = await page.evaluate(() => ({
        secure: isSecureContext, videoDecoder: typeof VideoDecoder !== "undefined", videoEncoder: typeof VideoEncoder !== "undefined",
        audioEncoder: typeof AudioEncoder !== "undefined", wasm: typeof WebAssembly !== "undefined",
      }));
      check(`${name}: public pages load from this origin only, without errors`, capabilities.secure && capabilities.wasm && !external.length && !errors.length, [...external, ...errors].join(" | "));
      results.push({ browser: name, version: browser.version(), ...capabilities });
      await page.screenshot({ path: join(OUT, `${name.toLowerCase()}.png`) });
      if (name === "Chrome") {
        const phone = await browser.newPage({ ...devices["Pixel 7"] });
        for (const path of ["/", "/privacy", "/supported-formats"]) {
          await phone.goto(BASE + path);
          check(`mobile ${path}: readable without horizontal overflow`, await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
        await phone.close();
      }
    } finally { await browser.close(); }
  }
  writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await stopServer(server); }
finish();

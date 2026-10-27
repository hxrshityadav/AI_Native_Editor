import { chromium, firefox, devices } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, createChecks } from "./helpers.mjs";

const PORT = 3144, BASE = `http://localhost:${PORT}`, OUT = join(ROOT, "output/launch-browser");
mkdirSync(OUT, { recursive: true });
const { check, finish } = createChecks();
const server = await startServer(PORT, { env: { REEL_ENABLE_CLOUD: "" } });
const firefoxPath = join(ROOT, "output/firefox-test/firefox/firefox.exe");
const results = [];
try {
  for (const path of ["/", "/privacy", "/supported-formats"]) {
    const response = await fetch(BASE + path), html = await response.text();
    check(`public ${path}: server-rendered page, title and crawlable links`, response.ok && /<h1/.test(html) && /<title>/.test(html) && /href="\//.test(html));
    check(`public ${path}: editor isolation does not affect information pages`, !response.headers.has("Cross-Origin-Embedder-Policy"));
  }
  const robots = await (await fetch(BASE + "/robots.txt")).text();
  const sitemap = await (await fetch(BASE + "/sitemap.xml")).text();
  check("SEO: robots excludes internal/editor paths", ["/lab", "/studio-legacy", "/editor/", "/api/"].every(path => robots.includes(`Disallow: ${path}`)));
  check("SEO: sitemap is XML without internal tools", sitemap.includes("<urlset") && !/\/studio|\/editor|\/lab/.test(sitemap));
  for (const path of ["/lab", "/studio-legacy", "/studio"]) check(`SEO ${path}: noindex metadata`, /name="robots" content="[^"]*noindex/.test(await (await fetch(BASE + path)).text()));
  check("SEO: generated editor has noindex response header", (await fetch(BASE + "/editor/index.html")).headers.get("x-robots-tag")?.includes("noindex"));
  check("errors: unknown route returns 404", (await fetch(BASE + "/unknown-launch-test")).status === 404);
  const licenses = await (await fetch(BASE + "/editor/licenses/bundled.json")).json();
  check("notices: actual bundled dependencies have an inventory", licenses.some(pkg => pkg.name === "react") && licenses.some(pkg => pkg.name === "gsap"));
  check("notices: MIT original copyright is distributed", (await (await fetch(BASE + "/editor/OPENREEL-LICENSE.txt")).text()).includes("Augustus Otu"));
  for (const [name, type, options] of [
    ["Chrome", chromium, { channel: "chrome" }],
    ["Edge", chromium, { channel: "msedge" }],
    ["Firefox", firefox, existsSync(firefoxPath) ? { executablePath: firefoxPath } : {}],
  ]) {
    const browser = await type.launch(options);
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const external = [];
      page.on("request", req => { if (!req.url().startsWith(BASE) && !/^(blob:|data:)/.test(req.url())) external.push(new URL(req.url()).origin); });
      await page.addInitScript(() => {
        window.auditLongTasks = [];
        try { new PerformanceObserver(list => window.auditLongTasks.push(...list.getEntries().map(entry => entry.duration))).observe({ type: "longtask", buffered: true }); } catch {}
      });
      await page.goto(BASE + "/studio");
      const frame = page.frameLocator('iframe[title="Reel Finisher video editor"]');
      await frame.getByRole("heading", { name: /Your footage/ }).waitFor();
      await page.getByText("Loading the editor…", { exact: true }).waitFor({ state: "hidden" });
      const editor = page.frames().find(f => f.url().includes("/editor/"));
      const capabilities = await editor.evaluate(async () => ({
        secure: isSecureContext, isolated: crossOriginIsolated,
        videoDecoder: typeof VideoDecoder !== "undefined", videoEncoder: typeof VideoEncoder !== "undefined",
        audioEncoder: typeof AudioEncoder !== "undefined", audioWorklet: typeof AudioWorkletNode !== "undefined",
        wasm: typeof WebAssembly !== "undefined", sharedMemory: typeof SharedArrayBuffer !== "undefined", webgpu: "gpu" in navigator,
        navigationMs: performance.now(), resourceBytes: performance.getEntriesByType("resource").reduce((sum, e) => sum + e.encodedBodySize, 0),
      }));
      check(`${name}: browser editor loads with isolated local assets`, capabilities.secure && capabilities.isolated && capabilities.wasm && capabilities.sharedMemory && !external.length);
      results.push({ browser: name, version: browser.version(), ...capabilities, hostLongTasksMs: await page.evaluate(() => window.auditLongTasks) });
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

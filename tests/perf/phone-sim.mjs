// Emulated mid-range phone run of /lab: Pixel 7 viewport and touch, CPU throttled 4×, a 60 s
// 1080×1920 clip with motion. Measures step timings, the longest main-thread stall, and the peak
// memory (RSS) of all Chromium processes during the render.
// NOT a real device: desktop codecs, desktop GPU, and CDP throttling only slows the page's CPU.
// Requires `npm run build`, ffmpeg. Run: npm run perf

import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "playwright";

const ROOT = new URL("../..", import.meta.url).pathname;
const OUT = join(ROOT, "tests/perf/.out");
const PORT = 3109;
const SECONDS = Number(process.env.PERF_SECONDS ?? 60);
const THROTTLE = Number(process.env.PERF_THROTTLE ?? 4);
const SIZE = process.env.PERF_SIZE ?? "1080x1920";

mkdirSync(OUT, { recursive: true });
const clip = join(OUT, `phone-${SIZE}-${SECONDS}s.mp4`);
// Moving test pattern plus noise, encoded at a phone-like ~12 Mbps, with a speech-band tone.
execFileSync("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", `testsrc2=s=${SIZE}:r=30:d=${SECONDS},noise=alls=12:allf=t`,
  "-f", "lavfi", "-i", `sine=frequency=220:sample_rate=48000:duration=${SECONDS}`,
  "-c:v", "libx264", "-preset", "veryfast", "-b:v", "12M", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "128k", "-shortest", clip,
]);

const words = Array.from({ length: Math.floor(SECONDS / 0.4) }, (_, i) => ({
  text: ["aaj", "hum", "baat", "karenge", "reels", "ke", "captions", "ke", "baare", "mein"][i % 10],
  start: +(i * 0.4 + 0.1).toFixed(2),
  end: +(i * 0.4 + 0.45).toFixed(2),
}));

/** RSS in MB per Chromium process type (renderer, gpu-process, utility, browser). Shared pages count once per process. */
function chromiumRssByType() {
  const byType = {};
  try {
    for (const line of execFileSync("ps", ["-eo", "rss,args"]).toString().split("\n")) {
      if (!/chrom/i.test(line)) continue;
      const type = line.match(/--type=([\w-]+)/)?.[1] ?? "browser";
      byType[type] = (byType[type] ?? 0) + Number(line.trim().split(/\s+/)[0] || 0) / 1024;
    }
  } catch {}
  return byType;
}
const total = (t) => Object.values(t).reduce((a, b) => a + b, 0);
const chromiumRssMb = () => total(chromiumRssByType());

const server = spawn(join(ROOT, "node_modules/.bin/next"), ["start", "-p", String(PORT)], { cwd: ROOT, detached: true, stdio: "ignore" });
const stop = () => { try { process.kill(-server.pid, "SIGTERM"); } catch {} };
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/lab`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  await page.route("**/api/transcribe", (r) =>
    r.request().method() === "POST"
      ? r.fulfill({ json: { provider: { id: "groq", displayName: "Groq (mock)" }, words, warning: null } })
      : r.fallback(),
  );

  await page.goto(`http://localhost:${PORT}/lab`);
  await page.getByTestId("file-input").setInputFiles(clip);
  await page.locator('[data-testid="check-ok"], [data-testid="check-error"]').first().waitFor({ timeout: 120_000 });
  await page.getByTestId("extract-button").click();
  await page.getByTestId("extract-done").waitFor({ timeout: 300_000 });
  await page.getByTestId("transcribe-button").click();
  await page.getByTestId("transcribe-done").waitFor({ timeout: 60_000 });

  // Idle cost: how busy the page's main thread is while the user just looks at the editor (video paused).
  await cdp.send("Performance.enable");
  const taskSeconds = async () => (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value;
  const idleStart = await taskSeconds();
  await page.waitForTimeout(3000);
  const idleBusyPct = ((await taskSeconds()) - idleStart) / 3 * 100;

  const baseline = chromiumRssMb();
  let peak = baseline;
  const baselineByType = chromiumRssByType();
  let peakByType = baselineByType;
  const sampler = setInterval(() => {
    const now = chromiumRssByType();
    if (total(now) > peak) [peak, peakByType] = [total(now), now];
  }, 500);
  await page.evaluate(() => {
    let last = performance.now();
    window.__stall = { max: 0, id: setInterval(() => {
      const now = performance.now();
      window.__stall.max = Math.max(window.__stall.max, now - last);
      last = now;
    }, 16) };
  });
  await page.getByTestId("render-button").click();
  await page.locator('[data-testid="render-done"], [data-testid="render-error"]').first().waitFor({ timeout: 900_000 });
  clearInterval(sampler);
  const stallMs = await page.evaluate(() => (clearInterval(window.__stall.id), window.__stall.max));

  await page.getByTestId("run-report").locator("summary").click();
  const report = await page.getByTestId("report-text").inputValue();
  console.log(`emulated: ${devices["Pixel 7"].viewport.width}×${devices["Pixel 7"].viewport.height} Pixel 7 profile, CPU ÷${THROTTLE}, ${SECONDS} s ${SIZE} clip`);
  console.log(`render outcome: ${(await page.getByTestId("render-done").isVisible()) ? "done" : await page.getByTestId("render-error").innerText()}`);
  console.log(`main thread busy while idle in the editor (throttled): ${idleBusyPct.toFixed(1)}%`);
  console.log(`longest main-thread stall during render: ${stallMs.toFixed(0)} ms`);
  console.log(`Chromium RSS: ${baseline.toFixed(0)} MB before render, peak ${peak.toFixed(0)} MB (+${(peak - baseline).toFixed(0)} MB)`);
  console.log(
    "growth by process type at peak (MB): " +
      Object.keys(peakByType).map((k) => `${k} +${(peakByType[k] - (baselineByType[k] ?? 0)).toFixed(0)}`).join(", "),
  );
  console.log(report.split("\n")[0]);
  await browser.close();
} finally {
  stop();
}

// Document scrolling: the viewport owns the vertical scrollbar (outside the rounded frame), the header stays sticky,
// no outer wrapper scrolls, and dialogs and the drawer still work. Screenshots at seven widths, at rest and scrolled.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, createChecks } from "./helpers.mjs";
const OUT = join(ROOT, "output/scrollbar"), PORT = 3214, BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const { check, finish } = createChecks();
const server = await startServer(PORT), browser = await chromium.launch({ channel: "chrome" });
try {
  for (const [width, height] of [[1920, 1080], [1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844], [375, 812]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
    for (const route of ["/", "/tools", "/command-center", "/tools/music-mixer", "/tools/audio-cutter", "/tools/image-compressor", "/tools/video-compressor", "/privacy"]) {
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      const facts = await page.evaluate(async () => {
        const doc = document.documentElement, frame = document.querySelector(".app-frame").getBoundingClientRect();
        const header = document.querySelector(innerWidth >= 1024 ? ".top-bar" : ".mobile-header").getBoundingClientRect();
        const scrollers = [...document.querySelectorAll("body *")].filter(el => { const s = getComputedStyle(el); return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > innerHeight * 0.5; }).map(el => el.className || el.tagName);
        window.scrollTo(0, 600); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const after = document.querySelector(innerWidth >= 1024 ? ".top-bar" : ".mobile-header").getBoundingClientRect();
        return { gutter: innerWidth - doc.clientWidth, frameRight: frame.right, clientWidth: doc.clientWidth, overflowX: doc.scrollWidth - doc.clientWidth, scrolled: scrollY, docScrolls: doc.scrollHeight > innerHeight, scrollers, headerY: header.y, headerAfter: after.y };
      });
      const label = `${width} ${route}`;
      check(`${label}: the document scrolls (no tall inner scroller)`, facts.docScrolls && facts.scrolled > 0 && facts.scrollers.length === 0, JSON.stringify(facts.scrollers));
      check(`${label}: scrollbar outside the frame, no horizontal overflow`, facts.frameRight <= facts.clientWidth + 0.5 && facts.overflowX <= 0, `gutter ${facts.gutter}, frame right ${facts.frameRight}, client ${facts.clientWidth}`);
      check(`${label}: header stays sticky while scrolling`, Math.abs(facts.headerAfter - facts.headerY) < 0.5, `${facts.headerY} → ${facts.headerAfter}`);
      if (["/", "/tools/audio-cutter"].includes(route)) await page.screenshot({ path: join(OUT, `${route === "/" ? "home" : "audio-cutter"}-${width}-scrolled.png`) });
    }
    // Palette and drawer: overlays above the page; the palette list scrolls on its own; closing restores document scroll.
    await page.goto(BASE + "/tools", { waitUntil: "networkidle" });
    await page.keyboard.press("Control+k");
    const palette = await page.locator("dialog.cc-palette").evaluate(d => d.open);
    await page.keyboard.press("Escape");
    check(`${width}: command palette opens and closes`, palette && !(await page.locator("dialog.cc-palette").evaluate(d => d.open)));
    if (width < 1024) {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      const locked = await page.evaluate(() => getComputedStyle(document.documentElement).overflowY);
      await page.keyboard.press("Escape");
      check(`${width}: mobile drawer locks page scroll while open`, locked === "hidden" && await page.evaluate(() => getComputedStyle(document.documentElement).overflowY) !== "hidden");
    }
    await page.close();
  }
} finally { await browser.close(); stopServer(server); }
finish();

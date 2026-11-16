import { chromium } from 'playwright';
import { mkdirSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, startServer, stopServer, createChecks } from './helpers.mjs';

const OUT = join(ROOT, 'output/header-root-cause/final'), PORT=Number(process.env.REEL_E2E_PORT || 3213);
mkdirSync(OUT, { recursive: true });
const { check, finish } = createChecks(), evidence = [];
const tools = readdirSync(join(ROOT, 'src/app/tools'), { withFileTypes:true }).filter(e => e.isDirectory() && existsSync(join(ROOT, 'src/app/tools', e.name, 'page.tsx'))).map(e => `/tools/${e.name}`);
const routes = ['/', '/tools', ...['photo', 'video', 'audio', 'ai'].map(c => `/tools?category=${c}`), '/tools/image-compressor', '/command-center', '/supported-formats', '/privacy'];
const server = await startServer(PORT), browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  async function measure() {
    return page.evaluate(() => {
      const rect = selector => { const el = document.querySelector(selector); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, bottom: r.bottom, right: r.right, height: r.height }; };
      const header = rect(innerWidth >= 1024 ? '.top-bar' : '.mobile-header'), main = rect('main'), first = rect('main > :first-child');
      const scrollport = { y: 0 };
      return { header, main, first, scrollport, frame:rect('.app-frame'), hero:rect('.home-col:first-child > :first-child'), supporting:rect('.home-col:last-child'), sidebar:rect('.rail-column'), footer:rect('footer'), gap: main.y - header.bottom, token: getComputedStyle(document.querySelector('.site')).getPropertyValue('--header-content-gap').trim(), padding: getComputedStyle(document.querySelector('main')).paddingTop, overflow: document.documentElement.scrollWidth - innerWidth };
    });
  }
  for (const [width, height] of [[1900,1000],[1920,1080],[1600,900],[1440,900],[1280,800],[1024,768],[768,1024],[430,932],[390,844],[360,800]]) {
    await page.setViewportSize({ width, height });
    for (const route of routes) {
      await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle' });
      const closed = await measure();
      check(`${width} ${route}: shared 20px gap without double padding`, Math.abs(closed.gap - 20) < .1 && closed.padding === '0px');
      check(`${width} ${route}: no horizontal clipping`, closed.overflow <= 1);
      if (width >= 1024) {
        check(`${width} ${route}: header/content horizontal alignment`, Math.abs(closed.header.x - closed.main.x) < .1 && Math.abs(closed.header.right - closed.main.right) < .1);
        await page.locator('#desktop-navigation').getByRole('link', { name: 'Home', exact: true }).hover();
        await page.waitForTimeout(200);
        const open = await measure();
        check(`${width} ${route}: expansion preserves vertical positions and gap`, Math.abs(open.gap - 20) < .1 && open.main.y === closed.main.y && open.header.y === closed.header.y);
        check(`${width} ${route}: real content width still resizes`, open.main.width < closed.main.width && open.overflow <= 1);
        if (width === 1920 && route === '/') await page.screenshot({ path: join(OUT, 'home-expanded.png') });
        await page.mouse.move(width - 40, 900); await page.waitForTimeout(350);
        const restored = await measure();
        check(`${width} ${route}: collapse restores width`, Math.abs(restored.main.width - closed.main.width) < .1);
      }
      if (([1900,1920].includes(width) && ['/', '/tools/image-compressor', '/command-center'].includes(route)) || (width === 390 && route === '/')) {
        await page.locator('img').evaluateAll(imgs => Promise.all(imgs.map(async img => { img.loading = 'eager'; await img.decode(); })));
        await page.screenshot({ path: join(OUT, `${width}-${route.replaceAll('/', '_')}.png`), fullPage: true });
      }
      await page.evaluate(() => window.scrollTo(0, 80));
      const scrolled = await measure();
      check(`${width} ${route}: the document scrolls and the sticky header stays put`, await page.evaluate(() => scrollY) === 80 && scrolled.header.y === closed.header.y && Math.abs(scrolled.main.y - (closed.main.y - 80)) < .5);
      check(`${width} ${route}: content scrolls under the header, never into the 20px gap`, await page.evaluate(() => {
        const header = document.querySelector(innerWidth >= 1024 ? '.top-bar' : '.mobile-header'), h = header.getBoundingClientRect();
        const hit = document.elementFromPoint(h.x + h.width / 2, h.bottom + 10);
        const scrollers = [...document.querySelectorAll('.app-frame, .shell-content, .shell-scroll, #content, main')].filter(el => /(auto|scroll)/.test(getComputedStyle(el).overflowY));
        return hit === header && scrollers.length === 0;
      }));
      if (width === 1900 && route === '/') await page.screenshot({ path: join(OUT, 'after-scroll-80.png') });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      check(`${width} ${route}: footer is fully reachable by document scrolling`, await page.locator('footer').evaluate(el => {
        const footer = el.getBoundingClientRect();
        return footer.bottom <= innerHeight + 1 && footer.top < innerHeight;
      }));
      check(`${width} ${route}: the scrollbar belongs to the viewport, outside the frame`, await page.evaluate(() => {
        const gutter = innerWidth - document.documentElement.clientWidth, frame = document.querySelector('.app-frame').getBoundingClientRect();
        return gutter >= 0 && frame.right <= document.documentElement.clientWidth + .5 && document.scrollingElement.scrollHeight > innerHeight;
      }));
      await page.evaluate(() => window.scrollTo(0, 0));
      if (width === 390 && route === '/') {
        await page.getByRole('button', { name: 'Menu', exact: true }).click();
        check('mobile drawer opens above page', await page.getByRole('dialog', { name: 'Site navigation' }).isVisible());
        await page.keyboard.press('Escape');
        check('mobile drawer restores focus', await page.getByRole('button', { name: 'Menu', exact: true }).evaluate(el => el === document.activeElement));
      }
      evidence.push({ width, route, ...closed, scrolled });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of [...new Set(tools)]) {
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle' });
    const m = await measure();
    check(`${route}: workspace inherits shared gap`, Math.abs(m.gap - 20) < .1 && m.overflow <= 1);
  }
  writeFileSync(join(OUT, 'measurements.json'), JSON.stringify(evidence, null, 2));
} finally { await browser.close(); await stopServer(server); }
finish();

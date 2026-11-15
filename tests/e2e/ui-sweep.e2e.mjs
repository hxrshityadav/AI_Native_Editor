// Website-wide UI sweep: every public route at seven widths. Captures screenshots and measures layout facts
// (overflow, clipped text, small touch targets, off-scale spacing, heavy weights, tracked uppercase, emoji) in a real browser.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, startServer, stopServer } from './helpers.mjs';

const OUT = join(ROOT, process.env.SWEEP_OUT || 'output/ui-sweep'), PORT = Number(process.env.SWEEP_PORT || 3201), BASE = `http://localhost:${PORT}`;
const WIDTHS = (process.env.SWEEP_WIDTHS || '1920,1440,1280,1024,768,390,375').split(',').map(Number);
const SHOTS = new Set((process.env.SWEEP_SHOTS || '1440,768,390').split(',').map(Number));
mkdirSync(OUT, { recursive: true });
const server = await startServer(PORT);
const browser = await chromium.launch({ channel: 'chrome' });
const report = [];
try {
  const sitemapRoutes = await (async () => { const p = await browser.newPage(); await p.goto(`${BASE}/tools`); const hrefs = await p.$$eval('a[href^="/tools/"]', as => [...new Set(as.map(a => a.getAttribute('href')))]); await p.close(); return hrefs; })();
  const routes = ['/', '/tools', '/command-center', '/privacy', '/supported-formats', ...sitemapRoutes.sort()];
  writeFileSync(join(OUT, 'routes.json'), JSON.stringify(routes, null, 1));
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, colorScheme: 'dark' });
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    for (const route of routes) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const facts = await page.evaluate(() => {
        const out = { overflow: document.documentElement.scrollWidth - innerWidth, clipped: [], small: [], offScale: {}, heavy: [], tracked: [], emoji: [] };
        const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const label = el => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
        for (const el of document.querySelectorAll('main *, header *, nav *, footer *')) {
          if (!visible(el)) continue;
          const s = getComputedStyle(el), r = el.getBoundingClientRect();
          if (/^(A|BUTTON|SUMMARY|SELECT|INPUT)$/.test(el.tagName) && el.type !== 'hidden' && !el.classList.contains('sr-only') && (r.height < 24 || r.width < 24) && s.position !== 'absolute') out.small.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
          if (el.children.length === 0 && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1 && s.overflow !== 'visible' && s.textOverflow !== 'ellipsis') out.clipped.push(label(el));
          for (const prop of ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) {
            const v = parseFloat(s[prop]); if (v > 2 && v % 4 !== 0 && Math.abs(v - Math.round(v)) < 0.01) out.offScale[`${prop}:${v}`] = (out.offScale[`${prop}:${v}`] || 0) + 1;
          }
          if (el.children.length === 0 && el.textContent.trim() && Number(s.fontWeight) >= 700) out.heavy.push(`${label(el)} ${s.fontWeight}`);
          if (el.children.length === 0 && el.textContent.trim() && s.textTransform === 'uppercase' && parseFloat(s.letterSpacing) > 0.5) out.tracked.push(label(el));
          if (parseFloat(s.fontSize) < 16 && parseFloat(s.letterSpacing) < -0.1 && el.children.length === 0 && el.textContent.trim()) out.tracked.push(`neg-tracking:${label(el)}`);
        }
        const text = document.body.innerText; const emoji = text.match(/\p{Extended_Pictographic}/gu); if (emoji) out.emoji = [...new Set(emoji)];
        out.h1 = document.querySelectorAll('h1').length;
        const main = document.querySelector('main')?.getBoundingClientRect(), head = document.querySelector('.top-bar')?.getBoundingClientRect();
        out.mainX = main && [Math.round(main.left), Math.round(main.right)]; out.headX = head && [Math.round(head.left), Math.round(head.right)];
        return out;
      });
      const slug = route === '/' ? 'home' : route.slice(1).replace(/\//g, '-');
      if (SHOTS.has(width)) await page.screenshot({ path: join(OUT, `${slug}-${width}.png`), fullPage: false });
      report.push({ route, width, ...facts, small: facts.small.slice(0, 12), clipped: facts.clipped.slice(0, 12), heavy: [...new Set(facts.heavy)].slice(0, 12), tracked: [...new Set(facts.tracked)].slice(0, 12), errors: errors.splice(0) });
    }
    await context.close();
  }
} finally { await browser.close(); stopServer(server); }
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
const bad = report.filter(r => r.overflow > 0 || r.clipped.length || r.small.length || r.h1 !== 1 || r.errors.length);
console.log(`${report.length} route×width checks; ${bad.length} with overflow, clipping, small targets, h1≠1 or errors`);
for (const r of bad.slice(0, 60)) console.log(r.route, r.width, JSON.stringify({ overflow: r.overflow, h1: r.h1, clipped: r.clipped.slice(0, 4), small: r.small.slice(0, 4), errors: r.errors.slice(0, 2) }));

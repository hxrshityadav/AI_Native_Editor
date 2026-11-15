import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Run from the repository root with the illustration workshop already running.
const origin = process.argv[2] || 'http://127.0.0.1:3197';
const out = resolve('public/illustrations');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  for (const width of [520, 358]) {
    await page.setViewportSize({ width, height: 300 });
    for (const scene of ['photo', 'video', 'audio', 'ai']) {
      await page.goto(`${origin}/?scene=${scene}`, { waitUntil: 'networkidle' });
      const decoded = await page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0));
      if (!decoded) throw new Error(`Undecoded source image in ${scene}`);
      const png = resolve(`output/stageshow-${scene}-${width}.png`);
      await page.locator('.ss-fit').screenshot({ path: png });
      const name = `${scene}${width === 358 ? '-compact' : ''}.webp`;
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-c:v', 'libwebp', '-quality', '85', resolve(out, name)]);
      console.log(name);
    }
  }
} finally { await browser.close(); }

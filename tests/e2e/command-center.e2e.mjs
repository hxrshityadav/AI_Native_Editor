// Command Center: palette, favorites, route-only recent activity and blocked storage, in a real browser.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, startServer, stopServer, createChecks } from './helpers.mjs';

const OUT = join(ROOT, 'output/command-center'), PORT = 3194, BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const { check, finish } = createChecks();
const server = await startServer(PORT, { env: { REEL_ENABLE_CLOUD: '' } });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => requests.push(r.url()));

  // Palette: shortcut, filtering, keyboard selection, Escape and focus return.
  await page.goto(`${BASE}/tools`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Control+k');
  const dialog = page.locator('dialog.cc-palette');
  check('palette: Ctrl+K opens one dialog', await dialog.evaluate(d => d.open) && await page.locator('dialog.cc-palette[open]').count() === 1);
  const input = page.getByRole('combobox', { name: 'Search commands' });
  check('palette: search field has focus', await input.evaluate(el => el === document.activeElement));
  await input.fill('gif');
  const first = await page.locator('.cc-command-results li').first().innerText();
  check('palette: search filters the real catalog', /Video to GIF/.test(first), first);
  await page.keyboard.press('Escape');
  check('palette: Escape closes it', !(await dialog.evaluate(d => d.open)));
  await page.getByRole('button', { name: 'Open command palette' }).first().click();
  await input.fill('heic');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/tools/heic-to-jpg');
  await page.getByRole('heading', { level: 1, name: /HEIC/ }).waitFor();
  await page.waitForFunction(() => (localStorage.getItem('rf-command-workspace-v1') || '').includes('heic-to-jpg'));
  check('palette: Enter opens the selected tool', page.url().endsWith('/tools/heic-to-jpg'));

  // Recent activity is recorded from real navigation, route only.
  await page.goto(`${BASE}/command-center#recent`, { waitUntil: 'networkidle' });
  const recentText = await page.locator('.cc-main').innerText();
  check('recent: visited tools are listed', /HEIC to JPG/.test(recentText) && /Opened/.test(recentText));
  const stored = await page.evaluate(() => localStorage.getItem('rf-command-workspace-v1'));
  check('recent: storage holds routes and times only', !!stored && !/name|blob|\.jpg|\.heic"/i.test(stored.replace(/\/tools\/[a-z0-9-]+/g, '')), stored);

  // Favorites persist across a reload and can be cleared.
  await page.goto(`${BASE}/command-center#all`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Pin Image Compressor' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.goto(`${BASE}/command-center#favorites`, { waitUntil: 'networkidle' });
  check('favorites: pin survives reload', await page.getByRole('button', { name: 'Unpin Image Compressor' }).count() === 1);
  await page.screenshot({ path: join(OUT, 'favorites-1440.png'), fullPage: true });
  await page.getByRole('button', { name: 'Clear favorites' }).click();
  check('favorites: clear removes pins', await page.getByRole('button', { name: 'Unpin Image Compressor' }).count() === 0);

  // Settings: pausing history stops new records.
  await page.goto(`${BASE}/command-center#settings`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Clear history' }).click();
  await page.getByLabel('Remember recently opened tools').uncheck();
  await page.goto(`${BASE}/tools/trim-video`, { waitUntil: 'networkidle' });
  const paused = JSON.parse(await page.evaluate(() => localStorage.getItem('rf-command-workspace-v1')));
  check('settings: paused history records nothing new', paused.recent.length === 0 && paused.recordHistory === false);

  // Category views and phone layout.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/command-center#audio`, { waitUntil: 'networkidle' });
  const heading = await page.getByRole('heading', { level: 2 }).first().innerText();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check('phone: category view opens from hash with no overflow', /Audio/.test(heading) && overflow === 0, `${heading} ${overflow}`);
  await page.screenshot({ path: join(OUT, 'audio-390.png'), fullPage: true });

  check('no browser exceptions', errors.length === 0, errors.join(' | '));
  check('same-origin requests only', requests.every(url => url.startsWith(BASE) || /^(data|blob):/.test(url)));

  // Blocked storage: the page explains it and still works for the session.
  const blocked = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); });
  const bp = await blocked.newPage();
  await bp.goto(`${BASE}/command-center#all`, { waitUntil: 'networkidle' });
  check('blocked storage: recovery message shown', /Browser storage is unavailable/.test(await bp.locator('main').innerText()));
  await bp.getByRole('button', { name: 'Pin Trim Video' }).click();
  check('blocked storage: pinning still works in the session', await bp.getByRole('button', { name: 'Unpin Trim Video' }).count() === 1);
  await blocked.close();
} finally {
  await browser.close();
  stopServer(server);
}
finish();

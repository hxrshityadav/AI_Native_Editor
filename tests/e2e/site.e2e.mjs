import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, createChecks } from "./helpers.mjs";

// Public site shell: navigation, keyboard access, responsive layout and request isolation.
const OUT = join(ROOT, process.env.SITE_TEST_OUT || "output/site"), PORT = Number(process.env.REEL_E2E_PORT || process.env.SITE_TEST_PORT || 3160), BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const { check, finish } = createChecks();
const server = await startServer(PORT);
const browser = await chromium.launch({ channel: "chrome" });
const ROUTES = ["/", "/tools", "/tools/image-compressor", "/tools/image-resizer", "/tools/image-converter", "/tools/video-compressor", "/privacy", "/supported-formats"];
const WIDTHS = [[320, 640], [390, 844], [768, 1024], [1280, 900], [1920, 1080]];

try {
  for (const scheme of ["light", "dark"]) {
    const context = await browser.newContext({ colorScheme: scheme });
    const requests = [], problems = [];
    context.on("request", req => requests.push(req.url()));
    const page = await context.newPage();
    page.on("console", msg => { if (msg.type() === "error") problems.push(msg.text()); });
    page.on("pageerror", error => problems.push(error.message));
    for (const route of ROUTES) for (const [width, height] of WIDTHS) {
      if (scheme === "dark" && width !== 390 && width !== 1280) continue;
      await page.setViewportSize({ width, height }); await page.goto(BASE + route, { waitUntil: "networkidle" });
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, h1: document.querySelectorAll("h1").length,
        small: [...document.querySelectorAll("header a, footer a, main a:not(p a), main button, main summary")].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 32; }).map(el => el.textContent.trim()).slice(0, 5) }));
      check(`${scheme} ${route} @${width}: no horizontal overflow and one h1`, layout.overflow <= 0 && layout.h1 === 1, JSON.stringify(layout));
      if (width <= 390) check(`${scheme} ${route} @${width}: touch targets at least 32 px tall`, layout.small.length === 0, layout.small.join(", "));
      if (width === 390 || width === 1280) await page.screenshot({ path: join(OUT, `${scheme}${route === "/" ? "-home" : route.replaceAll("/", "-")}-${width}.png`), fullPage: true });
    }
    check(`${scheme}: no console or hydration errors`, problems.length === 0, problems.slice(0, 3).join(" | "));
    check(`${scheme}: only same-origin requests`, requests.every(url => url.startsWith(BASE) || /^(blob:|data:)/.test(url)), requests.find(url => !url.startsWith(BASE)));
    check(`${scheme}: public utility pages never load editor, AI or PDF runtimes`, requests.every(url => !/\/(?:editor|editor-models|local-ai|local-models|pdfjs)\//.test(url)));
    await context.close();
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/tools");
  await page.keyboard.press("Tab");
  check("keyboard: first Tab reaches a visible skip link", await page.evaluate(() => document.activeElement?.textContent === "Skip to content" && document.activeElement.getBoundingClientRect().width > 1));
  await page.keyboard.press("Enter"); await page.keyboard.press("Tab");
  check("keyboard: skip link moves focus past the navigation", await page.evaluate(() => !document.activeElement?.closest("header, aside")));
  const side = page.getByRole("navigation", { name: "Main" });
  const RAIL = ["Home", "All tools", "Command Center", "Photo tools", "Video tools", "Audio tools", "AI tools", "Supported formats", "Privacy"];
  check("rail: names every main destination and marks the current page", (await side.getByRole("link").evaluateAll(links => links.map(link => link.getAttribute("aria-label")))).join("|") === RAIL.join("|") && await side.getByRole("link", { name: "All tools" }).getAttribute("aria-current") === "page");
  await page.locator("main h1").click(); await page.mouse.move(1000,700); await page.waitForTimeout(600);
  const rest = await page.locator("main").evaluate(el => el.getBoundingClientRect().left);
  const railGeometry = await page.locator(".app-frame").evaluate(el => { const s = getComputedStyle(el); return { expanded: parseFloat(s.getPropertyValue("--rail-capsule-expanded")), delta: parseFloat(s.getPropertyValue("--rail-capsule-expanded")) - parseFloat(s.getPropertyValue("--rail-capsule")) }; });
  await side.getByRole("link", { name: "Video tools", exact: true }).hover(); await page.waitForTimeout(400);
  check("rail: hover expands the shared layout", await page.locator("#desktop-navigation").evaluate(el=>el.getBoundingClientRect().width)===railGeometry.expanded && await page.locator("main").evaluate(el=>el.getBoundingClientRect().left)===rest+railGeometry.delta);
  await page.mouse.move(1000,700); await page.waitForTimeout(600);
  check("rail: leaving collapses after delay",await page.locator("#desktop-navigation").evaluate(el=>el.getBoundingClientRect().width)===56);
  await side.getByRole("link",{name:"Home",exact:true}).focus(); await page.waitForTimeout(300);
  check("rail: keyboard focus expands the layout",await page.locator("#desktop-navigation").evaluate(el=>el.getBoundingClientRect().width)===railGeometry.expanded && await page.locator("main").evaluate(el=>el.getBoundingClientRect().left)===rest+railGeometry.delta);
  await page.locator("main h1").click();  check("dark surfaces: html is dark and theme-color matches", await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme === "dark" && document.querySelector("meta[name=theme-color]")?.getAttribute("content") === "#0a0a0b"));
  await page.keyboard.press("Shift"); // keyboard modality, so :focus-visible applies to the programmatic focus below
  const outline = await page.getByRole("link", { name: "Video", exact: false }).first().evaluate(el => { el.focus(); return getComputedStyle(el).outlineStyle; });
  check("focus: keyboard focus has a visible outline", outline !== "none");
  await page.getByRole("group", { name: "Filter by category" }).getByRole("button", { name: /Audio/ }).click();
  check("directory: category filter shows only that category's tools", await page.locator("main .category-tools a").count() === 11);
  await page.getByRole("group", { name: "Filter by category" }).getByRole("button", { name: /AI tools/ }).click();
  check("directory: local AI tools expose four entries without planned placeholders", await page.locator("main").getByText("Planned, not available yet").count() === 0 && await page.locator("main .category-tools a").count() === 4);
  await page.getByRole("group", { name: "Filter by category" }).getByRole("button", { name: /All/ }).click();
  await page.getByLabel("Search tools").fill("webp");
  const found = await page.locator("main .category-tools a h3").allInnerTexts();
  check("search: matches formats across tools", found.length === 6 && found.every(title => /^(Image|Passport|Background)/.test(title)), found.join(", "));
  await page.getByLabel("Search tools").fill("zzz");
  check("search: no match shows a recovery action", await page.getByText(/No tools match/).isVisible());
  check("search: the query is kept in the URL", new URL(page.url()).searchParams.get("q") === "zzz");
  await page.goto(BASE + "/tools?q=webp"); await page.getByLabel("Search tools").waitFor();
  // The prerendered fallback lists every tool; wait for the URL-aware finder to hydrate before counting.
  await page.waitForFunction(() => document.querySelector("input[aria-label='Search tools']")?.value === "webp" && document.querySelectorAll("main .category-tools a").length < 10);
  check("search: a shared URL restores the filtered view", await page.getByLabel("Search tools").inputValue() === "webp" && await page.locator("main .category-tools a").count() === 6);
  await page.getByLabel("Search tools").fill("zzz");
  await page.getByRole("button", { name: "Clear search" }).click();
  check("search: clearing restores every tool", await page.locator("main .category-tools a").count() === 30);
  for (const href of await page.locator("main a[href^='/'], footer a[href^='/']").evaluateAll(links => [...new Set(links.map(link => link.getAttribute("href").split("#")[0]))])) {
    const response = await fetch(BASE + href); check(`links: ${href} resolves`, response.ok, String(response.status));
  }
  const phone = await browser.newPage({ viewport: { width: 375, height: 740 }, hasTouch: true });
  await phone.goto(BASE + "/"); const menu = phone.getByRole("button", { name: "Menu" }); await menu.click();
  const drawer = phone.getByRole("dialog", { name: "Site navigation" });
  check("mobile nav: menu opens a drawer without overflow", await drawer.isVisible() && await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phone.keyboard.press("Escape");
  check("mobile nav: Escape closes the drawer and returns focus to Menu", !(await drawer.isVisible()) && await menu.evaluate(el => el === document.activeElement));
  await menu.click(); await drawer.getByRole("link", { name: "Resize Image" }).click(); await phone.getByRole("heading", { name: "Image Resizer", exact: true }).waitFor();
  check("mobile nav: links navigate and close the drawer", !(await phone.getByRole("dialog", { name: "Site navigation" }).isVisible()));
  await phone.close();

  await page.goto(BASE + "/tools/image-resizer");
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "probe.png", mimeType: "image/png", buffer: Buffer.from((await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 8; c.height = 4; const x = c.getContext("2d"); x.fillStyle = "#3a7"; x.fillRect(0, 0, 8, 4); return c.toDataURL("image/png"); })).split(",")[1], "base64") });
  await page.getByRole("button", { name: "Resize image", exact: true }).waitFor();
  await page.getByRole("radio", { name: "Percentage" }).check(); await page.getByRole("button", { name: "50%" }).click();
  check("resizer: percentage mode scales both sides", await page.getByLabel("Scale (%)").inputValue() === "50" && (await page.getByText(/^4 × 2 px$/).count()) > 0);
  await page.goto(BASE + "/tools/image-compressor");
  check("tool page: related tools link to other working tools", await page.getByRole("region", { name: "Related tools" }).getByRole("link").count() === 4 && await page.getByText("Runs locally in your browser").isVisible());
  check("workspace: settings stay hidden until a file is chosen", await page.getByRole("button", { name: "Compress image" }).count() === 0 && await page.getByText("Drop your image here").isVisible());
  const png = Buffer.from((await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 120; c.height = 80; const x = c.getContext("2d"); x.fillStyle = "#e63"; x.fillRect(0, 0, 120, 80); x.fillStyle = "#36e"; x.fillRect(30, 20, 60, 40); return c.toDataURL("image/png"); })).split(",")[1], "base64");
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "card.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Compress image", exact: true }).waitFor();
  // Blob previews are allocated in an effect after file inspection commits.
  const originalPreview = page.getByAltText("Original image preview"), thumbnail = page.locator('#workspace img[alt=""]').first();
  await originalPreview.waitFor(); await thumbnail.waitFor();
  await originalPreview.evaluate(image => image.decode()); await thumbnail.evaluate(image => image.decode());
  check("workspace: a chosen file shows a thumbnail, details, preview and controls", await originalPreview.isVisible() && (await page.getByLabel("Original details").innerText()).includes("120 × 80 px") && await thumbnail.isVisible());
  await page.getByRole("radio", { name: "JPEG", exact: true }).check();
  check("format: the segmented choice is a real radio group", await page.getByRole("radio", { name: "JPEG", exact: true }).isChecked() && await page.getByRole("radio", { name: "Original", exact: true }).count() === 1);
  await page.getByLabel("Quality value").fill("60"); await page.getByLabel("Quality value").blur();
  check("quality: the exact percentage drives the slider", await page.getByLabel("Quality ceiling", { exact: true }).inputValue() === "0.6");
  await page.getByRole("group", { name: "Common target sizes" }).getByRole("button", { name: "1 MB" }).click();
  check("target size: quick picks set the amount and unit", await page.getByLabel("Target size (MB, optional)").inputValue() === "1" && await page.getByLabel("Target size unit").inputValue() === "MB");
  check("target size: a target above the original size is explained before processing", await page.getByText(/larger than the original/).isVisible());
  await page.getByRole("button", { name: "Compress image", exact: true }).click(); await page.getByRole("link", { name: "Download compressed image" }).waitFor();
  check("result: saving, comparison table and requested target are reported", await page.getByText(/^(Saved [0-9.]+%|[0-9.]+% larger)$/).first().isVisible() && (await page.getByLabel("Output details").innerText()).includes("1 MB requested") && (await page.getByLabel("Original file").innerText()).includes("120 × 80 px"));
  check("result: focus moves to the result for screen readers", await page.evaluate(() => document.activeElement?.textContent === "Compression result"));
  const slider = page.getByLabel(/Comparison position/);
  await slider.focus(); await page.keyboard.press("ArrowLeft");
  check("result: before/after slider works from the keyboard", await slider.inputValue() === "49");
  await page.getByRole("button", { name: "Adjust settings" }).click();
  check("result: Adjust settings returns to the controls with focus", await page.evaluate(() => document.activeElement?.getAttribute("name") === "output-format") && await page.getByRole("button", { name: "Back to result" }).isVisible());
  await page.getByRole("button", { name: "Back to result" }).click();
  check("result: Back to result keeps the measured output", await page.getByRole("link", { name: "Download compressed image" }).isVisible());
  await page.getByRole("button", { name: "Start over" }).click();
  check("result: Start over returns to the upload stage", await page.getByText("Drop your image here").isVisible() && await page.getByRole("button", { name: "Compress image" }).count() === 0);

  await page.goto(BASE + "/"); await page.getByRole("link", { name: "Explore tools" }).first().click(); await page.getByRole("heading", { name: "Video, audio & photo tools", exact: true }).waitFor();
  check("home: primary action opens the tool directory", true);
  for (const path of ["/studio", "/studio-legacy", "/lab", "/tools/shorts-maker"]) check(`removed: ${path} returns 404`, (await fetch(BASE + path)).status === 404);
  const reduced = await browser.newPage({ reducedMotion: "reduce" }); await reduced.goto(BASE + "/tools", { waitUntil: "networkidle" }); await reduced.getByLabel("Search tools").waitFor();
  const motion = await reduced.locator("main .category-tools a").first().evaluate(el => getComputedStyle(el).transitionDuration);
  check("motion: reduced motion shortens transitions", motion.split(",").every(value => parseFloat(value) < 0.01), motion); await reduced.close();
  await page.close();
} finally { await browser.close(); await stopServer(server); }
finish();






import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, createChecks } from "./helpers.mjs";

// Public site shell: navigation, keyboard access, responsive layout and request isolation.
const OUT = join(ROOT, "output/site"), PORT = Number(process.env.SITE_TEST_PORT || 3160), BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const { check, finish } = createChecks();
const server = await startServer(PORT, { env: { REEL_ENABLE_CLOUD: "" } });
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
    check(`${scheme}: public pages never load the editor runtime`, requests.every(url => !url.includes("/editor/") && !url.includes("/editor-models/")));
    await context.close();
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/tools");
  await page.keyboard.press("Tab");
  check("keyboard: first Tab reaches a visible skip link", await page.evaluate(() => document.activeElement?.textContent === "Skip to content" && document.activeElement.getBoundingClientRect().width > 1));
  await page.keyboard.press("Enter"); await page.keyboard.press("Tab");
  check("keyboard: skip link moves focus past the navigation", await page.evaluate(() => !document.activeElement?.closest("header, aside")));
  const side = page.getByRole("navigation", { name: "Main" });
  check("sidebar: lists every working tool and marks the current page", await side.getByRole("link").count() === 3 + 4 && await side.getByRole("link", { name: "All tools" }).getAttribute("aria-current") === "page");
  check("sidebar: no placeholder or future tools are listed", (await side.getByRole("link").allInnerTexts()).every(name => ["Home", "All tools", "Studio", "Image Compressor", "Image Resizer", "Image Format Converter", "Video Compressor"].includes(name.trim())));
  const outline = await page.getByRole("link", { name: "Video", exact: false }).first().evaluate(el => { el.focus(); return getComputedStyle(el).outlineStyle; });
  check("focus: keyboard focus has a visible outline", outline !== "none");
  await page.getByRole("group", { name: "Filter by category" }).getByRole("button", { name: /Audio/ }).click();
  check("directory: empty audio category explains itself without placeholder tools", await page.getByText(/No standalone audio tools yet/).isVisible() && await page.locator("main ul a").count() === 0);
  await page.getByRole("group", { name: "Filter by category" }).getByRole("button", { name: /All/ }).click();
  await page.getByLabel("Search tools").fill("webp");
  const found = await page.locator("main ul a h3").allInnerTexts();
  check("search: matches formats across tools", found.length === 3 && found.every(title => title.startsWith("Image")), found.join(", "));
  await page.getByLabel("Search tools").fill("zzz");
  check("search: no match shows a recovery action", await page.getByText(/No tools match/).isVisible());
  await page.getByRole("button", { name: "Clear search" }).click();
  check("search: clearing restores every tool", await page.locator("main ul a").count() === 5);
  for (const href of await page.locator("main a[href^='/'], footer a[href^='/']").evaluateAll(links => [...new Set(links.map(link => link.getAttribute("href").split("#")[0]))])) {
    const response = await fetch(BASE + href); check(`links: ${href} resolves`, response.ok, String(response.status));
  }
  const phone = await browser.newPage({ viewport: { width: 375, height: 740 }, hasTouch: true });
  await phone.goto(BASE + "/"); const menu = phone.getByRole("button", { name: "Menu" }); await menu.click();
  const drawer = phone.getByRole("dialog", { name: "Site navigation" });
  check("mobile nav: menu opens a drawer without overflow", await drawer.isVisible() && await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phone.keyboard.press("Escape");
  check("mobile nav: Escape closes the drawer and returns focus to Menu", !(await drawer.isVisible()) && await menu.evaluate(el => el === document.activeElement));
  await menu.click(); await drawer.getByRole("link", { name: "Image Resizer" }).click(); await phone.getByRole("heading", { name: "Image Resizer", exact: true }).waitFor();
  check("mobile nav: links navigate and close the drawer", !(await phone.getByRole("dialog", { name: "Site navigation" }).isVisible()));
  await phone.close();

  await page.goto(BASE + "/tools/image-compressor");
  check("workspace: settings stay hidden until a file is chosen", await page.getByRole("complementary", { name: "Settings" }).count() === 0);
  const png = Buffer.from((await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 120; c.height = 80; const x = c.getContext("2d"); x.fillStyle = "#e63"; x.fillRect(0, 0, 120, 80); x.fillStyle = "#36e"; x.fillRect(30, 20, 60, 40); return c.toDataURL("image/png"); })).split(",")[1], "base64");
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "card.png", mimeType: "image/png", buffer: png });
  await page.getByRole("complementary", { name: "Settings" }).waitFor();
  check("workspace: a chosen file opens preview, settings and a before summary", await page.getByAltText("Original image preview").isVisible() && await page.getByLabel("Original details").isVisible());
  await page.getByRole("group", { name: "Common target sizes" }).getByRole("button", { name: "1 MB" }).click();
  check("target size: quick picks set the amount and unit", await page.getByLabel("Target size (MB, optional)").inputValue() === "1" && await page.getByLabel("Target size unit").inputValue() === "MB");
  check("target size: a target above the original size is explained before processing", await page.getByText(/larger than the original/).isVisible());
  await page.getByRole("group", { name: "Quality preset" }).getByRole("button", { name: "Smaller file" }).click();
  check("quality: presets drive the exact slider", await page.getByLabel("Quality ceiling", { exact: true }).inputValue() === "0.6");
  await page.getByRole("button", { name: "Compress image", exact: true }).click(); await page.getByRole("link", { name: "Download image" }).waitFor();
  check("result: comparison reports saving and the requested target", /Saved|larger/.test(await page.getByRole("region", { name: "Result" }).innerText()) && (await page.getByLabel("Output details").innerText()).includes("1 MB requested"));
  const slider = page.getByLabel(/Comparison position/);
  await slider.focus(); await page.keyboard.press("ArrowLeft");
  check("result: before/after slider works from the keyboard", await slider.inputValue() === "49");
  await page.getByRole("button", { name: "Adjust settings" }).click();
  check("result: Adjust settings moves focus into the settings panel", await page.evaluate(() => !!document.activeElement?.closest("aside")));
  await page.getByRole("button", { name: "Compress another image" }).click();
  check("result: Compress another image returns to the upload stage", await page.getByText("Drop an image here").isVisible() && await page.getByRole("complementary", { name: "Settings" }).count() === 0);

  await page.goto(BASE + "/"); await page.getByRole("link", { name: "Browse tools" }).click(); await page.getByRole("heading", { name: "Photo and video tools", exact: true }).waitFor();
  check("home: primary action opens the tool directory", true);
  const studio = await (await fetch(BASE + "/studio")).text(), legacy = await (await fetch(BASE + "/studio-legacy")).text(), lab = await (await fetch(BASE + "/lab")).text();
  check("SEO: editor, legacy and lab keep noindex", [studio, legacy, lab].every(html => /name="robots" content="noindex/.test(html)));
  check("isolation: editor, legacy and lab render without the public site shell", [studio, legacy, lab].every(html => !html.includes("Skip to content")));
  const reduced = await browser.newPage({ reducedMotion: "reduce" }); await reduced.goto(BASE + "/tools");
  check("motion: reduced motion shortens transitions", await reduced.locator("main ul a").first().evaluate(el => parseFloat(getComputedStyle(el).transitionDuration) < 0.01)); await reduced.close();
  await page.close();
} finally { await browser.close(); await stopServer(server); }
finish();

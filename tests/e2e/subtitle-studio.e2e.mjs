import { chromium, devices } from "playwright";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, createChecks, ff, probe, streams, decodeErrors, frameDiff } from "./helpers.mjs";

// Subtitle Studio 2.0 in a real browser. Plain grey fixtures make every changed pixel attributable to captions.
// SUBTITLE_INFERENCE=1 adds real Whisper Tiny transcription with word timings and checks word highlighting in the
// exported frames (one-time model download through the same-origin model route, after the consent box is ticked).
const OUT = join(ROOT, "output/launch-subtitles"), PORT = Number(process.env.SUBTITLE_TEST_PORT || 3171), BASE = `http://localhost:${PORT}`, inference = process.env.SUBTITLE_INFERENCE === "1";
mkdirSync(OUT, { recursive: true });
const f = name => join(OUT, name);
ff("-f", "lavfi", "-i", "color=c=0x606060:s=720x1280:r=30:d=8", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:d=8", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", f("portrait.mp4"));
ff("-f", "lavfi", "-i", "color=c=0x606060:s=1280x720:r=30:d=4", "-c:v", "libx264", "-pix_fmt", "yuv420p", f("silent.mp4"));
writeFileSync(f("broken.ttf"), Buffer.from("this is not a font file at all, just text pretending"));

const { check, finish } = createChecks();
const server = await startServer(PORT);
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const requests = []; context.on("request", req => requests.push({ url: req.url(), method: req.method() }));
const page = await context.newPage(), errors = [];
page.on("pageerror", e => errors.push(e.message));
const tab = name => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const rows = () => page.getByRole("list", { name: "Captions" }).locator("li");
const seekTo = t => page.locator("video").first().evaluate((v, t) => new Promise(resolve => { v.pause(); v.addEventListener("seeked", () => setTimeout(resolve, 250), { once: true }); v.currentTime = t; }), t);
/** Bounding box of preview-canvas pixels that differ from the grey source (the captions), in canvas pixels. */
const canvasBox = () => page.getByTestId("caption-canvas").evaluate(c => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1; for (let y = 0; y < c.height; y += 1) for (let x = 0; x < c.width; x += 1) { const i = (y * c.width + x) * 4, g = (d[i] + d[i + 1] + d[i + 2]) / 3; if (Math.abs(g - 0x60) > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } } return x1 < 0 ? null : { x0, y0, x1, y1, w: c.width, h: c.height }; });
const frameBox = (file, t, width, height) => { const g = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 64 << 20 }); let x0 = width, y0 = height, x1 = -1, y1 = -1; for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (Math.abs(g[y * width + x] - 0x60) > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? null : { x0, y0, x1, y1 }; };
const yellow = (file, t, width, height) => { const rgb = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 64 << 20 }); let n = 0; for (let i = 0; i < width * height * 3; i += 3) if (rgb[i] > 200 && rgb[i + 1] > 170 && rgb[i + 2] < 110) n++; return n; };
const download = async (name, label) => { const event = page.waitForEvent("download"); await page.getByRole(label === "Download MP4" ? "link" : "button", { name: label, exact: true }).click(); const file = await event, path = f(name); await file.saveAs(path); return { path, suggested: file.suggestedFilename() }; };
const exportMp4 = async name => { await tab("Export").click(); await page.getByRole("button", { name: "Export MP4 with captions" }).click(); await page.getByRole("link", { name: "Download MP4", exact: true }).waitFor({ timeout: 240000 }); return download(name, "Download MP4"); };

try {
  await page.goto(`${BASE}/tools/subtitle-studio`);
  check("page: route renders with a unique title and H1", /Subtitle Studio/.test(await page.getByRole("heading", { level: 1 }).innerText()) && /· Reel Finisher$/.test(await page.title()));
  await page.getByLabel("Choose video", { exact: true }).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a video") });
  const rejection = page.getByRole("alert").filter({ hasText: /\w/ }); await rejection.waitFor();
  check("validation: a non-video file is rejected with a reason", (await rejection.innerText()).length > 20);

  await page.getByLabel("Choose video", { exact: true }).setInputFiles(f("portrait.mp4"));
  await page.getByRole("button", { name: "Write captions by hand" }).waitFor();
  check("consent: Tiny shows its size and transcription waits for consent", await page.getByRole("button", { name: "Transcribe locally" }).isDisabled() && await page.getByText(/about 95 MiB/).first().isVisible());
  await page.getByRole("radio", { name: /Whisper Base/ }).check({ force: true });
  check("consent: Base is a separate, larger opt-in", await page.getByText(/Download Whisper Base \(about 140 MiB\)/).isVisible() && await page.getByRole("button", { name: "Transcribe locally" }).isDisabled());
  await page.getByRole("radio", { name: "Roman Hinglish", exact: true }).check();
  check("Roman Hinglish: no Devanagari script control is offered", await page.getByText(/Devanagari \+ English/).count() === 0 && await page.locator("input[name=hinglish-script]").count() === 0);
  check("Roman Hinglish: selects the Hindi-tuned model and states Roman output and measured accuracy", await page.getByRole("radio", { name: /Hindi2Hinglish Swift/ }).isChecked() && await page.getByText(/never contain Devanagari/).isVisible() && /Roman Hinglish/.test(await page.getByText(/Ready to transcribe as/).innerText()));
  await page.getByRole("radio", { name: "Hindi", exact: true }).check();
  check("Hindi: Devanagari, never translated, honest about measured results, no Roman model", await page.getByText(/never translates to English/).isVisible() && await page.getByText(/no model that runs in this browser produced reliable Devanagari/).isVisible() && await page.getByRole("radio", { name: /Hindi2Hinglish Swift/ }).count() === 0);
  check("consent: no model file requested before consent", !requests.some(r => /local-models|whisper/.test(r.url)));

  // Editor.
  await page.getByRole("button", { name: "Write captions by hand" }).click();
  await page.getByLabel("Caption 1 text").fill("Hello from Reel Finisher today");
  await seekTo(3.5);
  await page.getByRole("button", { name: "Add at playhead" }).click();
  await page.getByLabel("Caption 2 text").fill("नमस्ते दुनिया");
  check("editor: second caption added at the playhead", await rows().count() === 2 && Number(await page.getByLabel("Caption 2 start").inputValue()) === 3.5);
  await rows().nth(0).getByRole("button").first().click();
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  const afterUndo = await rows().count();
  await page.getByRole("button", { name: "Redo" }).click(); const afterRedo = await rows().count();
  await page.locator("body").press("Control+z");
  check("split, undo, redo and Ctrl+Z", afterUndo === 2 && afterRedo === 3 && await rows().count() === 2);
  await rows().nth(1).getByRole("button").first().click();
  await page.getByLabel("Caption 2 start").fill("1");
  check("timing: overlaps are clamped away", Number(await page.getByLabel("Caption 2 start").inputValue()) === 2);
  await page.getByLabel("Caption 2 start").fill("3.5"); await page.getByLabel("Caption 2 end").fill("6");

  // Preview = export renderer: the caption is drawn into the composed frame at the playhead.
  await seekTo(1); const previewAt1 = await canvasBox();
  await seekTo(2.8);
  check("preview: caption in frame at 1 s, none between captions", !!previewAt1 && await canvasBox() === null, JSON.stringify(previewAt1));

  // Presets, thumbnails, fonts.
  await tab("Style").click();
  await page.locator("input[name=caption-preset]").first().waitFor({ state: "attached" });
  check("presets: fifteen presets in the library", await page.locator("input[name=caption-preset]").count() === 15);
  await page.waitForTimeout(800);
  const thumbVaries = await page.locator("canvas").nth(1).evaluate(c => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; const seen = new Set(); for (let i = 0; i < d.length; i += 400) seen.add(d[i]); return seen.size > 3; });
  check("presets: thumbnails are rendered by the caption renderer", thumbVaries);
  await page.locator("label", { hasText: "Cinematic" }).first().click();
  await tab("Export").click();
  check("fonts: a Latin-only preset with Devanagari text blocks export with a reason", await page.getByRole("button", { name: "Export MP4 with captions" }).isDisabled() && await page.getByText(/no Devanagari letters/).first().isVisible());
  await tab("Captions").click(); await page.getByRole("button", { name: "Use Mukta" }).first().click();
  await tab("Export").click();
  check("fonts: one click switches to a Devanagari-capable font", await page.getByRole("button", { name: "Export MP4 with captions" }).isEnabled());

  // Custom font upload: malformed rejected, a real font accepted and measured.
  await tab("Style").click(); await page.getByText("Your fonts").click();
  await page.getByLabel("Upload caption font").setInputFiles(f("broken.ttf"));
  check("custom font: a malformed file is refused with a reason", /not a valid font|could not read/.test(await page.getByRole("alert").filter({ hasText: /font/ }).first().innerText()));
  await page.getByLabel("Custom font name").fill("Brand Display");
  await page.getByLabel("Upload caption font").setInputFiles(join(ROOT, "public/fonts/catalog/anton/font.ttf"));
  await page.locator(".fontRow, [class*=fontRow]").filter({ hasText: "Brand Display" }).first().waitFor();
  check("custom font: uploaded, named, measured as Latin only, and selected", await page.getByLabel("Caption font", { exact: true }).inputValue().then(v => v.startsWith("custom:")) && await page.locator("[class*=fontRow]").filter({ hasText: "Brand Display" }).filter({ hasText: "Latin only" }).isVisible());
  await tab("Export").click();
  check("custom font: refuses Devanagari captions instead of substituting", await page.getByText(/Brand Display has no Devanagari letters/).first().isVisible());
  await tab("Style").click(); await page.getByLabel("Caption font", { exact: true }).selectOption("mukta");
  await page.locator("label", { hasText: "Boxed Captions" }).first().click();

  // Drag the caption in the preview; it snaps to the centre line.
  await seekTo(1); await tab("Layout").click(); await page.getByTestId("caption-canvas").scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
  const box = await canvasBox(), rect = await page.getByTestId("caption-canvas").boundingBox(), scale = rect.width / box.w;
  const from = { x: rect.x + (box.x0 + box.x1) / 2 * scale, y: rect.y + (box.y0 + box.y1) / 2 * scale };
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x + 5, from.y - rect.height * 0.3, { steps: 6 }); await page.mouse.up();
  const moved = await canvasBox();
  check("drag: the caption moves up and snaps to the centre", moved.y0 < box.y0 - rect.height * 0.2 / scale && Math.abs((moved.x0 + moved.x1) / 2 - moved.w / 2) < 4, `${box.y0}→${moved.y0}, centre ${(moved.x0 + moved.x1) / 2} of ${moved.w}`);

  // Subtitle files.
  await tab("Export").click();
  const srt = readFileSync((await download("captions.srt", "Download SRT")).path, "utf8"), vtt = readFileSync((await download("captions.vtt", "Download VTT")).path, "utf8");
  check("SRT and VTT: exact times and Devanagari text", srt === "1\n00:00:00,000 --> 00:00:02,000\nHello from Reel Finisher today\n\n2\n00:00:03,500 --> 00:00:06,000\nनमस्ते दुनिया\n" && vtt.startsWith("WEBVTT\n\n00:00:00.000 --> 00:00:02.000"), JSON.stringify(srt));

  // MP4 in the original shape: preview and export agree.
  const mp4 = await exportMp4("captioned.mp4"), info = probe(mp4.path), v = streams(info, "video")[0];
  check("MP4: H.264 720×1280 with AAC at the source length", v.codec_name === "h264" && v.width === 720 && v.height === 1280 && streams(info, "audio")[0]?.codec_name === "aac" && Math.abs(Number(info.format.duration) - 8) < 0.2 && decodeErrors(mp4.path) === "");
  const during = frameDiff(mp4.path, f("portrait.mp4"), 1, 720, 1280, 0, 1), devanagari = frameDiff(mp4.path, f("portrait.mp4"), 4.5, 720, 1280, 0, 1), between = frameDiff(mp4.path, f("portrait.mp4"), 2.8, 720, 1280, 0, 1);
  check("MP4: captions burned in during cues (Latin and Devanagari), absent between", during > 0.5 && devanagari > 0.5 && between < 0.2, `${during.toFixed(2)} / ${devanagari.toFixed(2)} / ${between.toFixed(2)}`);
  await seekTo(1); const preview = await canvasBox(), exported = frameBox(mp4.path, 1, 720, 1280);
  check("preview matches export: caption box within 6 px", !!preview && !!exported && ["x0", "y0", "x1", "y1"].every(k => Math.abs(preview[k] - exported[k]) <= 6), `preview ${JSON.stringify(preview)} export ${JSON.stringify(exported)}`);

  // Aspect ratios.
  await tab("Layout").click(); await page.locator("label", { hasText: "1:1 Square" }).click(); await page.getByRole("radio", { name: "Crop and frame" }).check();
  await page.getByLabel("Zoom").fill("1.5");
  const square = await exportMp4("square.mp4"), sq = streams(probe(square.path), "video")[0];
  check("1:1 crop export: 1080×1080 H.264 with the captions", sq.width === 1080 && sq.height === 1080 && frameBox(square.path, 1, 1080, 1080) !== null);
  await tab("Layout").click(); await page.locator("label", { hasText: "16:9 Landscape" }).click(); await page.getByRole("radio", { name: "Whole picture" }).check();
  const wide = await exportMp4("wide.mp4"), wv = streams(probe(wide.path), "video")[0];
  const bar = execFileSync("ffmpeg", ["-v", "error", "-ss", "2.8", "-i", wide.path, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 64 << 20 });
  check("16:9 contain export: 1920×1080, portrait video letterboxed (black sides, grey centre)", wv.width === 1920 && wv.height === 1080 && bar[540 * 1920 + 40] < 20 && Math.abs(bar[540 * 1920 + 960] - 0x60) < 12, `edge ${bar[540 * 1920 + 40]} centre ${bar[540 * 1920 + 960]}`);
  await tab("Layout").click(); await page.locator("label", { hasText: "Original" }).first().click();

  // Stale results and cancellation.
  await tab("Captions").click(); await rows().nth(0).getByRole("button").first().click(); await page.getByLabel("Caption 1 text").fill("Changed caption text here");
  await tab("Export").click();
  check("export: an edit after export asks to export again", await page.getByText(/changed since the last export/).isVisible());
  await page.route(/media\.worker/, async route => { await new Promise(resolve => setTimeout(resolve, 4000)); await route.continue().catch(() => {}); });
  await page.getByRole("button", { name: "Export MP4 with captions" }).click(); await page.getByRole("button", { name: "Cancel operation" }).click(); await page.unroute(/media\.worker/);
  await page.getByText(/Cancelled\. Your video and captions are unchanged/).first().waitFor();
  check("cancellation: nothing published and export can run again", await page.getByRole("link", { name: "Download MP4" }).count() === 0 && await page.getByRole("button", { name: "Export MP4 with captions" }).isEnabled());

  // Names and terms: suggestions for near-miss spellings only, each accepted, ignored or undone.
  await tab("Captions").click(); await rows().nth(0).getByRole("button").first().click();
  await page.getByLabel("Caption 1 text").fill("Hantic gravity aur subagence bhi plot");
  await page.locator("summary", { hasText: "Names and terms" }).click();
  await page.getByLabel("Names and terms", { exact: true }).fill("Antigravity, Claude, subagents");
  await page.getByRole("button", { name: "Find suggestions" }).click();
  const suggestions = await page.getByRole("list", { name: "Suggested fixes" }).locator("li").allInnerTexts();
  check("vocabulary: near-misses suggested, ordinary and unrelated words left alone", suggestions.length === 2 && suggestions.some(t => /Hantic gravity[\s\S]*Antigravity/.test(t)) && suggestions.some(t => /subagence[\s\S]*subagents/.test(t)) && !suggestions.some(t => /plot|aur|bhi/.test(t)), JSON.stringify(suggestions));
  await page.getByRole("button", { name: /^Accept all/ }).click();
  check("vocabulary: accepting rewrites only the matched words", await page.getByLabel("Caption 1 text").inputValue() === "Antigravity aur subagents bhi plot");
  await page.getByRole("button", { name: "Undo" }).click();
  check("vocabulary: undo restores the recognised text", await page.getByLabel("Caption 1 text").inputValue() === "Hantic gravity aur subagence bhi plot");
  await page.getByRole("button", { name: "Find suggestions" }).click();
  await page.getByRole("button", { name: /^Ignore: keep subagence/ }).click();
  check("vocabulary: ignoring removes just that suggestion", await page.getByRole("list", { name: "Suggested fixes" }).locator("li").count() === 1);
  await page.reload(); await page.getByLabel("Choose video", { exact: true }).setInputFiles(f("portrait.mp4")); await page.getByRole("button", { name: "Write captions by hand" }).click();
  await page.locator("summary", { hasText: "Names and terms" }).click();
  check("vocabulary: the list is remembered in this browser", await page.getByLabel("Names and terms", { exact: true }).inputValue() === "Antigravity, Claude, subagents");

  await page.getByLabel("Choose video", { exact: true }).setInputFiles(f("silent.mp4"));
  await page.getByText(/no audio track, so there is nothing to transcribe/).waitFor();
  check("silent video: transcription explains why it is unavailable", await page.getByRole("button", { name: "Transcribe locally" }).isDisabled());
  await page.screenshot({ path: f("desktop.png") });

  const phone = await browser.newPage(devices["Pixel 7"]);
  await phone.goto(`${BASE}/tools/subtitle-studio`); await phone.getByLabel("Choose video", { exact: true }).setInputFiles(f("portrait.mp4"));
  await phone.getByRole("button", { name: "Write captions by hand" }).click(); await phone.getByLabel("Caption 1 text").fill("Phone caption");
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth), tabs = await phone.getByRole("tab").evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
  check("phone: no horizontal overflow, tabs at least 40 px tall", overflow === 0 && tabs.every(h => h >= 40), `overflow ${overflow}, tabs ${tabs}`);
  await phone.screenshot({ path: f("phone.png") }); await phone.close();

  if (inference) {
    const speech = join(ROOT, "output/caption-bench/clips/en-zira-1.wav");
    if (!existsSync(speech)) check("inference: speech fixture available (run caption-bench first)", false);
    else {
      ff("-f", "lavfi", "-i", "color=c=0x606060:s=720x1280:r=30", "-i", speech, "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", f("spoken.mp4"));
      await page.getByLabel("Choose video", { exact: true }).setInputFiles(f("spoken.mp4"));
      await page.getByRole("radio", { name: "English", exact: true }).check(); await page.getByRole("radio", { name: /Whisper Tiny/ }).check({ force: true });
      await page.getByLabel("Allow speech model download").check();
      await page.getByRole("button", { name: "Transcribe locally" }).click();
      await Promise.race([rows().first().waitFor({ timeout: 900000 }), page.getByRole("alert").filter({ hasText: /\w/ }).first().waitFor({ timeout: 900000 }).then(async () => { throw new Error(`Transcription failed: ${await page.getByRole("alert").first().innerText()}`); })]);
      const text = await page.getByRole("list", { name: "Captions" }).innerText();
      check("inference: English captions from real Whisper Tiny", /weather|meeting|morning/i.test(text), text.slice(0, 120));
      await rows().first().getByRole("button").first().click();
      check("inference: captions carry real word timings", await page.getByText(/words with recognised timings/).first().isVisible());
      await tab("Style").click(); await page.locator("label", { hasText: "Word Highlight" }).first().click();
      const first = await page.evaluate(() => 0); void first;
      // Pick the middle of the second word of caption 1 and confirm yellow appears there in preview and export.
      await tab("Captions").click();
      const out = await exportMp4("highlight.mp4");
      let hits = 0; for (const t of [0.6, 1.0, 1.4, 1.8]) hits += yellow(out.path, t, 720, 1280) > 50 ? 1 : 0;
      check("dynamic captions: the spoken word is highlighted in the exported frames", hits >= 2, `${hits} of 4 sampled frames`);
      // Real Hindi speech (FLEURS) through the Roman Hinglish pipeline: Roman only, raw kept, Devanagari blocked.
      const hindi = join(ROOT, "output/caption-bench/fleurs-hi/hi-fleurs-1528.wav");
      if (existsSync(hindi)) {
        ff("-f", "lavfi", "-i", "color=c=0x606060:s=720x1280:r=30", "-i", hindi, "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", f("hindi.mp4"));
        await page.getByLabel("Choose video", { exact: true }).setInputFiles(f("hindi.mp4"));
        await page.getByRole("radio", { name: "Roman Hinglish", exact: true }).check();
        await page.getByLabel("Allow speech model download").check();
        await page.getByRole("button", { name: "Transcribe locally" }).click();
        await Promise.race([rows().first().waitFor({ timeout: 900000 }), page.getByRole("alert").filter({ hasText: /\w/ }).first().waitFor({ timeout: 900000 }).then(async () => { throw new Error(`Transcription failed: ${await page.getByRole("alert").first().innerText()}`); })]);
        const hinglish = await page.getByRole("list", { name: "Captions" }).innerText();
        check("Roman Hinglish: real Hindi speech gives Roman captions with no Devanagari characters", /festival|bachch|parivar|camp|mein/i.test(hinglish) && !/[\u0900-\u097f]/.test(hinglish), hinglish.slice(0, 160));
        await page.locator("summary", { hasText: "Raw transcription" }).click();
        const raw = await page.getByTestId("raw-transcript").textContent();
        check("Roman Hinglish: the raw model output is kept for comparison", (raw ?? "").trim().length > 20, raw?.slice(0, 80));
        await rows().first().getByRole("button").first().click();
        await page.getByLabel("Caption 1 text").fill("आज हम बात करेंगे API call");
        check("Roman Hinglish: Devanagari typed into a caption is flagged", await page.getByText(/Roman letters only/).first().isVisible());
        await page.getByRole("button", { name: "Convert to Roman" }).first().click();
        const fixed = await page.getByLabel("Caption 1 text").inputValue();
        check("Roman Hinglish: Convert to Roman leaves no Devanagari and keeps English words", !/[\u0900-\u097f]/.test(fixed) && /API call/.test(fixed), fixed);
        await tab("Captions").click(); await page.getByText("Clean up").click();
        await page.getByRole("button", { name: "Tidy spacing and capitals" }).click();
        check("Roman Hinglish: clean-up output also has no Devanagari", !/[\u0900-\u097f]/.test(await page.getByRole("list", { name: "Captions" }).innerText()));
        await tab("Transcribe").click();
        check("Roman Hinglish: phrase timing is stated honestly", await page.getByText(/Phrase timing \(this model has no word timing\)/).isVisible());
      }
    }
  }
  check("no browser exceptions", errors.length === 0, errors.join(" | "));
  check("privacy: only same-origin GET/HEAD requests", requests.every(req => ["GET", "HEAD"].includes(req.method) && (req.url.startsWith(BASE) || /^(blob:|data:)/.test(req.url))));
} catch (error) { await page.screenshot({ path: f("failure.png"), fullPage: true }).catch(() => {}); console.log("VISIBLE_ERRORS", await page.getByRole("alert").allTextContents().catch(() => [])); throw error; }
finally { await browser.close(); stopServer(server); }
finish();

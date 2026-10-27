import { chromium, firefox, devices } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, createChecks, probe, streams } from "./helpers.mjs";

const OUT = join(ROOT, process.env.PHOTO_TEST_DIR || "output/launch-photos"), PORT = Number(process.env.PHOTO_TEST_PORT || 3150), BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const { check, finish } = createChecks();
const server = await startServer(PORT, { env: { REEL_ENABLE_CLOUD: "" } });
const browser = process.env.PHOTO_BROWSER === "firefox" ? await firefox.launch({ executablePath: join(ROOT, "output/firefox-test/firefox/firefox.exe") }) : await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
const requests = []; context.on("request", req => requests.push({ url: req.url(), method: req.method() }));
await context.addInitScript(() => {
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  window.photoUrls = new Set();
  URL.createObjectURL = blob => { const url = create(blob); window.photoUrls.add(url); return url; };
  URL.revokeObjectURL = url => { window.photoUrls.delete(url); revoke(url); };
});
const page = await context.newPage();
const upload = (file) => page.getByLabel("Choose image", { exact: true }).setInputFiles(file);
const complete = async (action) => { await page.getByRole("button", { name: action, exact: true }).click(); await page.getByRole("link", { name: "Download result", exact: true }).waitFor(); };
async function download(name) {
  const event = page.waitForEvent("download"); await page.getByRole("link", { name: "Download result", exact: true }).click();
  const file = await event, path = join(OUT, name); await file.saveAs(path); return { path, suggested: file.suggestedFilename() };
}
const pixels = path => execFileSync("ffmpeg", ["-v", "error", "-i", path, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 4 * 1024 * 1024 });
const dimensions = path => { const stream = streams(probe(path), "video")[0]; return [stream.width, stream.height]; };
const measuredBytes = text => Number(text.match(/([\d,\s]+) bytes/)?.[1].replace(/\D/g, ""));

try {
  await page.goto(BASE + "/tools/image-compressor");
  const fixtures = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 600; canvas.height = 400;
    const ctx = canvas.getContext("2d"), image = ctx.createImageData(600,400); let random = 12345;
    for (let i = 0; i < image.data.length; i += 4) { random = (Math.imul(random,1664525) + 1013904223) >>> 0; image.data[i]=random & 255; image.data[i+1]=random >>> 8 & 255; image.data[i+2]=random >>> 16 & 255; image.data[i+3]=255; }
    ctx.putImageData(image,0,0); const noise = canvas.toDataURL("image/png");
    canvas.width=96; canvas.height=64; ctx.fillStyle="#ff0000"; ctx.globalAlpha=0.5; ctx.fillRect(24,0,24,64); ctx.globalAlpha=1; ctx.fillRect(48,0,48,64); const transparent=canvas.toDataURL("image/png");
    canvas.width=6; canvas.height=4; ctx.fillStyle="#ff0000"; ctx.fillRect(0,0,3,4); ctx.fillStyle="#0000ff"; ctx.fillRect(3,0,3,4); const jpeg=canvas.toDataURL("image/jpeg",1);
    return { noise, transparent, jpeg };
  });
  const noise = join(OUT, "noise.png"), transparent = join(OUT, "transparent.png"), oriented = join(OUT, "oriented.jpg");
  writeFileSync(noise, Buffer.from(fixtures.noise.split(",")[1],"base64")); writeFileSync(transparent, Buffer.from(fixtures.transparent.split(",")[1],"base64"));
  const jpg = Buffer.from(fixtures.jpeg.split(",")[1],"base64");
  // EXIF orientation 6: rotate a 6x4 raster clockwise into a 4x6 portrait.
  const exif = Buffer.from([0xff,0xe1,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,0x12,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
  writeFileSync(oriented, Buffer.concat([jpg.subarray(0,2),exif,jpg.subarray(2)]));
  const transfer = await page.evaluateHandle(encoded => { const dt = new DataTransfer(); dt.items.add(new File([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],"noise.png",{type:"image/png"})); return dt; }, readFileSync(noise).toString("base64"));
  await page.getByRole("region", { name: "Image Compressor workspace", exact: true }).locator("div").first().dispatchEvent("drop", { dataTransfer: transfer }); await transfer.dispose();
  await page.getByLabel("Original details", { exact: true }).getByText("600 × 400 px", { exact: true }).waitFor();
  const originalDetails = await page.getByLabel("Original details").innerText();
  check("compressor: drop reads actual dimensions, format and measured bytes", originalDetails.includes("PNG") && measuredBytes(originalDetails) === readFileSync(noise).length, originalDetails);
  await page.getByLabel("Target size (KB, optional)").fill("80"); await complete("Compress image");
  const compressed = await download("compressed.webp");
  check("compressor: generated WebP decodes with unchanged dimensions", JSON.stringify(dimensions(compressed.path)) === "[600,400]" && readFileSync(compressed.path).subarray(8,12).toString() === "WEBP");
  check("compressor: target report agrees with downloaded bytes", readFileSync(compressed.path).length <= 80000 && measuredBytes(await page.getByLabel("Output details").innerText()) === readFileSync(compressed.path).length && await page.getByText("The measured output meets your target size.", { exact: true }).isVisible());
  check("download: uses a new matching filename", compressed.suggested === "noise-compressor.webp");
  await page.getByLabel("Target size (KB, optional)").fill("0.001");
  check("settings: changing an option invalidates the old download", await page.getByRole("link", { name: "Download result" }).count() === 0);
  await complete("Compress image"); await page.getByText(/The target size was not met/).waitFor();
  const tooSmall = await download("target-not-met.webp"); check("compressor: infeasible target is explicit and still measured", readFileSync(tooSmall.path).length > 1);
  await page.getByLabel("Output format").selectOption("image/png"); check("compressor: PNG explains its lossless quality setting", await page.getByLabel("Quality ceiling", { exact: true }).isDisabled());
  await complete("Compress image"); const lossless = await download("lossless.png"); check("compressor: PNG preserves actual pixels and reports an unmet tiny target", pixels(lossless.path).equals(pixels(noise)) && await page.getByText(/The target size was not met/).isVisible());
  await page.goto(BASE + "/tools/image-converter"); await upload(transparent); await page.getByText("Transparency detected", { exact: true }).waitFor();
  await page.getByLabel("Output format").selectOption("image/jpeg");
  check("converter: warns before flattening alpha", await page.getByText(/JPEG cannot preserve transparency/).isVisible());
  await page.getByLabel("JPEG background", { exact: true }).fill("#123456"); await complete("Convert image"); const flattened = await download("flattened.jpg"); const rgba = pixels(flattened.path);
  check("converter: actual JPEG has selected opaque background", rgba[3] === 255 && Math.abs(rgba[0]-18)<10 && Math.abs(rgba[1]-52)<10 && Math.abs(rgba[2]-86)<10 && readFileSync(flattened.path)[0] === 255);
  const semi = (32*96+32)*4; check("converter: JPEG blends partial alpha onto the background", Math.abs(rgba[semi]-137)<15 && Math.abs(rgba[semi+1]-26)<15 && Math.abs(rgba[semi+2]-43)<15 && rgba[semi+3] === 255);
  await page.getByLabel("Output format").selectOption("image/webp"); await complete("Convert image"); const webp = await download("alpha.webp");
  const webpPixels = pixels(webp.path); check("converter: WebP preserves transparent, partial and opaque alpha", webpPixels[3] === 0 && webpPixels[semi+3] === 128 && webpPixels[(95*4)+3] === 255);
  await page.getByLabel("Output format").selectOption("image/png"); await complete("Convert image"); const png = await download("alpha.png");
  check("converter: PNG preserves alpha and real dimensions", pixels(png.path)[3] === 0 && pixels(png.path)[semi+3] === 128 && JSON.stringify(dimensions(png.path)) === "[96,64]");
  await upload(transparent); await page.getByLabel("Original details").waitFor(); check("picker: selecting the same file again clears the previous result", await page.getByRole("link", { name: "Download result" }).count() === 0);
  await upload(oriented); await page.getByLabel("Original details").getByText("4 × 6 px", { exact: true }).waitFor(); await page.getByLabel("Output format").selectOption("image/png"); await complete("Convert image");
  const upright = await download("upright.png"); check("orientation: EXIF is baked into actual output pixels", JSON.stringify(dimensions(upright.path)) === "[4,6]" && pixels(upright.path)[0] > 180 && pixels(upright.path)[(4*5*4)+2] > 180);
  await page.goto(BASE + "/tools/image-resizer"); await upload(noise); await page.getByRole("button", { name: "Resize image", exact: true }).waitFor({ state: "visible" }); await page.getByLabel("Original details").waitFor();
  await page.getByLabel("Width (px)", { exact: true }).fill("300"); check("resizer: width updates locked height", await page.getByLabel("Height (px)", { exact: true }).inputValue() === "200");
  await page.getByLabel("Width (px)", { exact: true }).fill("301"); await page.getByLabel("Width (px)", { exact: true }).fill("300"); check("resizer: repeated edits do not drift the ratio", await page.getByLabel("Height (px)").inputValue() === "200");
  await complete("Resize image"); const resized = await download("resized.png"); check("resizer: actual file dimensions match the preview", JSON.stringify(dimensions(resized.path)) === "[300,200]" && pixels(resized.path).length === 300*200*4 && (await page.getByLabel("Output details").innerText()).includes("300 × 200"));
  await page.getByRole("button", { name: "Aspect ratio locked", exact: true }).click(); await page.getByLabel("Height (px)").fill("100"); check("resizer: unlocked dimensions are independent", await page.getByLabel("Width (px)").inputValue() === "300");
  await complete("Resize image"); const stretched = await download("stretched.png"); check("resizer: unlocked dimensions are encoded", JSON.stringify(dimensions(stretched.path)) === "[300,100]" && pixels(stretched.path).length === 300*100*4);
  await page.getByLabel("Fit preset").selectOption("400"); check("resizer: preset fits whole image without cropping", await page.getByLabel("Width (px)").inputValue() === "400" && await page.getByLabel("Height (px)").inputValue() === "267");
  await page.getByLabel("Width (px)").fill("0"); await page.getByRole("button", { name: "Resize image", exact: true }).click(); await page.getByRole("alert").filter({ hasText: /positive whole-number/ }).waitFor(); check("resizer: invalid dimensions give recovery without download", await page.getByRole("link", { name: "Download result" }).count() === 0);
  await upload({ name: "unknown.bin", mimeType: "", buffer: readFileSync(transparent) }); await page.getByLabel("Original details").waitFor(); check("validation: missing MIME still requires a real decodable image", (await page.getByLabel("Original details").innerText()).includes("PNG"));
  const damaged = Buffer.from(readFileSync(transparent)), compressedStart = damaged.indexOf("IDAT") + 4; damaged[compressedStart] = 0; damaged[compressedStart + 1] = 0;
  const huge = Buffer.from(readFileSync(transparent)); huge.writeUInt32BE(100000,16);
  const invalids = [
    ["unsupported.svg", "image/svg+xml", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), /not supported/],
    ["mismatch.jpg", "image/jpeg", readFileSync(transparent), /MIME type does not match/],
    ["empty.png", "image/png", Buffer.alloc(0), /non-empty/],
    ["oversize.png", "image/png", Buffer.alloc(25*1024*1024+1), /25 MiB/],
    ["huge.png", "image/png", huge, /8192/],
    ["broken.png", "image/png", readFileSync(transparent).subarray(0,33), /metadata limit|cannot be decoded/],
    ["damaged.png", "image/png", damaged, /cannot be decoded/],
  ];
  for (const [name, mimeType, buffer, message] of invalids) { await upload({ name, mimeType, buffer }); await page.getByRole("alert").filter({ hasText: message }).waitFor(); check(`validation: ${name} rejected`, await page.getByRole("link", { name: "Download result" }).count() === 0); }
  await page.waitForFunction(() => window.photoUrls.size === 0); check("resources: replacement/error releases preview and download URLs", true);
  await page.goto(BASE + "/tools/image-compressor"); let workerUrl; page.on("worker", worker => { workerUrl = worker.url(); }); await upload(noise); await page.getByLabel("Original details").waitFor();
  let release, entered; const gate = new Promise(resolve => { release=resolve; }), started = new Promise(resolve => { entered=resolve; });
  await page.route(workerUrl, async route => { entered(); await gate; await route.continue().catch(() => {}); });
  await page.getByRole("button", { name: "Compress image", exact: true }).click();
  let routeTimer; try { await Promise.race([started, new Promise((_,reject) => { routeTimer = setTimeout(() => reject(new Error("Image-worker cancellation fixture did not start")), 15000); })]); } finally { clearTimeout(routeTimer); }
  await page.getByRole("button", { name: "Cancel operation", exact: true }).click(); release(); await page.unroute(workerUrl);
  await page.getByText(/Operation cancelled/).waitFor(); check("cancellation: no stale result or download is published", await page.getByRole("link", { name: "Download result" }).count() === 0); await complete("Compress image"); check("cancellation: retry processes successfully", true);
  await page.getByRole("link", { name: "Photo tools", exact: true }).click(); await page.getByRole("heading", { name: "Photo tools", exact: true }).waitFor(); await page.waitForFunction(() => window.photoUrls.size === 0); check("resources: route exit revokes all object URLs", true);
  const fallback = await context.newPage(); await fallback.addInitScript(() => { window.Worker = undefined; window.createImageBitmap = undefined; }); await fallback.goto(BASE + "/tools/image-converter"); await fallback.getByLabel("Choose image", { exact: true }).setInputFiles(transparent); await fallback.getByLabel("Original details").waitFor(); await fallback.getByRole("button", { name: "Convert image", exact: true }).click(); await fallback.getByRole("link", { name: "Download result", exact: true }).waitFor(); check("fallback: HTML image/canvas path produces a local result", true);
  await fallback.evaluate(() => { const encode = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) { return encode.call(this, callback, type === "image/webp" ? "image/png" : type, quality); }; });
  await fallback.getByLabel("Output format").selectOption("image/webp"); await fallback.getByRole("button", { name: "Convert image", exact: true }).click(); await fallback.getByRole("alert").filter({ hasText: /cannot encode the selected format/ }).waitFor(); check("fallback: unsupported encoder cannot produce a mislabeled download", await fallback.getByRole("link", { name: "Download result" }).count() === 0); await fallback.close();
  const phoneOptions = { ...devices["Pixel 7"] }; if (process.env.PHOTO_BROWSER === "firefox") delete phoneOptions.isMobile;
  const phone = await browser.newPage(phoneOptions);
  for (const slug of ["image-compressor", "image-resizer", "image-converter"]) {
    await phone.goto(`${BASE}/tools/${slug}`); await phone.getByLabel("Choose image", { exact: true }).setInputFiles(transparent); await phone.getByLabel("Original details").waitFor();
    check(`mobile: ${slug} controls fit without horizontal overflow`, await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await phone.screenshot({ path: join(OUT, `${slug}-phone.png`), fullPage: true });
    const response = await fetch(`${BASE}/tools/${slug}`), html = await response.text(); const title = { "image-compressor": "Image Compressor", "image-resizer": "Image Resizer", "image-converter": "Image Format Converter" }[slug];
    check(`SEO: ${slug} has crawlable unique content`, response.ok && html.includes("Frequently asked questions") && html.includes(`<h1`) && html.includes(`<title>${title} · Reel Finisher</title>`) && html.includes('name="description"') && !/name="robots" content="noindex/.test(html));
  }
  await phone.close();
  check("privacy: requests are local GET/HEAD only", requests.every(req => ["GET","HEAD"].includes(req.method) && (req.url.startsWith(BASE) || /^(blob:|data:)/.test(req.url))));
  check("isolation: photo tools do not load editor or AI assets", requests.every(req => !req.url.includes("/editor/") && !req.url.includes("/editor-models/")));
} catch (error) { await page.screenshot({ path: join(OUT,"failure.png"), fullPage:true }).catch(()=>{}); throw error; }
finally { await browser.close(); await stopServer(server); }
finish();

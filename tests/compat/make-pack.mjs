// Builds the platform upload test pack (T-13): real exports from our pipeline plus ffmpeg controls,
// with a manifest describing each file, ready to copy to a phone and upload by hand.
// Requires `npm run build`, ffmpeg/ffprobe. Run: npm run compat-pack

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { download, ff, probe, ROOT, startServer, stopServer, streams, topLevelBoxes } from "../e2e/helpers.mjs";

const PACK = join(ROOT, "tests/compat/.out/reel-finisher-upload-test-pack");
const SRC = join(ROOT, "tests/compat/.out/sources");
const PORT = 3117;
const SECONDS = 15;

rmSync(join(ROOT, "tests/compat/.out"), { recursive: true, force: true });
mkdirSync(PACK, { recursive: true });
mkdirSync(SRC, { recursive: true });
const src = (n) => join(SRC, n);
const out = (n) => join(PACK, n);

// Phone-like sources: moving pattern, 30 fps, speech-band tone, 48 kHz stereo.
const pattern = (size) => `testsrc2=s=${size}:r=30:d=${SECONDS}`;
const tone = `sine=frequency=220:sample_rate=48000:duration=${SECONDS},aformat=channel_layouts=stereo`;
ff("-f", "lavfi", "-i", pattern("1080x1920"), "-f", "lavfi", "-i", tone, "-c:v", "libx264", "-b:v", "10M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", src("vertical.mp4"));
ff("-f", "lavfi", "-i", pattern("1080x1920"), "-f", "lavfi", "-i", tone, "-c:v", "libvpx-vp9", "-b:v", "4M", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", "-shortest", src("vertical-opus.webm"));
ff("-f", "lavfi", "-i", pattern("1920x1080"), "-f", "lavfi", "-i", tone, "-c:v", "libx264", "-b:v", "10M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", src("landscape.mp4"));

const server = await startServer(PORT);
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  /** Exports `file` through /lab with the given option test ids; saves the MP4 as `name`. */
  async function exportVia(file, choices, name) {
    await page.goto(`http://localhost:${PORT}/lab`);
    await page.getByTestId("file-input").setInputFiles(file);
    await page.getByTestId("check-ok").waitFor({ timeout: 60_000 });
    for (const id of choices) await page.locator("label", { has: page.getByTestId(id) }).click();
    await page.getByTestId("render-button").click();
    await page.locator('[data-testid="render-done"], [data-testid="render-error"]').first().waitFor({ timeout: 300_000 });
    if (await page.getByTestId("render-error").isVisible()) throw new Error(await page.getByTestId("render-error").innerText());
    await download(page, "mp4-link", out(name));
    console.log("exported", name);
  }

  await exportVia(src("vertical.mp4"), ["preset-reels"], "A-ours-reels-aac.mp4");
  await exportVia(src("vertical-opus.webm"), ["preset-reels"], "B-ours-reels-from-opus-source.mp4");
  await exportVia(src("landscape.mp4"), ["preset-reels", "framing-fit"], "E-ours-landscape-fit.mp4");
  await exportVia(src("vertical.mp4"), ["preset-small"], "F-ours-smaller-720.mp4");
} finally {
  await browser.close();
  stopServer(server);
}

// Controls: C isolates file layout (A with moov moved to the end), D is a reference encode.
ff("-i", out("A-ours-reels-aac.mp4"), "-c", "copy", out("C-ours-moov-at-end.mp4"));
ff("-i", src("vertical.mp4"), "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart", out("D-control-ffmpeg.mp4"));

const files = ["A-ours-reels-aac.mp4", "B-ours-reels-from-opus-source.mp4", "C-ours-moov-at-end.mp4", "D-control-ffmpeg.mp4", "E-ours-landscape-fit.mp4", "F-ours-smaller-720.mp4"];
const rows = files.map((name) => {
  const info = probe(out(name));
  const v = streams(info, "video")[0];
  const a = streams(info, "audio")[0];
  const boxes = topLevelBoxes(out(name)).filter((t) => t === "moov" || t === "mdat");
  return `| ${name} | ${v.codec_name} ${v.profile ?? ""} ${v.width}×${v.height} ${v.r_frame_rate} | ${a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels} ch` : "none"} | ${boxes[0] === "moov" ? "front" : "end"} | ${(Number(info.format.size) / 1024 / 1024).toFixed(1)} MB |`;
});

writeFileSync(
  join(PACK, "README.md"),
  `# Upload test pack (generated ${new Date().toISOString().slice(0, 10)})

Each file is ${SECONDS} s of a moving test pattern with a tone and placeholder Hinglish captions.
A, B, E and F were exported by Reel Finisher in Chromium. C and D are controls made with ffmpeg.

| File | Video | Audio | moov | Size |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

- **A**: our normal export (AAC from the source copied, moov at the front).
- **B**: our export from an Opus (WebM) source. Its audio is whatever this browser produced (see the
  table). Chrome on Android, Windows and Mac makes AAC; Linux Chromium keeps Opus.
- **C**: A with moov moved to the end. If A works and C fails, file layout matters.
- **D**: an ffmpeg reference with no captions. If D fails too, the problem is the account or app, not us.
- **E**: landscape source with Fit (bars). **F**: the Smaller file preset.

Record results in docs/research/platform-uploads.md.
`,
);
execFileSync("python3", ["-m", "zipfile", "-c", join(ROOT, "tests/compat/.out/reel-finisher-upload-test-pack.zip"), PACK]);
console.log(rows.join("\n"));

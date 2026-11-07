import { chromium, devices } from "playwright";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, createChecks, ff, probe, streams, decodeErrors } from "./helpers.mjs";

// Local audio/video utilities (src/lib/mediatools), verified on real downloaded files with ffprobe/ffmpeg.
const OUT = join(ROOT, "output/launch-media"), PORT = Number(process.env.MEDIA_TEST_PORT || 3159), BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const f = name => join(OUT, name);
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "6", "-c:v", "libx264", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", f("source.mp4"));
ff("-f", "lavfi", "-i", "testsrc2=size=480x270:rate=30", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000", "-t", "4", "-c:v", "libvpx-vp9", "-b:v", "400k", "-c:a", "libopus", "-shortest", f("source.webm"));
ff("-i", f("source.mp4"), "-c", "copy", f("source.mkv"));
ff("-f", "lavfi", "-i", "sine=frequency=500:sample_rate=44100", "-t", "5", "-c:a", "libmp3lame", "-b:a", "128k", f("tone.mp3"));
ff("-f", "lavfi", "-i", "sine=frequency=500:sample_rate=48000", "-t", "4", "-af", "volume=0.1", "-c:a", "pcm_s16le", f("quiet.wav"));
ff("-f", "lavfi", "-i", "sine=frequency=500:sample_rate=48000", "-t", "4", "-af", "volume=7", "-c:a", "pcm_s16le", f("loud.wav")); // lavfi sine is 1/8 amplitude; ×7 ≈ -1.2 dBFS

const { check, finish } = createChecks();
const server = await startServer(PORT, { env: { REEL_ENABLE_CLOUD: "" } });
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const requests = []; context.on("request", req => requests.push({ url: req.url(), method: req.method() }));
const page = await context.newPage();
let workerUrl; page.on("worker", worker => { workerUrl = worker.url(); });
const duration = path => Number(probe(path).format.duration);
const codecs = path => probe(path).streams.map(stream => `${stream.codec_type}:${stream.codec_name}`).sort().join(",");
const maxVolume = (path, start = 0, length = 60) => { const result = spawnSync("ffmpeg", ["-hide_banner", "-ss", String(start), "-t", String(length), "-i", path, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }); return Number(result.stderr.match(/max_volume: (-?[\d.]+) dB/)?.[1] ?? NaN); };
const open = async (slug, file) => { await page.goto(`${BASE}/tools/${slug}`); await page.getByLabel("Choose file", { exact: true }).setInputFiles(file); };
const run = async (action, link, name) => {
  await page.getByRole("button", { name: action, exact: true }).click();
  await page.getByRole("link", { name: link, exact: true }).waitFor({ timeout: 120000 });
  const event = page.waitForEvent("download"); await page.getByRole("link", { name: link, exact: true }).click();
  const file = await event, path = f(name); await file.saveAs(path); return { path, suggested: file.suggestedFilename() };
};
const adjust = async () => { const button = page.getByRole("button", { name: "Adjust settings" }); if (await button.count()) await button.click(); };
const range = async (start, end) => { await page.getByLabel("Start seconds").fill(String(start)); await page.getByLabel("End seconds").fill(String(end)); };

try {
  // Trim Video
  await open("trim-video", f("source.mp4")); await page.getByRole("button", { name: "Trim video", exact: true }).waitFor();
  check("trim: file details include duration and dimensions", (await page.getByLabel("Original details").innerText()).includes("640 × 360"));
  await range(1.2, 3.7);
  const fast = await run("Trim video", "Download trimmed video", "trim-fast.mp4");
  check("trim fast: copied H.264/AAC MP4, cut snapped to the keyframe and reported", codecs(fast.path) === "audio:aac,video:h264" && duration(fast.path) >= 2.45 && duration(fast.path) <= 3.9 && decodeErrors(fast.path) === "" && await page.getByText("Copied without re-encoding, so quality is unchanged.").first().isVisible(), `${duration(fast.path)} s`);
  check("trim fast: keyframe shift is explained when it happens", duration(fast.path) - 2.5 < 0.15 || await page.getByText("Cut moved to keyframes").first().isVisible());
  await adjust(); await page.getByRole("radio", { name: "Precise", exact: true }).check();
  const precise = await run("Trim video", "Download trimmed video", "trim-precise.mp4");
  check("trim precise: exact 2.5 s clip that decodes cleanly", Math.abs(duration(precise.path) - 2.5) < 0.12 && decodeErrors(precise.path) === "", `${duration(precise.path)} s`);
  check("trim: download name describes the result", precise.suggested === "source-trimmed.mp4", precise.suggested);

  // Remove Audio
  await open("remove-audio", f("source.mp4")); await page.getByRole("button", { name: "Remove audio", exact: true }).waitFor();
  const muted = await run("Remove audio", "Download muted video", "muted.mp4");
  check("remove audio: no audio stream, same H.264 video, full duration", codecs(muted.path) === "video:h264" && Math.abs(duration(muted.path) - 6) < 0.15 && decodeErrors(muted.path) === "");
  await page.goto(`${BASE}/tools/remove-audio`); await page.getByLabel("Choose file", { exact: true }).setInputFiles(muted.path);
  await page.getByText("This video has no audio track, so there is nothing to remove.").waitFor();
  check("remove audio: a silent video cannot be processed again", await page.getByRole("button", { name: "Remove audio", exact: true }).isDisabled());

  // Convert to MP4
  await open("convert-to-mp4", f("source.webm")); await page.getByText(/will be re-encoded to H.264 with AAC audio/).waitFor();
  const fromWebm = await run("Convert to MP4", "Download MP4", "from-webm.mp4");
  check("convert: VP9/Opus WebM becomes a playable H.264/AAC MP4", codecs(fromWebm.path) === "audio:aac,video:h264" && Math.abs(duration(fromWebm.path) - 4) < 0.2 && decodeErrors(fromWebm.path) === "", codecs(fromWebm.path));
  await open("convert-to-mp4", f("source.mkv")); await page.getByText(/repackaged into MP4 without re-encoding/).waitFor();
  const fromMkv = await run("Convert to MP4", "Download MP4", "from-mkv.mp4");
  check("convert: H.264 MKV is repackaged without re-encoding", codecs(fromMkv.path) === "audio:aac,video:h264" && probe(fromMkv.path).format.format_name.includes("mp4") && await page.getByText("Copied without re-encoding, so quality is unchanged.").first().isVisible());

  // Extract Audio
  await open("extract-audio", f("source.mp4")); await page.getByRole("button", { name: "Extract audio", exact: true }).waitFor();
  const m4a = await run("Extract audio", "Download audio", "extract.m4a");
  check("extract: M4A contains only AAC audio of the full length", codecs(m4a.path) === "audio:aac" && Math.abs(duration(m4a.path) - 6) < 0.15 && m4a.suggested.endsWith(".m4a"));
  await adjust(); await page.getByRole("radio", { name: "WAV", exact: true }).check();
  const wav = await run("Extract audio", "Download audio", "extract.wav");
  check("extract: WAV is uncompressed PCM", codecs(wav.path) === "audio:pcm_s16le" && wav.suggested.endsWith(".wav"));
  await adjust(); await page.getByRole("radio", { name: "Ogg (Opus)", exact: true }).check();
  const ogg = await run("Extract audio", "Download audio", "extract.ogg");
  check("extract: Ogg contains Opus audio", codecs(ogg.path) === "audio:opus" && decodeErrors(ogg.path) === "");

  // Audio Converter
  await open("audio-converter", f("tone.mp3")); await page.getByRole("button", { name: "Convert audio", exact: true }).waitFor();
  const converted = await run("Convert audio", "Download audio", "tone.wav");
  check("audio converter: MP3 becomes a WAV of the same length", codecs(converted.path) === "audio:pcm_s16le" && Math.abs(duration(converted.path) - 5) < 0.12, `${duration(converted.path)} s`);

  // Audio Cutter
  await open("audio-cutter", f("loud.wav")); await page.getByRole("button", { name: "Cut audio", exact: true }).waitFor();
  check("cutter: a real waveform is drawn from the decoded audio", (await page.locator("svg rect").count()) > 100);
  await range(1, 3); await page.getByLabel("Fade in seconds").fill("0.5"); await page.getByRole("radio", { name: "WAV", exact: true }).check();
  const cut = await run("Cut audio", "Download audio", "cut.wav");
  check("cutter: output is the selected 2 s range", Math.abs(duration(cut.path) - 2) < 0.06, `${duration(cut.path)} s`);
  check("cutter: fade in is applied to the samples", maxVolume(cut.path, 0, 0.05) < maxVolume(cut.path, 1, 0.5) - 12, `${maxVolume(cut.path, 0, 0.05)} vs ${maxVolume(cut.path, 1, 0.5)}`);

  // Increase Volume
  await open("increase-volume", f("quiet.wav")); await page.getByRole("button", { name: "Change volume", exact: true }).waitFor();
  await page.getByRole("radio", { name: "Normalize", exact: true }).check(); await page.getByRole("radio", { name: "WAV", exact: true }).check();
  const normalized = await run("Change volume", "Download audio", "normalized.wav");
  check("volume: normalize lifts the peak to about -1 dBFS", Math.abs(maxVolume(normalized.path) - -1) < 0.6 && maxVolume(f("quiet.wav")) < -15, `${maxVolume(f("quiet.wav"))} → ${maxVolume(normalized.path)} dB`);
  check("volume: the applied gain is reported", await page.getByText(/The loudest peak now sits at -1 dBFS/).first().isVisible());
  await open("increase-volume", f("loud.wav")); await page.getByRole("button", { name: "Change volume", exact: true }).waitFor();
  await page.getByLabel("Gain in decibels").fill("12"); await page.getByRole("radio", { name: "WAV", exact: true }).check();
  const boosted = await run("Change volume", "Download audio", "boosted.wav");
  check("volume: a large boost is limited instead of hard clipping, and says so", maxVolume(boosted.path) <= 0 && maxVolume(boosted.path) > maxVolume(f("loud.wav")) && await page.getByText("Peaks were limited").first().isVisible(), `${maxVolume(boosted.path)} dB`);

  // Video to GIF
  await open("video-to-gif", f("source.mp4")); await page.getByRole("button", { name: "Create GIF", exact: true }).waitFor();
  await range(1, 3); await page.getByRole("radio", { name: "240", exact: true }).check();
  const gif = await run("Create GIF", "Download GIF", "clip.gif");
  const gifStream = probe(gif.path).streams[0], gifFrames = Number(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", gif.path]).toString().trim());
  check("gif: real animated GIF at the chosen width with the expected frames", gifStream.codec_name === "gif" && gifStream.width === 240 && Math.abs(gifFrames - 24) <= 1 && gif.suggested === "source.gif", `${gifStream.width}px, ${gifFrames} frames`);

  // Compress Video to Size
  await page.goto(`${BASE}/tools/compress-video-to-size`); await page.getByLabel("Choose video", { exact: true }).setInputFiles(f("source.mp4"));
  await page.getByRole("button", { name: "Compress video", exact: true }).waitFor();
  check("compress to size: a target is required before compressing", await page.getByRole("button", { name: "Compress video", exact: true }).isDisabled() && await page.getByText("Enter a target size to continue.").isVisible());
  await page.getByLabel("Target size", { exact: true }).fill("0.4");
  await page.getByLabel("Requested bitrate").waitFor();
  check("compress to size: the requested bitrate is calculated and shown", /\d+ kbps video/.test(await page.getByLabel("Requested bitrate").innerText()));
  await page.waitForFunction(() => !([...document.querySelectorAll("button")].find(b => b.textContent === "Compress video")?.disabled), undefined, { timeout: 30000 });
  const sized = await run("Compress video", "Download compressed video", "sized.mp4"), sizedBytes = (await import("node:fs")).statSync(sized.path).size;
  const achieved = await page.getByText("Target achieved").first().isVisible();
  check("compress to size: the reported outcome matches the measured file", achieved === (sizedBytes <= 400000) && (achieved || await page.getByText("Closest possible result").first().isVisible()), `${sizedBytes} bytes, achieved=${achieved}`);

  // Audio to Video
  await open("audio-to-video", f("loud.wav")); await page.getByRole("button", { name: "Create video", exact: true }).waitFor();
  await page.getByRole("radio", { name: "Landscape", exact: true }).check();
  const generated = await run("Create video", "Download MP4", "audio-video.mp4"), generatedVideo = streams(probe(generated.path), "video")[0];
  check("audio to video: real H.264/AAC MP4 at the chosen shape and the audio's length", codecs(generated.path) === "audio:aac,video:h264" && generatedVideo.width === 1280 && generatedVideo.height === 720 && Math.abs(duration(generated.path) - 4) < 0.3 && decodeErrors(generated.path) === "", `${generatedVideo.width}x${generatedVideo.height}, ${duration(generated.path)} s`);

    // Speech generation requires consent; the device-listening alternative remains available.
  await page.goto(`${BASE}/tools/text-to-speech`);
    check("text to speech: generation needs consent and offers no fabricated download", await page.getByRole("link", { name: /^Download/ }).count() === 0 && await page.getByRole("button", { name: "Generate speech", exact: true }).isDisabled());
  await page.getByLabel("Text to read").fill("Hello from Reel Finisher.");
    check("text to speech: the character count follows the bounded generation text", await page.getByText("25 / 500").isVisible());
    await page.getByLabel("Speech mode", { exact: true }).selectOption("listen");
    check("text to speech: existing device playback is preserved", await page.getByRole("button", { name: "Speak", exact: true }).isVisible() && await page.getByText("Listening only", { exact: true }).isVisible());

  // Errors and cancellation
  await page.goto(`${BASE}/tools/audio-converter`); await page.getByLabel("Choose file", { exact: true }).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not audio") });
  const reason = page.getByRole("alert").filter({ hasText: /\w/ }); await reason.waitFor();
  check("validation: a non-media file is rejected with a reason", (await reason.innerText()).length > 20, await reason.innerText());
  await open("trim-video", f("source.mp4")); await page.getByRole("button", { name: "Trim video", exact: true }).waitFor();
  await page.route(workerUrl, async route => { await new Promise(resolve => setTimeout(resolve, 4000)); await route.continue().catch(() => {}); });
  await page.getByRole("button", { name: "Trim video", exact: true }).click(); await page.getByRole("button", { name: "Cancel operation" }).click(); await page.unroute(workerUrl);
  await page.getByText(/Cancelled\. Your file is unchanged/).waitFor();
  check("cancellation: nothing is published and the tool can run again", await page.getByRole("link", { name: /^Download / }).count() === 0 && await page.getByRole("button", { name: "Trim video", exact: true }).isEnabled());

  const phone = await browser.newPage(devices["Pixel 7"]);
  for (const [slug, file] of [["trim-video", f("source.mp4")], ["audio-cutter", f("loud.wav")]]) {
    await phone.goto(`${BASE}/tools/${slug}`); await phone.getByLabel("Choose file", { exact: true }).setInputFiles(file); await phone.locator("button[aria-busy], button").filter({ hasText: /^(Trim video|Cut audio)$/ }).waitFor();
    check(`mobile: ${slug} fits without horizontal overflow`, await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await phone.close();
  for (const slug of ["trim-video", "remove-audio", "convert-to-mp4", "extract-audio", "audio-converter", "audio-cutter", "increase-volume", "video-to-gif", "compress-video-to-size", "audio-to-video", "text-to-speech"]) {
    const html = await (await fetch(`${BASE}/tools/${slug}`)).text();
    check(`SEO: ${slug} has a unique title, H1 and FAQ`, /<title>[^<]+ · Reel Finisher<\/title>/.test(html) && html.includes("<h1") && html.includes("Frequently asked questions"));
  }
  check("privacy: only same-origin GET/HEAD requests", requests.every(req => ["GET", "HEAD"].includes(req.method) && (req.url.startsWith(BASE) || /^(blob:|data:)/.test(req.url))));
} catch (error) { await page.screenshot({ path: f("failure.png"), fullPage: true }).catch(() => {}); console.log("VISIBLE_ERRORS", await page.getByRole("alert").allTextContents().catch(() => [])); throw error; }
finally { await browser.close(); await stopServer(server); }
finish();

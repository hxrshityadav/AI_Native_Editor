import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, createChecks, ff, probe, streams, decodeErrors } from "./helpers.mjs";

// Music Mixer: real mixed files from real inputs, with ducking measured by ffmpeg on the downloaded output.
const OUT = join(ROOT, "output/launch-mixer"), PORT = Number(process.env.REEL_E2E_PORT || process.env.MIXER_TEST_PORT || 3163), BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const f = name => join(OUT, name);
// "Voice": a 300 Hz tone that is present only from 2–4 s and 6–8 s, over silence. "Music": a 4 s 1 kHz MP3 at 44.1 kHz,
// so the mixer has to resample it and loop it to fill 10 s.
const gate = "volume='if(between(t,2,4)+between(t,6,8),4,0)':eval=frame";
ff("-f", "lavfi", "-i", "sine=frequency=300:sample_rate=48000", "-t", "10", "-af", gate, "-c:a", "pcm_s16le", f("voice.wav"));
ff("-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=44100", "-t", "4", "-af", "volume=4", "-c:a", "libmp3lame", "-b:a", "128k", f("music.mp3"));
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30", "-i", f("voice.wav"), "-t", "10", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", f("talk.mp4"));

const { check, finish } = createChecks();
const server = await startServer(PORT);
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const requests = []; context.on("request", req => requests.push({ url: req.url(), method: req.method() }));
const page = await context.newPage(), errors = [];
page.on("pageerror", e => errors.push(e.message));
let workerUrl; page.on("worker", worker => { workerUrl = worker.url(); });
const duration = path => Number(probe(path).format.duration);
/** Mean level (dB) of the 1 kHz music band between start and start + length. */
const musicLevel = (path, start, length) => { const r = spawnSync("ffmpeg", ["-hide_banner", "-ss", String(start), "-t", String(length), "-i", path, "-af", "bandpass=f=1000:width_type=q:w=8,bandpass=f=1000:width_type=q:w=8,volumedetect", "-f", "null", "-"], { encoding: "utf8" }); return Number(r.stderr.match(/mean_volume: (-?[\d.]+) dB/)?.[1] ?? NaN); };
const voiceLevel = (path, start, length) => { const r = spawnSync("ffmpeg", ["-hide_banner", "-ss", String(start), "-t", String(length), "-i", path, "-af", "bandpass=f=300:width_type=q:w=8,bandpass=f=300:width_type=q:w=8,volumedetect", "-f", "null", "-"], { encoding: "utf8" }); return Number(r.stderr.match(/mean_volume: (-?[\d.]+) dB/)?.[1] ?? NaN); };
const load = async (voice) => {
  await page.goto(`${BASE}/tools/music-mixer`);
  await page.getByLabel("Choose voice or video file", { exact: true }).setInputFiles(voice);
  await page.getByLabel("Music file", { exact: true }).setInputFiles(f("music.mp3"));
  await page.getByLabel("Music fade in seconds").fill("0"); await page.getByLabel("Music fade out seconds").fill("0");
};
const mix = async (link, name) => {
  await page.getByRole("button", { name: "Mix", exact: true }).click();
  await page.getByRole("link", { name: link, exact: true }).waitFor({ timeout: 120000 });
  const event = page.waitForEvent("download"); await page.getByRole("link", { name: link, exact: true }).click();
  const file = await event, path = f(name); await file.saveAs(path); return path;
};

try {
  await page.goto(`${BASE}/tools/music-mixer`);
  check("page: catalog route renders a unique title and H1", /Music Mixer/.test(await page.getByRole("heading", { level: 1 }).innerText()) && /· Reel Finisher$/.test(await page.title()));

  // Mix button is disabled until music is added.
  await page.getByLabel("Choose voice or video file", { exact: true }).setInputFiles(f("voice.wav"));
  await page.getByRole("button", { name: "Mix", exact: true }).waitFor();
  check("controls: Mix waits for a music file", await page.getByRole("button", { name: "Mix", exact: true }).isDisabled());

  // Audio-only mix with ducking.
  await load(f("voice.wav"));
  const ducked = await mix("Download M4A", "ducked.m4a"), info = probe(ducked), audio = streams(info, "audio")[0];
  check("audio mix: real AAC stereo 48 kHz M4A at the voice's length", audio.codec_name === "aac" && audio.channels === 2 && Number(audio.sample_rate) === 48000 && Math.abs(duration(ducked) - 10) < 0.2 && streams(info, "video").length === 0 && decodeErrors(ducked) === "", `${audio.codec_name} ${audio.channels}ch ${audio.sample_rate} ${duration(ducked)} s`);
  const open1 = musicLevel(ducked, 0.5, 1), during = musicLevel(ducked, 2.6, 1), after = musicLevel(ducked, 9.2, 0.7), looped = musicLevel(ducked, 4.8, 0.8);
  check("ducking: the music is at least 9 dB lower while the voice speaks", open1 - during >= 9, `open ${open1} dB, speech ${during} dB`);
  check("ducking: the music recovers after the speech", Math.abs(after - open1) < 2.5, `open ${open1} dB, after ${after} dB`);
  check("loop: the 4 s music file fills the 10 s mix", looped > open1 - 15 && Number.isFinite(looped), `at 4.8 s: ${looped} dB`);
  check("voice: present in the mix", voiceLevel(ducked, 2.6, 1) > -40);
  const summary = await page.getByText(/Speech found in/).innerText();
  check("result: reports the measured speech and ducked time", /Speech found in [3-5]\.\d s/.test(summary), summary);

  // No ducking: constant music.
  await load(f("voice.wav"));
  await page.getByRole("radio", { name: "Off", exact: true }).check();
  await page.getByRole("radio", { name: "WAV", exact: true }).check();
  const flat = await mix("Download WAV", "flat.wav");
  const flatOpen = musicLevel(flat, 0.5, 1), flatSpeech = musicLevel(flat, 2.6, 1);
  check("no ducking: WAV output with the music at one level", streams(probe(flat), "audio")[0].codec_name === "pcm_s16le" && Math.abs(flatOpen - flatSpeech) < 1.5, `${flatOpen} / ${flatSpeech} dB`);

  // Video: picture copied, audio replaced by the mix.
  await load(f("talk.mp4"));
  const video = await mix("Download MP4", "talk-mix.mp4"), vInfo = probe(video), sourceVideo = streams(probe(f("talk.mp4")), "video")[0], outVideo = streams(vInfo, "video")[0];
  check("video mix: H.264 picture copied with the same frames, AAC mixed audio", outVideo.codec_name === "h264" && outVideo.width === 640 && outVideo.nb_frames === sourceVideo.nb_frames && streams(vInfo, "audio")[0].codec_name === "aac" && decodeErrors(video) === "", `${outVideo.codec_name} ${outVideo.nb_frames}/${sourceVideo.nb_frames} frames`);
  check("video mix: ducking applies to the video's speech", musicLevel(video, 0.5, 1) - musicLevel(video, 2.6, 1) >= 9);

  // Errors and cancellation.
  await load(f("voice.wav"));
  await page.getByLabel("Music start offset seconds").fill("30");
  await page.getByRole("button", { name: "Mix", exact: true }).click();
  const reason = page.getByRole("alert").filter({ hasText: /music start/i }); await reason.waitFor({ timeout: 60000 });
  check("validation: a start after the end of the music is explained", /earlier start/.test(await reason.innerText()), await reason.innerText());
  await page.getByLabel("Music start offset seconds").fill("0");
  await page.route(workerUrl, async route => { await new Promise(resolve => setTimeout(resolve, 4000)); await route.continue().catch(() => {}); });
  await page.getByRole("button", { name: "Mix", exact: true }).click(); await page.getByRole("button", { name: "Cancel operation" }).click(); await page.unroute(workerUrl);
  await page.getByText(/Cancelled\. Your files are unchanged/).waitFor();
  check("cancellation: nothing is published and the tool can run again", await page.getByRole("link", { name: /^Download / }).count() === 0 && await page.getByRole("button", { name: "Mix", exact: true }).isEnabled());

  check("no browser exceptions", errors.length === 0, errors.join(" | "));
  check("privacy: only same-origin GET/HEAD requests", requests.every(req => ["GET", "HEAD"].includes(req.method) && (req.url.startsWith(BASE) || /^(blob:|data:)/.test(req.url))));
} catch (error) { await page.screenshot({ path: f("failure.png"), fullPage: true }).catch(() => {}); console.log("VISIBLE_ERRORS", await page.getByRole("alert").allTextContents().catch(() => [])); throw error; }
finally { await browser.close(); stopServer(server); }
finish();

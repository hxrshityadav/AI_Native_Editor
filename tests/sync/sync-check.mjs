// Caption sync check (T-11). Two modes:
//   npm run sync-check -- --self-test        validates the method here, no API key needed
//   npm run sync-check -- <clips or folder>  real clips through /api/transcribe (needs GROQ_API_KEY
//                                            in .env.local) → tests/sync/.out/report.md
// Requires `npm run build` and ffmpeg. Transcripts stay in tests/sync/.out (gitignored), on this machine.

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { chromium } from "playwright";
import { ff, ROOT, startServer, stopServer } from "../e2e/helpers.mjs";
import { frameEnergiesDb, onsetErrors, speechRegions, summarize } from "./syncMetrics.mjs";

const OUT = join(ROOT, "tests/sync/.out");
const PORT = 3118;
const TOLERANCE = 0.15;
/** Proposed pass bar: ≥ 90% of phrase starts within ±150 ms and a bias no larger than 50 ms. */
const PASS = { within: 0.9, maxBiasMs: 50 };
/** Below this signal-to-noise ratio, onset detection is unreliable (music, crowd, wind). */
const MIN_SNR_DB = 20;

mkdirSync(OUT, { recursive: true });

/** Mono 16 kHz float samples of a file's first audio track. */
function decode(file) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], {
    maxBuffer: 1 << 30,
  });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}
const analyse = (file) => speechRegions(frameEnergiesDb(decode(file), 16000));

if (process.argv.includes("--self-test")) await selfTest();
else await realClips(process.argv.slice(2).filter((a) => !a.startsWith("--")));

async function selfTest() {
  // Noise "phrases" at known times in an H.264/AAC MP4, like a phone recording.
  const phrases = [[0.8, 1.9], [2.6, 3.4], [4.1, 5.6], [6.3, 7.0]];
  const gate = phrases.map(([a, b]) => `between(t,${a},${b})`).join("+");
  const clip = join(OUT, "selftest.mp4");
  ff("-f", "lavfi", "-i", "color=c=gray:s=360x640:r=30:d=8", "-f", "lavfi", "-i", "anoisesrc=d=8:c=pink:a=0.5:r=48000",
    "-af", `volume='if(${gate},1,0.003)':eval=frame`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", clip);

  const results = [];
  const check = (name, ok, detail) => {
    results.push(ok);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (${detail})`);
  };

  const source = analyse(clip);
  const sourceErr = source.regions.map((r, i) => Math.round((r.start - phrases[i]?.[0]) * 1000));
  check("onsets found in an AAC/MP4 file at the planted times (±20 ms)", source.regions.length === phrases.length && sourceErr.every((e) => Math.abs(e) <= 20), `errors ms: ${sourceErr}`);

  // The app's own extraction (what Groq receives) must keep timing: same onsets as the source.
  const server = await startServer(PORT);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/lab`);
    await page.getByTestId("file-input").setInputFiles(clip);
    await page.getByTestId("check-ok").waitFor({ timeout: 30_000 });
    await page.getByTestId("extract-button").click();
    await page.getByTestId("extract-done").waitFor({ timeout: 60_000 });
    const bytes = await page.evaluate(async () => {
      const src = document.querySelector('[data-testid="extract-done"] audio').src;
      return Array.from(new Uint8Array(await (await fetch(src)).arrayBuffer()));
    });
    writeFileSync(join(OUT, "selftest-speech.ogg"), Buffer.from(bytes));
  } finally {
    await browser.close();
    stopServer(server);
  }
  const sent = analyse(join(OUT, "selftest-speech.ogg"));
  const drift = sent.regions.map((r, i) => Math.round((r.start - source.regions[i]?.start) * 1000));
  check("app's extracted Opus audio keeps the source timing (±20 ms)", sent.regions.length === phrases.length && drift.every((d) => Math.abs(d) <= 20), `drift ms: ${drift}`);

  // Planted caption delay of +120 ms must come back as +120 ms bias.
  const words = phrases.flatMap(([a, b]) => [{ start: a + 0.12, end: a + 0.5 }, { start: a + 0.55, end: b }]);
  const s = summarize(onsetErrors(source.regions, words), TOLERANCE);
  check("planted +120 ms caption delay measured as +120 ms", Math.abs(s.biasMs - 120) <= 15 && s.within === 1, JSON.stringify(s));

  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} self-test checks passed`);
  process.exit(failed ? 1 : 0);
}

async function realClips(args) {
  const clips = args.flatMap((p) =>
    statSync(p).isDirectory() ? readdirSync(p).filter((f) => /\.(mp4|mov|webm|mkv)$/i.test(f)).map((f) => join(p, f)) : [p],
  );
  if (clips.length === 0) {
    console.error("Usage: npm run sync-check -- <clip files or a folder>   (or --self-test)");
    process.exit(2);
  }
  const language = process.argv.find((a) => a.startsWith("--language="))?.split("=")[1] ?? "hinglish";
  const server = await startServer(PORT, { withKey: true });
  const rows = [];
  const pooled = [];
  try {
    for (const clip of clips) {
      // Same speech audio the app sends: mono Opus, 48 kHz, 32 kbps, in Ogg.
      const ogg = join(OUT, `${basename(clip)}.ogg`);
      ff("-i", clip, "-map", "0:a:0", "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "32k", ogg);
      const form = new FormData();
      form.append("audio", new Blob([readFileSync(ogg)], { type: "audio/ogg" }), "speech.ogg");
      form.append("language", language);
      const res = await fetch(`http://localhost:${PORT}/api/transcribe`, { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        console.error(`${basename(clip)}: ${body.error?.code}: ${body.error?.message} ${body.error?.action}`);
        if (body.error?.code === "NOT_CONFIGURED") process.exit(1);
        rows.push(`| ${basename(clip)} | error ${body.error?.code} | | | | | |`);
        continue;
      }
      writeFileSync(join(OUT, `${basename(clip)}.words.json`), JSON.stringify(body.words, null, 1));
      const { regions, snrDb } = analyse(clip);
      const errors = onsetErrors(regions, body.words);
      const s = summarize(errors, TOLERANCE);
      const reliable = snrDb >= MIN_SNR_DB;
      if (reliable) pooled.push(...errors);
      rows.push(
        `| ${basename(clip)} | ${s.phrases} | ${s.phrases ? Math.round(s.within * 100) + "%" : "—"} | ${s.medianAbsMs ?? "—"} | ${s.p90AbsMs ?? "—"} | ${s.biasMs ?? "—"} | ${snrDb.toFixed(0)} dB${reliable ? "" : " (noisy: excluded)"} |`,
      );
      console.log(rows.at(-1));
    }
  } finally {
    stopServer(server);
  }
  const all = summarize(pooled, TOLERANCE);
  const pass = all.phrases > 0 && all.within >= PASS.within && Math.abs(all.biasMs) <= PASS.maxBiasMs;
  const report = `# Caption sync report (${new Date().toISOString().slice(0, 10)}, language: ${language})

Error = caption word start − speech onset after a pause (positive: caption late). Tolerance ±${TOLERANCE * 1000} ms.

| Clip | Phrases | Within ±150 ms | Median abs (ms) | P90 abs (ms) | Bias (ms) | SNR |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

**Pooled (clips with SNR ≥ ${MIN_SNR_DB} dB):** ${all.phrases} phrases, ${Math.round(all.within * 100)}% within ±150 ms,
median ${all.medianAbsMs} ms, p90 ${all.p90AbsMs} ms, bias ${all.biasMs} ms.

**Result: ${pass ? "PASS" : "FAIL"}** against the proposed bar (≥ ${PASS.within * 100}% within ±150 ms and |bias| ≤ ${PASS.maxBiasMs} ms).
`;
  writeFileSync(join(OUT, "report.md"), report);
  console.log("\n" + report);
}

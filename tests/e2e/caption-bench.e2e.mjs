// Caption transcription benchmark: runs the real speech worker (Whisper Tiny / Base, timestamped exports) in Chrome on
// every clip in output/caption-bench/clips (*.wav with a matching *.txt reference) and writes raw results to
// output/caption-bench/results.json. Scoring is done by tests/e2e/caption-bench-score.mjs. Models download once per run
// through the same-origin model route, exactly as in the app after consent.
import { chromium } from "playwright";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer } from "./helpers.mjs";

const DIR = join(ROOT, "output/caption-bench"), CLIPS = join(DIR, process.env.BENCH_CLIPS || "clips"), PORT=Number(process.env.REEL_E2E_PORT || 3216), BASE = `http://localhost:${PORT}`;
const MODELS = (process.env.BENCH_MODELS || "tiny,base").split(","), ONLY = process.env.BENCH_LANGS?.split(",");
const clips = readdirSync(CLIPS).filter(name => name.endsWith(".wav")).map(name => ({ name: name.slice(0, -4), kind: name.split("-")[0], reference: readFileSync(join(CLIPS, name.replace(/\.wav$/, ".txt")), "utf8").trim(), audio: readFileSync(join(CLIPS, name)).toString("base64") }));
if(!clips.length || clips.some(clip=>!clip.reference) || MODELS.some(model=>!['tiny','base','hinglish-swift'].includes(model))) throw new Error('Provide nonempty benchmark clips and supported model choices.');
const LANGS = { en: ["auto", "en"], hinglish: ["auto", "hi", "en"], hi: ["auto", "hi"] };
const server = await startServer(PORT), browser = await chromium.launch({ channel: "chrome" }), results = [];
try {
  const page = await browser.newPage(); await page.goto(`${BASE}/tools/subtitle-studio`);
  for (const model of MODELS) for (const clip of clips) for (const language of (LANGS[clip.kind] ?? ["auto"]).filter(l => !ONLY || ONLY.includes(l))) {
    const run = await page.evaluate(async ({ audio, name, language, model }) => {
      const bytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0)), file = new File([bytes], `${name}.wav`, { type: "audio/wav" });
      const worker = new Worker("/local-ai/speech.worker.js", { type: "module" }), started = performance.now();
      try {
        return await Promise.race([new Promise(resolve => {
          worker.onmessage = ({ data }) => { if (data.type === "done") resolve({ ok: true, ms: performance.now() - started, ...data.result }); else if (data.type === "error") resolve({ ok: false, error: data.message }); };
          worker.onerror = event => resolve({ ok: false, error: String(event.message) });
          worker.postMessage({ kind: "transcribe", file, language, translate: false, captionModel: model });
        }), new Promise(resolve => setTimeout(() => resolve({ok:false,error:"ASR benchmark timed out"}), 600000))]);
      } finally { worker.terminate(); }
    }, { audio: clip.audio, name: clip.name, language, model });
    results.push({ clip: clip.name, kind: clip.kind, reference: clip.reference, model, requested: language, ...run });
    console.log(`${model} run ${results.length}: ${run.ok ? "completed" : "failed"}`);
  }
} finally { await browser.close(); stopServer(server); }
writeFileSync(join(DIR, process.env.BENCH_RESULTS || "results.json"), JSON.stringify(results, null, 1));

if (!results.length || results.some(run => !run.ok)) process.exitCode = 1;

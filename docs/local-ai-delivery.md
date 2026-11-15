# Local AI and creator tools delivery — November 4, 2026

Release certification is tracked separately in `production-readiness-report.md`. Its current decision is **NO-GO**; the functional delivery results below do not establish production hosting, physical-device or perceptual-quality approval.

## Implemented workflows

| Feature | Route / integration | Actual behavior and limits |
|---|---|---|
| Downloadable speech | `/tools/text-to-speech` | Existing SpeechT5 worker, one generic English voice, reviewed text, WAV preview/download, measured duration/size, regenerate/cancel. 500 characters and 60-second output cap. Installed local device voices remain a listening alternative. |
| Neural noise cleanup | `/tools/noise-remover` | RNNoise beside existing Light spectral subtraction; mono/stereo, different rates, original/processed preview, WAV or copied-picture video where supported, cancel/cleanup. Existing two-minute safety limit retained. |
| Shorts Maker | `/tools/shorts-maker` → `/studio` | Local Whisper or manual transcript, deterministic speech/pause suggestions, editable source range/captions, 9:16/1:1/16:9 crop and resolution cap. A fingerprinted local handoff creates a separate native Studio project; Studio owns history, rendering and downloads. Source ≤600 seconds/512 MiB; selection 0.1–60 seconds. |
| Lecture to Notes | `/tools/lecture-to-notes` | Local Whisper or manual segments, editable transcript, source-based key quotes, pause/time sections, cloze recall cards, TXT/Markdown downloads with timestamps. Extractive rather than LLM-generated. Source ≤600 seconds/512 MiB and 1,000 segments. |
| PDF to Audio | `/tools/pdf-to-audio` | Real PDF.js worker extraction, page range, full text preview, editable section and existing SpeechT5 synthesis. PDF ≤10 MiB/50 pages/100,000 extracted characters; audio selections ≤5,000 characters, sentence-based ≤100-character segments, ten-minute output cap. No OCR/password support. |

All core processing is browser-local. Optional model downloads need consent. No new account, paid provider or watermark. The homepage, original tools, `/studio`, `/studio-legacy`, `/lab`, global ten-minute video guards and existing editor authority remain intact. No second timeline/export engine was introduced.

## Important stabilization findings

A valid WAV was not sufficient proof of narration correctness. The existing q8 decoder passed file tests but produced only **31.5% unique content-word recall** through real local Whisper on the controlled paragraph. Sentence chunking alone did not resolve it. Keeping the existing q8 encoder and switching the same SpeechT5 decoder to fp32 achieved **100%** in that test. Shared short-sentence handling now applies to standalone speech, narration and dubbing. This increases current speech weights to **388,321,010 bytes / 370.33 MiB**, plus runtime/configs. The UI and notices disclose it. No Kokoro or second speech stack was added.

The pre-existing 2-KiB voice vector's provenance was established by exact hash match to CMU ARCTIC SLT row 7306. The original commercial-use permission, derived-dataset MIT declaration, source links and exact borrowed ORT third-party notices are retained. See [model inventory](local-models.md) for every revision, hash, byte count and license scope.

Root public models use pinned revisions and separate **`reel-finisher-models-v1`** caching, with same-origin asset-only guards and speaker integrity recovery. Existing project databases, Studio caches and unversioned model caches are not cleared. No root service worker or cross-origin isolation requirement was added to public pages. PDF/RNNoise immutable assets are versioned and noindex; completed tools have unique metadata, FAQs, catalog/sidebar links and sitemap entries.

## Validation results

| Gate | Actual result |
|---|---|
| Final `npm run check` | Passed: lint/typecheck, 353 root + 188 vendor web + 64 vendor core = **605 tests**; ten existing skips. Final standalone lint rerun is clean (zero warnings/errors). |
| Final clean `npm run build` | Passed, including native editor, local workers, licensed assets and Next production pages |
| Stage 7 complete serial `npm run e2e` | **704/704** across 21 suites |
| Corrected shared-engine actual-model suite | **52/52**: Whisper, downloadable speech, dubbing, narrated MP4, RNNoise, actual decoded output, cancellation, cleanup and requests |
| PDF actual-model/content suite | **24/24**, including WAV → real local Whisper content comparison |
| Firefox real speech/noise | **4/4** with the fp32 decoder |
| PDF parser/recovery in Edge / Firefox | **20/20** and **19/19** |
| Final actual-byte/hash/cache suite, Chrome | **13/13**: six real artifacts hashed, fresh workers/reload with model network blocked, zero redownload attempts, cache/DB sentinels preserved |
| Final cache suite, Edge / Firefox | **13/13 each**, including all six hashes and zero model redownload attempts after reload |
| Final full regression after cache/notice changes | **704/704**, all 21 suites; exit 0 (`output/local-ai-final-regression.log`) |

An initial parallel Stage 7 run stalled in an unbounded legacy `video.play()` test promise. Added a ten-second diagnostic deadline; the serial complete rerun passed, without changing legacy app behavior. Keep heavy browser suites serial in this environment. The recurring Next incremental-cache `undefined.length` build error is avoided by a verified deletion of only generated `.next` before clean builds. An automatic permission-review timeout prevented one check from starting; retry succeeded. These are recorded separately from passing validation.

The first Edge final-cache attempt failed on a transient upstream HiFiGAN-config gateway response before output. The pinned upstream config subsequently returned HTTP 200; the explicit retry passed all 13 checks. Failed/partial attempts are not counted as verified.

Logs are under ignored `output/local-ai-*`; detailed stage history and source evidence are in [the implementation ledger](local-ai-implementation.md). Existing optional database tests/scenario remain unavailable without their configured test DB URL; they are not claimed as exercised. Heavy model tests are opt-in and download several hundred MiB:

```powershell
npm run check
npm run build
npm run e2e
npm run e2e:models
# Repeat cache suite with LOCAL_CACHE_BROWSER=msedge or firefox.
# Portable Firefox path used by the local test is output/firefox-test/firefox/firefox.exe.
```

## Measurements and privacy evidence

- Controlled PDF paragraph: 37.18-second, 16-kHz mono WAV; **241,871 ms including loading/download**; 100% unique content-word recall via Whisper. This is not an inference-only or perceptual-quality benchmark.
- Earlier isolated neural cleanup fixtures: broadband-noise RMS ratio **.133**; fan/traffic/room/keyboard/hiss/clean speech correlations **.959–.970**, **677–1,161 ms** for short generated fixtures. Real-world listening remains necessary.
- Shorts: source **2–5 seconds** exported as **0–3 seconds**; decoded picture/audio boundary aligned; portrait output and actual square ASR-to-export tested; preview/export mean RGB delta **6.97**. The previous native project remained byte-for-byte intact after a second import; normal recovery survived reload.
- Browser tests reject external HTTP requests and non-GET/HEAD operations for local workflows. Root model requests contain fixed public asset names, not media or transcripts. Model-cache reuse after reload is tested with model requests blocked; this does **not** claim a complete offline Next.js website installation. Native Studio's existing scoped offline/recovery behavior is tested separately.

## Models, dependencies and scope not shipped

Current models: Whisper Tiny q4 (Apache-2.0, weights 91.30 MiB plus configs), SpeechT5 mixed precision + fp32 HiFiGAN (MIT, 370.33 MiB plus configs), fixed licensed speaker vector, RNNoise v0.1 embedded model (BSD-3-Clause, wrapper/runtime total 121.49 KiB).

New isolated dependencies: **`@jitsi/rnnoise-wasm@0.2.1`** and **`pdfjs-dist@6.5.438`**. Existing Transformers.js **3.8.1**, matching ORT Web **1.22.0-dev.20250409-89f8206ba4**, Mediabunny and OpenReel are reused. PDF.js Apache-2.0, bundled core-js MIT, Adobe CMap and PDFium/Foxit BSD notices are retained. No Liberation/GPL PDF font assets or optional native canvas dependency is shipped. The pre-existing HEIC/Background Remover stacks are unchanged.

- **Neural vocal separation is incomplete:** specific UVR weight redistribution authority and tensor/STFT contract remain unresolved. No UVR/Demucs weights downloaded or fake Neural control shipped. Existing true-stereo DSP remains available. Demucs maintainer restricts its weights to research; Spleeter browser conversion is unvalidated.
- Optional LLM ranking/generative lecture summaries and Kokoro are not integrated. Metadata was investigated; CPU/WebGPU/memory/quality comparisons are not claimed. Notes are genuinely extractive, and moments are deterministic.
- OCR, multilingual synthesized voices, cloning, lip sync and generative footage are not added. No payments, subscriptions or MediaPipe work is included.

## Request-owned changed files

The workspace already contained unrelated uncommitted work; it was not reset. Key files changed for this increment:

- Routes/discovery: `src/app/tools/{shorts-maker,lecture-to-notes,pdf-to-audio}/page.tsx`, existing text-to-speech page, `src/lib/tools/catalog.ts`, `src/app/{sitemap,robots}.ts`, privacy/supported-formats pages.
- Workspaces/shared UI: `src/components/media/{LocalSpeech,TextToSpeech,AudioCleanup,ShortsMaker,LectureNotes,PdfAudio,TranscriptControls,SpeechTool,StoryMaker}.tsx`, `useTranscriptSession.ts`, ToolSurface processing labels.
- Processing/state: `src/lib/localtools/{audio,client,local.worker,speechClient,text,rnnoise,moments,creator-handoff,notes,documentText,pdf,modelAssets,modelCache}.ts` and the Transformers local declaration.
- Native handoff: `src/app/studio/EditorHost.tsx`; vendor `src/reelfinisher/creator-import.ts`, `src/main.tsx`, `src/App.tsx`, `src/hooks/useProjectRecovery.ts`.
- Workers/assets: `tools/local-ai/{speech.worker,noise.worker}.ts`, retained SpeechT5/CMU/ORT notices, `scripts/build-local-ai.mjs`; isolated `tools/{neural-audio,pdf}` package/lock/license files; root package scripts, ESLint and generated-asset ignores, scoped cache headers in `next.config.ts`.
- Tests: unit `notes`, `document`, `moments`, `rnnoise`, `speech-client`, `local-model-cache`, updated allowlist/site checks; browser `creator`, `notes`, `pdf-audio`, `local-model-cache`, `local-ai-compat`, `localtools`, `site`; bounded diagnostic in `silence.e2e.mjs`; generated encrypted PDF and licensed vector fixtures.
- Documentation: this report, implementation/model ledgers, tools matrix, README, TASKS, DECISIONS and research index.

## Exact remaining manual gates

1. **Deployment:** on the intended HTTPS host, configure `SITE_URL`; verify canonical/sitemap links and noindex internal/runtime routes. Cold-download the **244,486,683-byte decoder** through production routing and verify its hash. Check response/streaming limits, timeouts, CDN caching and free-host bandwidth; localhost streaming does not certify a serverless deployment. Confirm homepage has no added isolation and Studio retains its scoped headers.
2. **Real devices:** Android Chrome and iOS/Safari on physical phones, plus lower-memory desktop hardware. Try model loading, generation, mid-job cancel, repeated processing and unsupported codec paths. Record total browser peak memory and failures. Viewport emulation is not a physical-device pass.
3. **Long recordings/jobs:** a real ten-minute Hindi/Hinglish/English recording, repeated transcription and save/reload; a near-5,000-character PDF selection. Verify memory, responsiveness, cancellation and explicit errors. 601-second rejection is tested; full-length performance is not.
4. **Listening/reading quality:** compare complete real passages including names, numbers and abbreviations; inspect sentence joins and pronunciation. Test real fan/traffic/keyboard/hiss/room recordings and clean speech. Synthetic correlations/one Whisper round-trip do not establish broad perceptual quality.
5. **PDF variation:** multi-column pages, tables, embedded Indic fonts, rotated text and mixed image pages. Check text order/missing glyphs before narration; never imply OCR. Confirm actual user PDFs remain local in the browser network panel.
6. **Storage recovery:** with exported backups, simulate quota pressure/eviction and corrupt a public model cache entry. Repair/delete only `reel-finisher-models-v1`, preserving Studio project/media stores. Test actual offline site reload separately; only model-network-blocked cache reuse and native Studio's scoped offline flow are established here.
7. **Release notices:** review the deployed notices/source offers and the exact shipped asset set. All third-party assets do not inherit OpenReel's MIT license. Keep originals and exports before browser-storage maintenance.

Recommended next sprint: complete deployment/device/perceptual gates and speech performance profiling first; then obtain a verifiable, commercially redistributable separation model and validate its exact tensor/STFT/overlap and CPU/GPU paths. Do not add a second speech/LLM stack before measured benefit and a complete license/runtime comparison.

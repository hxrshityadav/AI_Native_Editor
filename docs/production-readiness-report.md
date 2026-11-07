# Reel Finisher production readiness — November 4, 2026

## Release decision: NO-GO

The intended HTTPS deployment/provider has not been identified, `SITE_URL` is unset in this checkout, and no linked deployment configuration was found. Local `next start` results cannot certify production model delivery. A final cold speech attempt also failed with a tokenizer-download 502; the next generation recovered. Physical phones, Safari and human listening gates remain open. This report distinguishes observed results from historical delivery claims and unexecuted checks. No new tools, subscriptions, external inference providers or Studio redesign are included.

Read in full for this audit: `local-ai-delivery.md`, `local-models.md`, `local-ai-implementation.md`, `tools-matrix.md`; repository rules and relevant installed Next route-handler documentation.

## Deployment findings

- `src/lib/site.ts` requires an HTTPS origin with no path, credentials, query or fragment. Without `SITE_URL`, canonical URLs are absent and the sitemap is empty. Configure the **build environment** with the real origin, rebuild, and verify the resulting HTML/XML; supplying an environment variable only to a static deployment after build is insufficient.
- Homepage/landing pages retain the existing brand and server-rendered content. Existing site tests cover canonical metadata, sitemap membership, internal links and editor/lab noindex. Internal routes remain outside the public sitemap. Robots disallows runtimes, model routes, editor assets, lab and legacy editor; Studio has its own noindex metadata. Robots is not an access control mechanism.
- Root model weights are not bundled into Next's deployment: an allowlisted same-origin route streams public Hugging Face assets pinned to reviewed revisions. It does not accept media/text uploads or invoke inference providers. No Range forwarding/resume protocol is implemented: retry restarts a complete asset. PDF.js and RNNoise have versioned immutable headers; Studio isolation headers remain scoped to Studio/editor. Large model routes send octet-stream, Content-Length/ETag where upstream encoding permits, immutable versioned caching and noindex. These headers do not prove that a particular CDN caches the stream.
- Studio retains its separate `/editor-models/` proxy for approved Tiny/Large V3 public assets on `media.openreel.video`. The shared delivery timeout/cancellation and explicit HEAD fixes apply there too, retaining its no-redirect policy. Its mirror `main` URLs/cache scheme were not migrated into the root `v1` cache; do not describe every native Studio asset as SHA-pinned by this sprint. Production mirror provenance/cache invalidation and the optional approximately 760 MB native model require separate deployment verification.
- No project-linked Vercel/Netlify/container configuration or established production URL was available. No deployment was created and no account login was performed.
- The 244,486,683-byte decoder is **not production-host certified**. If Vercel is selected, its [function limits](https://vercel.com/docs/functions/limitations) list a 4.5 MB ordinary payload limit and a Hobby Fluid maximum of 300 seconds. Its [large-body guide](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions) explicitly exempts streaming responses from that size limit. Therefore size alone does not prove failure, and localhost streaming does not prove success. Total streaming duration still matters: transferring this decoder within 300 seconds requires roughly 6.52 Mbit/s sustained throughput, before connection/setup overhead. Confirm the actual plan/runtime/proxy/CDN path and free bandwidth budget. Do not buffer the decoder in a serverless handler.
- Added `node scripts/audit-release-host.mjs https://ACTUAL-ORIGIN`: audits public/internal responses, canonical/sitemap/noindex, decoder HEAD, first observed full hash download, interruption, full retry and two concurrent complete decoder downloads. It writes `output/release-certification/host.json`. **Not executed against a deployment**; invoking it without a URL returns BLOCKED. First observed download does not establish a cold CDN: purge only the relevant deployment asset through the host's authorized tooling, then repeat and record cache-status/age headers. The script transfers approximately four decoder copies and does not establish browser cache/reload behavior.

## Issues fixed

1. Added explicit upstream HEAD, preventing an automatic HEAD handler from opening a GET weight stream.
2. Added 30-second header/read-idle deadlines, upstream abort on client cancellation, stream cancellation propagation and timer/listener cleanup. Active large downloads have no artificial total 30-second deadline. Idle timers pause under downstream backpressure. Hosting maximum duration remains an independent gate.
3. Error responses are no-store/noindex; transient 429/5xx responses retain bounded retries. A client cancellation reports 499 rather than a misleading generic interrupted-download failure where possible.
4. Known cached weight sizes are measured using Blob size before reuse. A truncated entry is individually evicted and becomes a cache miss; only that asset is fetched again. This does not hash every production ONNX read and cannot detect same-size corruption. Speaker vectors retain their SHA-256 check. Unit tests cover cache quota rejection without losing an online job. No cache-wide deletion, database deletion, project migration or storage schema change was introduced.
5. RNNoise retries only its failed runtime fetch with HTTP cache reload after an integrity mismatch. Persistent mismatch directs the user to reconnect or choose existing Light DSP. Removed broad browser-cache-clearing guidance. Model caches remain `reel-finisher-models-v1`; old model caches and Studio stores remain separate.
6. An incremental Next build hit an internal `undefined.length` error; a clean build passed. Production `npm run build` now clears only the verified `.next` directory (rejecting a symlink) before the existing build pipeline. A second clean workflow also passed. This avoids stale build analysis rather than patching framework internals, at the cost of losing Next's incremental build cache. Dependency caches and browser storage are untouched.
7. PDF text containing NUL/replacement-character mappings is flagged by page rather than sanitized without disclosure. A generated embedded-Hind conjunct fixture lost Unicode mappings; independent pypdf extraction confirmed the source PDF contained NUL mappings. The app cannot reconstruct that missing text. Valid embedded Devanagari and damaged mappings have separate regression cases; user review/re-export remains necessary.
   The valid-font case also reproduced an application bug: inserting a space after every PDF text item split adjacent shaped/font glyph runs inside words. Extraction now preserves PDF.js's explicit layout spaces/line endings instead of inventing spaces between runs. Browser tests verify Hindi words, column order and table row separation.
8. English-only synthesis rejects non-Latin scripts before loading speech weights in standalone speech, documents and dubbing. The initial benchmark accepted Hindi and emitted a WAV; that was not a Hindi quality pass. Roman Hinglish cannot reliably be detected by script and remains unsupported, as disclosed. Latin-script names/accents remain accepted; Hindi transcription, manual captions and PDF inspection are unaffected.
9. Device listening reselects an installed local voice when the voice list changes and guards against calling speech synthesis with no explicit local voice. This closes a possible default-voice fallback after a selected voice is removed. Browser-contract regression uses a mocked voice list, not a claim that every OS speech service has been network audited.

Focused tests, complete regression results, browser measurements and remaining risks are recorded below as execution completes. Full hash checks do allocate QA buffers; they are opt-in release verification, not per-inference production hashing.

## Automated execution ledger

Artifacts for this sprint are in `output/release-certification/` (ignored, not shipped). Historical `output/local-ai-*` artifacts are not automatically a pass for this sprint.

| Command | Current sprint result |
|---|---|
| Focused model/cache/PDF Vitest | 21 tests passed across four files, including shaped glyph joins, unmapped characters, unsupported speech scripts and asset delivery guards. |
| `npm run check` | **Passed: 618 tests** (366 root + 188 editor + 64 core), 10 pre-existing skips; typecheck and lint passed. Initial sandbox run could not resolve Corepack; network-enabled reruns passed. |
| `npm run build` | **Passed**, including the corrected native proxy adapter. Repeated clean release builds passed. |
| `npm run e2e` | **704/704 across 21 suites passed on the final build**; previous complete runs also passed. |
| `npm run e2e:models` | **15/15 each** in Chrome, Edge and Firefox; Chrome repeated successfully after the final native-adapter adjustment. |
| `node tests/e2e/release-pdf.e2e.mjs` | **8/8 passed**: columns/order, table/spacing, rotated text, valid embedded Hindi, damaged-mapping warning, 50 pages. Initial Hindi fixture failures led to mapping disclosure and the glyph-join fix. |
| `node tests/e2e/release-headers.e2e.mjs` | **17/17 passed** on final build, including actual native model GET/HEAD, decoder length/MIME/caching/noindex, JS/WASM MIME and scoped isolation. Initial native proxy 502 exposed a request-cloning regression introduced during helper reuse; explicit redirect policy without cloning fixed it. |
| `node tests/e2e/release-privacy.e2e.mjs` | **7/7 passed**, including no pre-download Hindi inference, changing/missing local voices, a real 600-second MP4 and downloaded final-five-second export. |
| `node tests/e2e/release-performance.e2e.mjs` | Six local page/CPU scenarios completed, no pre-consent model requests. Measurements below. |
| Edge / Firefox existing PDF suite | **20/20 Edge, 19/19 Firefox**, with actual extraction, invalid/encrypted/image-only PDFs, cancellation, selection and network checks. Firefox mobile emulation is not exercised. |
| `node tests/e2e/local-ai-compat.e2e.mjs` | **4/4 Firefox**, actual SpeechT5 WAV, 48 kHz RNNoise WAV and same-origin read-only request evidence. |
| `node tests/e2e/release-quality.e2e.mjs` | **Exit 1**: one cold English job failed loading `tokenizer.json` with 502. The next job recovered. Thirty successful/expected-rejection job records followed, including six 60-second noise cases, quota fault, mid-inference cancellation/retry and complete 600-second transcription with a distinct tail. This run is not reported as a clean pass. |

## Browser and real-device scope

Automated desktop tests use installed Chrome/Edge and a portable Firefox. Phone viewport/touch emulation in the normal suite is **not physical Android Chrome testing**. No physical Android/iOS device test or real Safari test has been completed in this sprint. No bundled Playwright Chromium/Firefox/WebKit runtime was present in the default browser cache at audit start; use the installed channels/portable Firefox used by existing tests.

| Actual automated browser | Version | First speech job including model retrieval | Scope |
|---|---|---:|---|
| Chrome | 157.0.8103.38 | 69.948 s | Real SpeechT5/Whisper, hashes/cache/corruption/downloads |
| Edge | 156.0.4314.58 | 97.131 s | Same 15 model checks |
| Firefox portable | 155.0 | 68.059 s | Same 15 model checks; PDF 19/19 and separate SpeechT5/RNNoise 4/4 |

These are fresh browser model-cache runs; interrupted streams occurred before the first synthesis. They do not prove a cold upstream CDN, physical phone performance, or equivalent results on another OS.

Root SpeechT5/Whisper inference uses single-threaded WASM in dedicated workers, with user consent before large optional downloads. RNNoise and PDF parsing use dedicated workers; cancellation terminates owned workers. WebGPU availability is recorded, but these WASM paths do not establish a WebGPU inference pass. WebCodecs/media format compatibility depends on the browser/device. Preserve explicit unsupported-codec errors; do not present viewport tests as codec/hardware certification. AudioWorklet/native editor paths require their own device pass. SharedArrayBuffer/cross-origin isolation stays scoped to existing Studio requirements, without imposing COOP/COEP on the public homepage.

The automated background-tab attempt opened/foregrounded another tab, but the source page still reported `document.visibilityState === "visible"` in headless Chrome. This **does not verify hidden-tab throttling, freezing, lock-screen suspension or OS eviction**. Those remain manual gates rather than a fabricated background pass.

## Speech and noise quality evidence

The release harness generates English, names, numbers, abbreviations, punctuation/joins, a long sentence and Roman Hinglish; it verifies explicit rejection of Hindi input in the final build. Hindi/Hinglish are **unsupported by the English-only SpeechT5 voice**; generating a WAV is not a multilingual quality pass. English output is additionally transcribed locally by Whisper and scored with word-level substitutions/deletions/insertions. This is an ASR proxy, affected by spelling/number normalization and ASR errors, and is not human pronunciation or sentence-join measurement. Independent real LibriSpeech recordings test ASR separately; their transcripts are also resynthesized for complete original/generated listening pairs.

QA-only recordings: LibriSpeech clean validation IDs `1272-128104-0000` and `1272-128104-0001`, from the Hugging Face dummy subset. Original [OpenSLR corpus](https://www.openslr.org/12), Vassil Panayotov, Guoguo Chen, Daniel Povey and Sanjeev Khudanpur, CC BY 4.0. `node scripts/prepare-release-fixtures.mjs` downloads two originals, saves measured hashes/metadata and attribution. No QA recording is shipped in the app. Noise fixtures are **real human speech mixed with deterministic synthesized noise**, named fan/traffic/keyboard/room/hiss proxies plus clean speech. These are not recordings of those real environments.

The harness retains complete original/processed WAVs and sample-count/clipping/RMS/correlation measures. These measures cannot determine metallic artifacts, lost consonants, natural pronunciation or user acceptability. **No complete human listening review has been performed.** Actual real fan/traffic/keyboard/room/hiss recordings still require a consented listening comparison. Existing DSP remains available.

Actual SpeechT5 measurements (wall time includes worker initialization/model loading where needed, not just synthesis):

| Passage | Wall seconds | WAV seconds | Sampled aggregate RSS MiB | Local Whisper proxy S / D / I; raw WER |
|---|---:|---:|---:|---|
| English, initial successful baseline | 71.771 | 5.284 | 2,060.5 | 1 / 0 / 0; 6.3% |
| Names, final run after cold failure | 64.845 | 4.744 | 2,044.0 | 4 / 1 / 0; 38.5% |
| Numbers | 21.333 | 6.244 | 2,318.2 | 4 / 5 / 0; 52.9% |
| Abbreviations | 16.816 | 5.836 | 2,409.5 | 4 / 2 / 0; 35.3% |
| Punctuation/sentence joins | 22.166 | 6.860 | 2,483.0 | 1 / 1 / 0; 10.5% |
| Long sentence | 33.462 | 11.076 | 2,499.6 | 0 / 0 / 0; 0% |
| Roman Hinglish, unsupported | 11.470 | 5.668 | 2,350.5 | Not a supported-language quality pass |
| Hindi, final build | 0.172 | No output | No sample | Rejected before model initialization; separate UI test confirms zero weight requests |

S/D/I above are **recognizer token substitutions/deletions/insertions, not human-measured audible mistakes**. Numerals (`twenty three` versus `23`), contractions, abbreviated names and merged proper names inflate raw WER. Abbreviation/name output also needs direct listening; no pronunciation or join-quality score is claimed. Original human recording ASR baselines were 1/0/0 over 17 words (5.9%) and 2/0/0 over 10 words (20.0%), taking 7.874/7.856 seconds; this demonstrates why Whisper cannot be treated as perfect ground truth. Their 5.855/4.815-second originals were resynthesized to 6.400/4.864-second WAVs in 21.978/18.749 seconds. Baseline evidence: `quality-initial.json`; final evidence: `quality.json`. `english.wav` is the earlier successful baseline, not a successful output from the final failed cold attempt.

For each final RNNoise case, 60 seconds of repeated real English speech was mixed with controlled synthetic noise (or retained clean). All outputs decoded as WAV, retained **960,000 frames at 16 kHz**, and measured **zero clipped samples**:

| Controlled case | Wall seconds | Output/input RMS | Correlation to clean reference | Sampled aggregate browser RSS MiB |
|---|---:|---:|---:|---:|
| Fan proxy | 3.226 | 0.881 | 0.962 | 1,143.3 |
| Traffic proxy | 3.208 | 0.908 | 0.967 | 1,143.2 |
| Keyboard proxy | 3.093 | 0.909 | 0.959 | 1,137.5 |
| Room proxy | 3.161 | 0.970 | 0.981 | 1,140.1 |
| Hiss proxy | 3.245 | 0.930 | 0.970 | 1,095.3 |
| Clean speech | 3.312 | 0.977 | 0.983 | 1,099.8 |

RMS ratios include speech and are not noise-only attenuation scores. These RSS samples include residency retained from earlier speech jobs; they do not mean standalone RNNoise requires 1.1 GiB. One corrupt-runtime fetch recovered automatically; persistent corruption was rejected after retry, and Light DSP subsequently produced a valid 5.855-second WAV in 1.003 seconds. Full A/B files are retained as `fan/traffic/keyboard/room/hiss/clean-{original,processed}.wav` in the artifact directory.

## Memory, long jobs and PDF compatibility

Test host: Windows x64, Intel Core i5-12500H, 16 logical CPUs, approximately 15.63 GiB RAM. The release harness samples owned browser process WorkingSet64 every two seconds using CDP process IDs. Reported aggregate RSS can count shared pages more than once; it is neither unique memory nor an exact peak. Jobs share one browser sequence: retained allocations/compiled code from earlier models may remain resident, so a noise-job RSS figure is not RNNoise's standalone/incremental memory requirement. Worker/WASM memory is included through process sampling rather than only page JS heap. Sampling invokes PowerShell and adds overhead. Real-device/low-memory pressure, tab eviction and crash testing remain separate gates.

Loopback production-build page observations at 1280×900 (Chrome, no media/models imported):

| Page | CPU rate | TTFB ms | FCP ms | Observed LCP ms | Transferred bytes |
|---|---:|---:|---:|---:|---:|
| Homepage | 1× | 14.8 | 288 | 288 | 674,973 |
| Speech | 1× | 9.6 | 224 | 224 | 409,914 |
| PDF audio | 1× | 8.3 | 208 | 208 | 411,435 |
| Homepage | 4× slowdown | 12.6 | 340 | 588 | 674,973 |
| Speech | 4× slowdown | 6.1 | 480 | 480 | 409,914 |
| PDF audio | 4× slowdown | 7.7 | 460 | 460 | 411,435 |

All six scenarios made zero model requests before consent. Resource bytes include same-origin resources/navigation; browser contexts are new but OS/server caches may be warm. LCP observation ends 1.5 seconds after fonts are ready. This is not finalized field Core Web Vitals, a slow-network production measurement, or a mobile/low-memory device pass. Raw evidence: `performance-local.json`.

Ten-minute testing uses a WAV made by repeating a real English recording, with a distinct second passage at 590 seconds and silence padding to exactly 600 seconds. It measures duration/memory/chunk handling and final-passage recognition, not diverse ten-minute conversational accuracy. Existing 601-second rejection remains tested; the 600-second source ceiling is preserved. Cleanup/dubbing retain their existing shorter 120-second limit. No limit was raised to make a test pass.

The final 600-second transcription completed in **279.371 seconds**, produced 120 ordered cues and recognized the distinctive final passage at **590.4–594.4 seconds**; sampled aggregate RSS was 2,122.6 MiB. This proves processing reached the tail, not accurate timing for every word. A repeated-sentence cue at 585.12–585.84 seconds is implausibly short for its text; real varied-recording timing review remains required. Mid-inference cancellation was triggered 750 ms into synthesis and 1,000 ms into recognition (total job times 4.588/4.657 seconds including initialization). Fresh synthesis/ASR jobs after cancellation succeeded in 9.765/7.473 seconds. A quota-write fault still produced a valid 3.296-second WAV in 16.169 seconds without persisting the speaker entry. This injected fault is not actual full-disk/OS storage-pressure testing.

The highest final sampled aggregate browser RSS was **2,499.6 MiB**; the initial baseline reached 2,561.0 MiB. These observations warrant real low-memory testing and do not establish a minimum supported RAM specification. The separate 600-second H.264/AAC MP4 was accepted and its precise final-five-second downloaded export decoded successfully. Ten-minute full-video rendering and diverse real ten-minute Hindi/Hinglish speech were not tested.

The additional PDF suite generates multi-column, table, rotated text, embedded Devanagari font and 50-page PDFs and inspects actual browser-extracted text. Existing PDF tests cover corrupt/encrypted/image-only/mixed documents, 51-page and byte limits, parser failure/cancel/retry, large selections without truncation and mobile layout. Generated fixtures do not replace testing varied real PDFs. Embedded text extraction is not OCR; users must review reading order before narration. Physical low-memory extraction and a near-5,000-character completed synthesis remain manual gates unless explicitly measured below.

## Privacy/network and storage

The browser suites record request origins/methods during local processing. Same-origin GET/HEAD-only traces provide evidence for the exercised root workflows; they do not certify untested tools or all third-party browser extensions. Server-side model retrieval is exclusively allowlisted public weights/configuration. Existing cloud inference routes remain opt-in and disabled in local-only QA. Never upload user fixtures for speech quality evaluation.

The final quality run also recorded only same-origin GET/HEAD HTTP requests (`privacySameOriginReadOnly: true`). No automatic external inference or media/transcript upload was observed in the exercised workflows. Model SHA-256 and browser reload/cache-reuse evidence is in `output/local-ai-cache/hashes-{chrome,msedge,firefox}.json`; the exact decoder size/hash and no-redownload checks passed in all three browsers. No actual deployment HAR was captured.

Cache corruption tests use isolated browser contexts and scoped model entries. Quota faults are injected into model CacheStorage writes, without filling the developer's disk or clearing browser storage. Studio cache and IndexedDB sentinels verify preservation. Real storage eviction/quota exhaustion and same-size ONNX corruption recovery remain manual/unresolved. Back up real Studio projects before any device-level pressure test; never delete all databases or unrelated caches to repair a model.

### Dependency advisory audit

Read-only npm production audits returned zero reported advisories in the root app and isolated `tools/pdf`, `tools/neural-audio`, `tools/ort` installs. This is not a general security certificate. The full vendored pnpm workspace audit returned **66 advisories** (1 critical, 17 high, 41 moderate, 7 low), including unused cloud/image/desktop applications. Filtering reported paths to `apps__web` or `packages__core` leaves 40 advisories across DOMPurify, protobufjs, @protobufjs/utf8, uuid, sharp, @opentelemetry/core and fflate. Raw evidence: `output/release-certification/*audit*.json`.

Reachability matters: analytics has hardcoded empty credentials and returns before importing PostHog; the inspected root browser bundle excludes sharp and contains no `fromJSON` reflection property. These observations are not a full bundle-level security proof. The [critical protobufjs advisory](https://github.com/advisories/GHSA-xq3m-2v4x-88gg) and [bytes-default advisory](https://github.com/advisories/GHSA-66ff-xgx4-vchm) require attacker-controlled schemas/descriptors; trusted application-defined schemas are explicitly outside their direct impact. The reviewed model routes accept approved public model assets rather than arbitrary schema uploads. No exploitable schema path was reproduced here. Before GO, complete shipped-code reachability review and either document justified non-applicability or upgrade/rebuild affected dependencies with regression/licensing verification. A lockfile override alone does not repair vulnerable code already embedded in prebuilt runtime bundles. No blind dependency upgrade or claim that all 66 advisories are deployed exploits was made.

## Remaining blockers and risks

| Priority | Open item | Why it remains open |
|---|---|---|
| Release blocker | Intended HTTPS deployment, `SITE_URL`, 244 MB production delivery | No target/provider was supplied. No actual production cold/interrupted/concurrent/cache/reload test was possible. |
| Release blocker | Model delivery reliability | Final quality run had a cold tokenizer 502 despite bounded server retries; a subsequent job recovered. Determine the intended host/CDN/static-asset strategy and prove repeated delivery rather than treating the successful retry as a clean run. |
| Release blocker | Supported-device certification | No hands-on Android/iOS/Safari or low-memory-device pass; sampled desktop browser RSS reached about 2.5 GiB. |
| Release blocker | Perceptual/temporal quality signoff | No complete human listening review; names/acronyms need review, and long ASR includes an implausibly short repeated-sentence cue. Do not certify pronunciation, noise artifacts or subtitle timing from proxy metrics. |
| Review required | Vendored dependency advisories | Distinguish actual shipped/reachable code from unused workspace packages and frozen bundles; record non-applicability or rebuild verified patches. No exploit was reproduced. |
| Unverified recovery/compatibility | Same-size corrupt weights, real quota/eviction, hidden-tab suspension, varied real PDFs/recordings | Scoped truncation/vector repair and injected quota failure are tested; they do not cover these device/OS/document conditions. |

## Exact remaining release gates

1. Supply the intended HTTPS origin/provider/plan. Set `SITE_URL` in the deployment build, rebuild and run the host audit there. Confirm response MIME/Content-Length/hash, CDN headers, cache misses/hits, interruption cancellation, retry, concurrency, slow-network duration limits and serving cost on the free tier. Capture a production HAR with model assets installed, reload/new worker, then block model network and repeat; do not substitute localhost evidence.
2. Physical Android Chrome and iOS Safari: record OS/browser/device/RAM; cold model consent/download, initialization, repeated jobs, cancel at download/inference, background/lock/unlock, file download/open, refresh, codec fallback and a 600-second input. Include a genuinely low-memory device; record crashes/OS tab eviction and recovery. Repeat supported desktop Firefox/Edge/Chrome on representative hardware.
3. Human listening signoff: listen end-to-end to every original and processed noise pair and all generated passages. Score missing/incorrect words, names/numbers/abbreviations, pronunciation, sentence joins, consonants, metallic artifacts, clipping and volume changes. Include real noisy recordings and Hindi/Hinglish source ASR; English-only TTS must never be advertised as Hindi/Hinglish support.
4. Real ten-minute Hindi/Hinglish/English recordings, repeated transcription, multiple successive jobs and a near-5,000-character PDF audio selection. Measure wall time/process memory, verify final timestamps, responsiveness, cancellation and source preservation. Refresh mid-job; confirm no stale download appears and cached assets/project records remain recoverable.
5. Test real multi-column/table/rotated/embedded Hindi/mixed/large/corrupt/encrypted PDFs. Compare every extracted page with its source, especially reading order/glyphs. Confirm scanned pages are identified without any OCR promise.
6. In a dedicated test browser/profile with exported backups, exercise actual quota exhaustion, cache eviction and same-size corrupt ONNX bytes. Recover only affected versioned public assets; verify unrelated Studio project/media records before/after. Do not use clear-site-data or blanket IndexedDB/cache deletion.
7. Review deployed license notices/source offers, privacy/support text, mobile download behavior, public crawlability and performance under the intended host. Sign off each remaining gate with actual evidence before changing this decision to GO.
8. Close the vendored dependency advisory triage against the actual browser/server artifacts, including frozen/prebuilt ONNX runtimes. Preserve matching source/notices when rebuilding. Do not equate root `npm audit` passing with the whole vendored workspace being advisory-free.

### Manual execution worksheet (not executed)

For every run record device model/RAM/OS/browser version, deployment URL/build ID, source duration/codec, start/end time, sampled memory method, output probe results and HAR. Use test-only profiles and consented recordings.

| ID | Exact action | Required evidence/pass criterion |
|---|---|---|
| HOST-01 | Configure real build origin; fetch homepage, each public tool, robots and sitemap on HTTPS | Self-canonical URLs on the intended origin; no localhost/invented origin; only working public tools in sitemap; internal pages return noindex. Confirm actual search crawler access to directives; robots Disallow alone is not deindexing. |
| HOST-02 | Purge only the reviewed model asset through authorized host tooling; run the host audit, then reload in a fresh browser | Full decoder is 244,486,683 bytes with recorded SHA-256; response streams; cache status/age and total duration recorded. Repeat under slow network and two concurrent clients without host truncation/timeouts. |
| NET-01 | Start a private test profile with DevTools Preserve log; import private test media/PDF, edit, transcribe, clean and export | No media/transcript POST, third-party inference or analytics; model GETs are approved public assets. Review deployment cloud flag and retained notices without exposing provider keys. |
| PHONE-01 | On physical Android Chrome and iOS Safari, cold-load optional models after consent, generate twice, download and independently open output | Record initialization time, output MIME/codec/duration and total memory/crashes; a clear unsupported-device error is acceptable only for explicitly unsupported operations, without a fake output. Viewport emulation cannot sign this off. |
| CANCEL-01 | Cancel at 20–50% of download; retry; then cancel 1–5 seconds after inference begins; repeat three times | No stale output/download, no orphan worker, retry succeeds, completed unrelated model entries and Studio projects survive. |
| BG-01 | During inference switch tabs for two minutes, lock/unlock the phone, then return; repeat with refresh | Record visibility/OS eviction. Job resumes or fails clearly; refresh does not invent success. Reselect source when required; saved Studio project recovers. |
| LONG-01 | Use real distinct ten-minute English/Hindi/Hinglish recordings and one ten-minute phone video | Inspect first/middle/final cues against source, trim/export the end, verify A/V sync and retained 600-second ceiling. A repeated-clip benchmark does not establish conversational accuracy. |
| STORE-01 | In a dedicated test profile/origin, apply a small origin quota override; perform first and repeated downloads | Online operation fails clearly or continues without persistence; quota failure does not erase projects. Record usage/quota before/after. Do not fill the user's drive or clear site data. |
| CACHE-01 | With exported backups and project/cache sentinels, corrupt one public model key with same-sized bytes, then retry | Reject bad inference; remove/re-download only the affected public model entry. Verify unrelated caches and IndexedDB records byte-for-byte. Same-size corruption currently requires this scoped manual recovery. |
| PDF-01 | Read real columns/tables/rotations/embedded Indic/mixed/large/encrypted/corrupt PDFs; select nearly 5,000 English characters | Compare every selected character/row/page to source, review warnings, complete narration/cancel/retry. Scanned pages are identified; no OCR claim or upload. |
| VOICE-01 | Listen completely to `english.wav`, `names.wav`, `numbers.wav`, `abbreviations.wav`, `joins.wav`, `long.wav` and each `*-resynthesized.wav` beside the original recordings | Record human missing/incorrect-word counts, pronunciation and join defects with timecodes. Separate numeral/spelling normalization from audible errors. Hindi rejection and unsupported Roman Hinglish must be disclosed. |
| NOISE-01 | Listen completely to each `*-original.wav` / `*-processed.wav` pair, then repeat with consented real fan/traffic/keyboard/room/hiss and clean recordings | Record metallic artifacts, consonant loss, speech distortion, clipping and gain changes with timecodes; compare Light DSP. Synthetic-noise correlation is not a listening score. |

Complete each worksheet entry with an actual PASS/FAIL and artifact reference; no entry above is pre-approved.

## Sprint-owned changes and reproduction

The checkout contained unrelated uncommitted work before this audit. It was not reset or committed. No new product routes/tools or dependencies were introduced, and no Studio project/history/rendering code was replaced.

- Delivery: `src/lib/localtools/modelDelivery.ts`; root and editor model `route.ts`; scoped size recovery in `modelCache.ts`.
- Processing/UI: `text.ts`, `documentText.ts`, `pdf.ts`, `tools/local-ai/noise.worker.ts`; `PdfAudio.tsx` and `TextToSpeech.tsx` for errors, local-voice selection and recovery copy.
- Build: `package.json`, `scripts/clean-next-build.mjs`, `.gitignore`.
- Unit tests: `model-delivery.test.ts`, `local-model-cache.test.ts`, `modelAssets.test.ts`, `pdf-text.test.ts`.
- Browser tests: expanded `local-model-cache.e2e.mjs`; new `release-{headers,privacy,pdf,performance,quality}.e2e.mjs`.
- QA tooling/docs: `scripts/{prepare-release-fixtures,audit-release-host}.mjs`, this report, and the model inventory's recovery notes.

Reproduction order (heavy browser commands serial):

```text
npm run check
npm run build
npm run e2e
npm run e2e:models
node scripts/prepare-release-fixtures.mjs
node tests/e2e/release-headers.e2e.mjs
node tests/e2e/release-privacy.e2e.mjs
node tests/e2e/release-pdf.e2e.mjs
node tests/e2e/release-performance.e2e.mjs
node tests/e2e/release-quality.e2e.mjs
```

Set `LOCAL_CACHE_BROWSER=msedge` or `firefox` for the model suite, and `PDF_BROWSER=msedge` or `firefox` for the existing PDF suite. The portable Firefox path in the existing tests must exist or be replaced with an explicitly installed test executable. Windows/ffmpeg/ffprobe are required by these release fixture/measurement scripts; they are developer tools, not production dependencies. The quality script writes public test transcripts/audio only, and retains partial JSON observations after each job.

# Reel Finisher launch audit — 2026-10-27

Status: stabilization fixes tested; public launch still has the deployment, device and notice-review gates listed below. This is a source and local production-build audit, not a certification of the deployed public site.

## Findings and priorities reported before implementation

1. **P0 — marked-range ripple deletion was disconnected.** `TimelineRange.tsx` marked only a preview loop. Toolbar/keyboard ripple actions derived time from selected media clips, ignoring those marks. Existing gap tests covered clip context menus, not this interaction.
2. **P0 — native import bypassed the 600-second policy.** The legacy validator already specifies 600 seconds; OpenReel's import service had no equivalent guard. Its generic decode flag also allowed audio support to mask an unsupported video codec.
3. **P1 — production/browser evidence was incomplete.** Earlier coverage used Playwright Chromium and phone emulation. It did not establish installed Chrome/Edge, Firefox/Safari, real phones or a public deployment. Full native trim/split/range/export tests were needed.
4. **P1 — SEO/disclosure omissions.** The actual `src/app` tree contained the homepage, studio, legacy studio and lab, with basic metadata. There were no pre-existing tool landing pages, robots file, sitemap, canonical origin, privacy page or format documentation to preserve. The homepage linked the internal lab.
5. **P1 — notices needed a distribution audit.** OpenReel's MIT copyright and license exist in the source and generated editor. That license does not replace dependencies' licenses. Runtime copies already include ONNX/Transformers notices, Mediabunny's MPL source/license and OFL font notices. A bundle inventory was missing.
6. **P2 — performance and advanced-feature coverage remain risks.** The fork contains large application/runtime chunks and automatically installs an offline asset cache. Not every upstream effect, project type or exporter has been validated.

Order: repair and verify ripple first; enforce import/codec policies; run production browser/media tests; address crawl/disclosure/notices; record measured results and remaining launch gates. No MediaPipe work or new AI/billing features is authorized by this audit.

## Actual integration

| Area | Evidence / behavior |
| --- | --- |
| Provenance | `vendor/openreel/UPSTREAM.json` pins `367d7e90b61b5181f9861b852bb8b9d7a7d2954a`. Copied source fork, no nested Git checkout; local changes documented in `REEL_FINISHER_PATCHES.md`. This pin identifies the declared base, not a claim that the modified tree is identical to upstream. |
| Packaging | Private pnpm workspace; web package 0.1.2, core 0.1.0, pnpm 11.7.0. Root remains npm/Next.js. No published editor package was installed. |
| Active studio | Next `/studio` renders a client host and same-origin `/editor/index.html` iframe. Vite builds the fork separately with `/editor/` asset base. Its React/Tailwind providers/styles are isolated from the Next application. |
| Authoritative engine | Native OpenReel project store, action history, multi-track video/audio/text engines and native WebCodecs/MediaBunny export. RF captions use a shared rendering adapter in native preview and export. |
| Retained systems | `/studio-legacy` and `/lab` still use `useReelSession` and the older RF source-cut/render pipeline. `src/lib/edit` and `src/lib/editor` also remain. This is deliberate route isolation and migration/rollback support; those engines must not be joined to the new timeline. Some shared pure caption/time helpers are imported by the fork. |
| Preserved features | Manual captions, Hindi/Hinglish text, local fonts/uploads, styles/brand presets, caption overrides/animations, SRT, local Whisper, silence review and explicit read-only legacy migration exist in RF adapters. Native versions of some caption/audio tools also remain. Their existence is not proof of full behavioral parity. |
| Migration | Reads old IndexedDB without replacing its records; validates reselected media fingerprint; creates a separate native project. Unsupported settings are reported. Preserve originals and the legacy route until real-project parity is accepted. |
| Local default | Remote fetch/XHR, beacon and connected sockets are blocked in the fork; CSP restricts connections to self/blob/data. Cloud API routes return LOCAL_ONLY unless explicitly enabled by self-host configuration. No account or provider key is needed for core editing. |
| Optional model requests | User-confirmed static GETs through the allowlisted same-origin model proxy; no media request bodies. Models are not part of the initial application and have their own upstream terms. |

## Timeline correction

The shared `rippleDeleteSelection` command gives marked In/Out time precedence over selected clips. It is used by range controls, toolbar and Shift+Delete. With no marks, selected-media ripple behavior is retained. Ordinary Delete and caption deletion remain separate.

All affected tracks, RF captions, native subtitles, overlays, marker times and supported local keyframes are transformed together, then committed as one native snapshot. Rejected locked/unsupported edits do not commit. In/Out marks clear after success, and playhead time maps to retained output. Source intervals use the clip's affine source/output relationship, including constant-speed reverse. Splits now keep a later transition attached to the retained end fragment.

Unsupported synchronized edits remain explicit: deleting all project time; intersecting transitions, speed ramps/freezes or eased keyframes; nested/motion compositions, masks, adjustment layers and multicam. These return a recovery error rather than guessing at synchronization. Tracks wholly before the range are preserved; later clips move by the removed duration because the operation removes global output time.

Additional integration defects reproduced during testing:

- Browser **Separate Audio** still called the disabled FFmpeg path. It failed before changing the project. The browser path now uses MediaBunny conversion to extract the selected recorded stream as PCM WAV; it discards video and other audio streams. The desktop sidecar path is unchanged. This is a targeted replacement of a demonstrably broken browser path.
- Firefox 155 emitted valid H.264 video packets with malformed `avcC` metadata containing duplicated SPS/PPS NAL headers. The exact descriptor signature is normalized before muxing. Valid descriptors and encoded picture data are unchanged. Final Firefox files produce no FFmpeg decode errors.
- The old decode helper threw away stderr on a successful process exit, masking those errors. It now preserves stderr. Its null-output encoder uses a microsecond clock so distinct fractional-cut timestamps do not collapse to the same 1/fps output timestamp. A legacy false alarm was checked against strictly increasing input packet timestamps before adjusting this measurement.
- A new separation test initially inspected any historical autosave slot. It now waits for the latest slot and checks that audio remains after caption edits, range removal and reload. Temporary state tracing was removed.

## Browser/runtime requirements

- The Vite editor executes only in its browser iframe; Next does not server-render its browser engines. Legacy clients are separate client components.
- WebCodecs decoder/encoder availability depends on secure context, browser, OS and selected codec. MediaBunny probes actual codecs; browser export does not promise ProRes/high-depth/alpha. There is no shipped FFmpeg conversion fallback.
- WASM is used by audio analysis and optional local speech inference. Whisper Tiny uses WASM; the larger model may try WebGPU and fall back to WASM. GPU acceleration is not a universal requirement for basic composition; GPU effects have additional requirements.
- Shared memory/threaded speech runtime needs isolation. COOP/COEP/CORP apply to `/studio`, its offline worker response and `/editor/*`, not the homepage/information pages. Editor dependencies/fonts/runtime assets are served locally to avoid COEP failures. Test deployment/CDN header preservation separately.
- AudioWorklet processing falls back to standard audio nodes when initialization fails. Playback still requires a user gesture.
- Decode/model/analysis workers already exist. Native export orchestration and canvas composition still perform work on the UI thread; asynchronous encoding does not establish that every effect is off-thread. Do not claim worker-only export or real-phone performance.
- `/editor/` worker only removes its own cache prefix. The separate `/studio` offline shell only intercepts exact studio navigation. Model storage is separate. Storage quota/eviction and cancelled cache installation need real-device testing.

## License inventory limits

The build now emits `editor/licenses/bundled.json` and copies available package LICENSE/NOTICE/COPYING/COPYRIGHT files for modules in generated application chunks. Main bundle source comments and upstream notices are retained. Worker runtime licenses and unmodified Mediabunny source are distributed separately; RF font OFL files remain under `/fonts/`.

Review the generated inventory before release. In particular GSAP declares a custom Standard “no charge” license, not MIT; its package README links those terms. Three.js font JSON includes embedded notices. Optional model weights, uploaded fonts, and any user-added stock/template media have separate obligations. This inventory is not a legal determination or an exhaustive binary subcomponent attribution review; ONNX/WASM transitive notices and any packages with no license file require a release review. No FFmpeg package/runtime is intended to ship.

The inventory flags package-local notice-file gaps for Astryx core, MediaPipe tasks-vision (already present upstream; no segmentation work was added), several Radix helper packages, StyleX, `format`, GSAP, ONNX Runtime, react-remove-scroll-bar and splaytree. `format` has no license field in its detected package metadata. OpenReel itself is covered by the retained upstream MIT file, and ONNX has a separately copied license; an empty package-local list is not by itself proof that no notice exists elsewhere. Confirm the other copyright/notice sources and binary subcomponents rather than treating the inventory as a compliance pass.

## Deployment / SEO

Public production origin must be supplied as `SITE_URL=https://your-actual-domain`. It must be an HTTPS origin without a path. Without it, canonical URLs and sitemap entries are deliberately omitted rather than publishing localhost or an invented domain. Set it before the production build and verify the deployed result.

Homepage branding and pitch remain. Privacy and supported-format pages are server-rendered and linked. Only those real informational pages enter the sitemap. Studio, internal lab, rollback editor, editor assets and model endpoints are excluded from indexing via metadata/response headers and crawl rules where appropriate. Robots exclusion alone does not remove an already indexed URL.

## Results and remaining tests

`npm run check` passes: lint, Next type generation/root TypeScript, fork TypeScript, **300 root tests + 188 fork web tests + 64 core tests**. Six database tests require `TEST_DATABASE_URL`; four pre-existing upstream project-store tests remain skipped. They are not counted as passes. `npm run build` passes with webpack. Warnings remain for large Vite chunks, old browser-support datasets, Rollup comment annotations and a root-served font resolved at runtime; browser tests load that font successfully.

The complete native workflow passes **34/34 in installed Chrome 156.0.8078.48, 34/34 in installed Edge 156.0.4314.50 and 34/34 in Firefox 155.0**. These are automated headless sessions on the Windows host, not manually operated device certifications. The native fixture contains two four-second colored videos with distinguishable 440/880 Hz tones, a separated audio track, manual Hindi text and a 50% gain edit. Tests use public controls for play/pause, trim, split, separation, caption editing, range deletion, undo and redo. Project autosave/recovery, offline edits and actual downloaded MP4s are checked. Range removal reduces project time 8 → 6 seconds; decoded A/V duration tolerance is 50 ms, frequency tolerance 15 Hz, and independent HTML video playback must reach the expected end within 100 ms. Caption preview/export mean RGB difference is approximately 5.2/255 on this fixture (threshold 8). This is not proof for every effect, codec, project size or font.

The final **`npm run e2e` exits 0**, with installed Chrome selected for the native studio workflow. Suite totals: lab 67/67, legacy studio 39/39, server 20/20, phone simulation 8/8, silence 16/16, advanced 42/42, manual 42/42, legacy ripple 20/20, native editor 34/34, migration/native gap 9/9 — **297/297 checks**. The server's shared database-row test remains skipped without `E2E_DATABASE_URL`. Separate Edge, Firefox and launch-audit runs bring the executed browser checks to **386/386**. Logs and media are under ignored `output/launch-*.log`, `output/launch-browser/`, `output/launch-firefox/` and `tests/e2e/.out-openreel/`; the synthetic range export is `tests/e2e/.out-openreel/range.mp4`.

`node tests/e2e/launch-audit.e2e.mjs` passes **21/21**: server-rendered public pages, robots/sitemap structure, noindex internal routes, 404, MIT/bundle inventory delivery, scoped headers, mobile information-page widths and browser startup. Chrome, Edge and Firefox report secure context, isolation, shared memory, WASM, WebCodecs and AudioWorklet. WebGPU API presence was recorded; hardware effectiveness was not established. No external application requests were observed during basic startup/edit/export, and cloud-processing routes returned LOCAL_ONLY. Browser-internal Edge downloads-hub URLs are excluded from application network assertions; external HTTP(S) application requests still fail.

The generated editor distribution is approximately **78 MB**, approximately **67 MB of WASM**, excluding optional speech models. On the final startup check, home readiness was measured locally at **479 ms Chrome, 373 ms Edge and 1792 ms Firefox**; these are unthrottled local startup observations, not production or real-mobile performance targets. The longest measured host task was 135 ms; Firefox does not provide the same long-task measurement here. Iframe effect/export stalls and peak real-phone memory have not been comprehensively measured. The bundle inventory lists 110 packages and highlights packages with no standalone notice file; review those, GSAP terms and WASM/model subcomponents before release.

### Exact manual / deployment gates still needed

1. Set the actual HTTPS `SITE_URL` **before building**, deploy the build, fetch `/`, `/privacy`, `/supported-formats`, `/robots.txt`, `/sitemap.xml` and `/studio`; verify exact canonical hosts, sitemap entries, noindex responses and isolation through the real CDN. Confirm ordinary landing pages remain unisolated. No public origin was supplied in this session, so public canonical entries are not verified.
2. On real Android Chrome and iPhone/iPad Safari, import a representative ten-minute 1080p video, reject a 601-second video, edit Hindi captions, detach/adjust audio, split and ripple across multiple tracks, undo/redo, save/reload, export and play in a separate OS player. Record RAM/temperature, responsiveness, interruption/retry and actual available codecs. No real-phone or Safari result is claimed.
3. Test long sessions, two tabs, near-full storage, explicit storage denial, browser restart, tab termination during a save/export, cancelled imports/model downloads, and browser cache eviction. Verify recovery from retained originals. Existing unit cancellation/storage tests and a successful offline reload do not establish these hardware outcomes.
4. Test real-world projects with transitions away from cuts, linear automation, source speed/reverse, captions and overlays. Attempt an affected locked track and unsupported advanced edits; confirm clear rejection and no state/history changes. Unit coverage exists; broad interactive native multi-track fixtures remain needed.
5. On supported target devices, test WebM/Opus fallback, HEVC/HDR/rotated phone sources and unsupported encoders. Current native media export evidence is primarily H.264/AAC at 320×180; legacy suites and unit codec probes are separate evidence.
6. Review the generated license inventory and missing notice files against the exact shipped dependencies and WASM binaries. Confirm optional speech-model and uploaded-font/stock-media rights separately. The retained MIT license alone is insufficient for this review.
7. Re-run a confirmed local model download/transcription and its offline recovery on target devices; the prior integration's Tiny speech test is historical evidence, not a fresh test in this audit. The accurate model is unverified. Core editing tests in this audit do not download or invoke an AI provider automatically.

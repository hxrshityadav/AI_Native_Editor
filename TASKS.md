# Tasks

Statuses: **Not started** · **In progress** · **Implemented** (code exists, not tested) ·
**Tested** (automated tests pass) · **Verified on a real device**.

Automated media checks use generated fixtures on Windows, including installed Chrome/Edge, Firefox and Pixel 7 viewport emulation. Earlier milestones retain their original platform notes. No task is verified on a real phone yet.

## Sprint 1 photo utilities (2026-10-27)

- **Tested:** shared local worker/canvas processing, compressor with measured size targets, resizer with ratio/presets, converter with alpha/background handling; four crawlable tools routes and production-origin metadata/sitemap integration. No dependencies added.
- **Tested:** 560 unit tests pass (ten existing skips); lint/typechecks and clean production build pass. Generated-file photo suite passes 44/44 in Chrome and 44/44 in Firefox, including pixels/alpha/orientation, cancellation, fallback, URL cleanup and mobile viewport checks.
- **Tested:** final full editor/photo regression passes 341/341 checks, preserving `/studio`, `/studio-legacy` and `/lab` workflows. See `docs/photo-utilities.md` for changed files, limits, evidence and remaining manual checks.
- **Not started:** real mobile/Safari/Edge image-tool verification and deployed canonical/CDN checks.

## Free-launch integration audit (2026-10-27)

- **Tested:** marked-range ripple deletion, separate audio, captions, native history, offline reload and independent MP4 playback in installed Chrome/Edge and Firefox. Full E2E 297/297; separate Edge 34/34, Firefox 34/34 and launch audit 21/21. See `docs/launch-audit.md` for findings and exact remaining gates.
- **Tested:** lint/typecheck and unit checks: 300 root, 188 fork web, 64 core tests; six database and four pre-existing upstream tests skipped. Production build passes.
- **Tested:** native 600-second guards (unit boundary checks and actual 601-second import rejection), unsupported-video codec recovery, Firefox AVC descriptor repair, browser-native recorded-audio extraction, SEO crawl controls, privacy/format pages and delivery of bundled dependency notices. License completeness and public canonicals are separate gates below.
- **Not started:** public-domain/CDN validation (requires actual `SITE_URL`), real mobile hardware and Safari validation, long-session/storage-eviction tests, and final transitive/binary license-notice review. No MediaPipe, billing or new AI features were added.

## OpenReel local browser integration (2026-10-26)

- **Tested:** pinned source fork, root npm/pnpm build orchestration, isolated /studio iframe, /editor assets, COOP/COEP/CORP, editor CSP and scoped offline caches.
- **Tested:** native multi-file timeline/export, manual Hindi captions, local fonts, caption extensions and shared history, SRT, source fingerprint migration and project-wide gap removal.
- **Tested:** fast Whisper model download/cancellation and real speech recognition, including cached recognition after an offline reload. Media and transcript remain in the browser.
- **Tested (2026-10-27 closeout):** production build; root checks (294 tests, six database tests skipped); focused fork checks (168 tests, four upstream tests skipped); 69 additional core timeline/transition tests. The complete legacy/browser suite passed, and the final editor rerun passed 22/22 plus migration/gap tests 9/9, including real local speech recognition and offline export. Cached-load readiness now uses a verified same-origin handshake.
- **Not started:** real phone/hardware verification, accurate 760 MB model verification and Safari compatibility. Advanced synchronized removals listed in docs/openreel-integration.md are rejected, rather than partially applied. Automatic Roman Hinglish and general AI chat remain deferred as requested.

Current automated integration results are from Windows Playwright Chromium with generated fixtures and a locally synthesized speech clip, not a real-device certification. See docs/openreel-integration.md and vendor/openreel/REEL_FINISHER_PATCHES.md.

## Manual studio upgrade (2026-10-25)

Manual captions, selectable preview positioning, contextual properties, clip/caption/text timeline edits, shared history, audio gain/mute and validated AI-plan review are implemented. `npm run check` passes 274 tests; `npm run build` passes with webpack; the new manual browser suite passes 42/42. All six browser/media suites pass 218/218 checks. See `docs/MANUAL_STUDIO.md`. These are Windows Chromium/Pixel emulation results; real-device verification remains open.

## Phase 1: render lab (rebuilt from scratch 2026-10-24; the GitHub repo was empty)

| ID | Task | Status | Evidence |
| --- | --- | --- | --- |
| T-01 | Next.js 16 scaffold: strict TS, Tailwind 4, Vitest, ESLint, scripts | Tested | `npm run check`, `npm run build` |
| T-02 | File probe and validation, with reason and action for each rejection | Tested | `validate.test.ts`; E2E rejects no-audio, audio-only, garbage |
| T-03 | Device capability check (WebCodecs, H.264 at real size, Opus) | Tested | E2E (headless only) |
| T-04 | Local speech-audio extraction: Ogg Opus mono 32 kbps | Tested | E2E + ffprobe: ogg/opus/1ch, duration ±0.15 s, ~4 KB/s |
| T-05 | Caption grouping, wrap layout, SRT | Tested | `captions.test.ts` |
| T-06 | Burned-in caption render → H.264 MP4, original audio copied | Tested | E2E + ffprobe; pixel diff confirms captions present at 1.0 s and absent at 3.5 s; rotation baked in; VP9/Opus WebM → H.264 + Opus-in-MP4 |
| T-07 | `/lab` page with live caption preview | Tested | E2E (preview overlay not pixel-checked) |
| T-08 | Playwright E2E with ffmpeg fixtures and ffprobe | Tested | `npm run e2e`: 31/31 |

## Phase 2: technical proof of concept

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| T-09 | `/api/transcribe`: provider interface, Groq adapter, Zod validation, 4 MB cap, byte sniff, in-memory rate limit | Tested | 32 unit tests (handler, Groq adapter, sniffing, rate limit) with mocked provider/fetch. **Not yet run against the real Groq API**; needs `GROQ_API_KEY` |
| T-10 | Lab: Transcribe button, provider disclosure, real captions replace test words | Tested | E2E with intercepted route; E2E also hits the real route unconfigured (503 path) |
| T-23 | Hinglish captions in Roman script: default language; Whisper in Hindi, then each word romanized 1:1 by Groq `gpt-oss-120b` (strict JSON schema) so timings are kept; falls back to Hindi script with a warning | Tested (14 unit tests with mocked Groq; E2E: Hinglish is the default and is sent, fallback warning shown). **Romanization quality not yet checked on real speech**; part of T-12 |
| T-11 | Caption sync within ±150 ms on 10 real clips | In progress | Measurement tool built and self-tested (3/3: onsets ±10 ms, app extraction drift ≤10 ms, planted +120 ms read as +115–120 ms). Real run needs 10 clips + `GROQ_API_KEY`: `npm run sync-check -- <clips>`; protocol in `docs/research/caption-sync.md` |
| T-12 | Hinglish bake-off: Groq vs Sarvam vs Instagram Edits (includes Sarvam adapter) | In progress | Sarvam adapter (translit mode, phrase timestamps → estimated word times, 30 s limit, opt-out gate) and `npm run bakeoff` built; unit-tested against Sarvam's documented responses (no live call: api.sarvam.ai is blocked here). Server-config E2E 20/20. **Needs your clips, reference transcripts and both keys**; protocol in `docs/research/hinglish-bakeoff.md` |
| T-13 | Upload checks (Instagram, YouTube, WhatsApp) | In progress: specs checked and two risks fixed; **uploads not done** (need the owner's accounts) | Fixed: AAC output wherever the browser can encode it (Meta documents AAC only), with a warning otherwise; fast start (moov to front, YouTube recommends it). Tested: 5 unit tests, E2E checks box order and a clean ffmpeg decode of every frame. Test pack: `npm run compat-pack` (6 files incl. ffmpeg controls); checklist in `docs/research/platform-uploads.md` |
| T-14 | Postgres rate limiter + Cloudflare Turnstile | Tested | Limiter tested against real Postgres 16 (6 tests, incl. 60 concurrent → exactly 20 allowed). Turnstile flow tested in E2E (`server.e2e.mjs`) with Cloudflare's test keys and a stand-in script. Not yet run against real Cloudflare or a hosted database (this container can't reach Cloudflare); needs keys + a deployment |
| T-15 | First Android device runs, logged in `docs/DEVICE_LOG.md` | In progress: tooling and emulated pass done; **no real-device run yet** (needs the owner's phone) | Done so far: in-lab device report (privacy-safe, copies a DEVICE_LOG row); HDR warning and HEVC-specific advice; `npm run perf` emulated Pixel 7 + CPU ÷4 pass, which found and fixed a 47% idle main-thread load in the preview; step-by-step phone protocol in DEVICE_LOG. Open: ~700 MB fixed renderer memory during renders (desktop measurement) |

## Phase 3: MVP (not started)

| ID | Task | Status |
| --- | --- | --- |
| T-16 | Studio UI at `/studio`: desktop three panes (steps rail with live status, video stage, step panel); phone step-by-step flow with sticky Back/Next; drag-and-drop pick; one-click "Make captions"; logic shared with `/lab` via `useReelSession` | Tested (studio E2E 24/24 at 1440×900 and Pixel 7: locking, rejection, upload contents, fold-away disclosure, edit, style, export ffprobe + pixels, SRT, restore without upload, 40 px targets, no sideways scroll; screenshots reviewed). shadcn/ui not installed (registry blocked here; native controls used, see D-021) |
| T-17a | Word editor in `/lab`: fix text, split, merge, delete, ±50 ms timing nudges, keyboard shortcuts, undo; preview, SRT and render use the edits | Tested (12 unit tests; E2E checks edits reach the SRT and the burned-in pixels; screenshots at 1280 px and 390 px) |
| T-17b | Autosave transcript and edits to IndexedDB (debounced), restore on re-picking the same file, "Start over" deletes the draft | Tested (5 unit tests; E2E: reload → re-pick restores edits with no new upload, render uses restored edits, Start over deletes) |
| T-18 | 5 caption styles (Clean, Pop, Boxed, Bold yellow, Subtitle) with bundled Devanagari+Latin fonts (Poppins, Baloo 2, Mukta, Hind; OFL); style saved in the draft; fonts loaded in the page and in the render worker | Tested (8 unit tests incl. draw calls per style and font files on disk; E2E: style restored with draft, Boxed fonts fetched and dark band burned in; every style checked by eye in rendered MP4 frames and in the live preview) |
| T-19 | One local brand kit: font (4 bundled), text and highlight colours, size, position, applied on top of any style; saved in IndexedDB (DB v2, Zod-validated); pill text stays readable on any highlight colour | Tested (6 unit tests; E2E: red Hind captions burned in at the kit position and nowhere else, kit kept after reload, collapsed summary shows on/off; checked by eye at 1280 and 390 px) |
| T-20 | Render in a Web Worker; stream the MP4 to OPFS (memory fallback when unavailable) | Tested (E2E: output written to disk; longest main-thread stall 21–29 ms vs 79 ms before, on a 4 s 720p clip, headless desktop; mid-render cancel is clean; Devanagari renders correctly in the worker, checked by eye) |
| T-21 | Export presets: Reels & Shorts (9:16, ≤1080×1920, high), Smaller file (9:16, ≤720×1280, medium), Original size; Fill (crop) or Fit (bars) for non-9:16 clips; never upscales; preview shows the exact output frame; export button in the sticky bar | Tested (9 unit tests for `planExport`; studio E2E 29/29: Fill 404×720 matching the preview, Fit 1080×1920 with pixel-verified bars, Original 1280×720, Smaller 1080→720; screenshots at 1440 px and Pixel 7, preview compared with output frames by eye) |
| T-22 | Data-flow line on every step (only Transcribe leaves the device); error states: device-check crash, preview playback failure, storage full / file lost / encoder failure / unsupported (also across the worker), transcribe cancel and offline, leave-page warning during work, screen wake lock, lab error boundary | Tested (9 unit tests for error mapping; E2E: data-flow lines, offline, transcribe cancel with a late reply ignored, leave warning; checked by eye at 390 px). Not E2E-tested: the error boundary (no crash hook), wake lock (no Android here), and the storage-full and file-lost paths (unit-tested mapping only) |
| T-24 | Phone fixes: 4K clips no longer refused when the phone can only encode 1080p (device check uses the smallest export; each export size checked when chosen, unsupported sizes explained and blocked); audio extraction falls back to Web Audio decoding when the WebCodecs decoder fails; extraction errors never give video/tab/storage advice | Tested (Chromium with simulated phone limits, phone E2E 8/8: 2160×3840 accepted, Original blocked with reason, exports 1080×1920; failing WebCodecs decoder → fallback Opus mono 48 kHz, phrase starts within ±10 ms; both decoders failing → audio-specific error). **Not yet verified on the reporter's phone**: the cause on that device is inferred, not observed |
| T-25 | Remove Silence: on-device level analysis (worker) of the extracted speech audio; suggestions with auto/manual threshold, shortest silence, padding before/after speech, shortest pause left, all/only-long mode; timeline + list review, per-cut keep, reset; preview plays the proposed result; apply/cancel, undo/redo; non-destructive EDL with one source→output time map for captions, word highlights and SRT; export decodes only kept segments and re-times video and audio (real cuts); cuts saved in the draft | Tested (15 timeline + 10 detection unit tests; silence E2E 19/19: 3 real silences found and the 0.3 s pause kept, only-long mode, keep a cut, preview jumps a cut, apply/undo/redo, export duration within 0.01 s of the EDL, flash vs sound within 10 ms after cuts, pause survives, SRT on the cut timeline, no-silence clip; studio E2E 30/30 with the new step). Not tested on a real phone or on real speech. Text overlays don't exist yet, so only captions/words/SRT are remapped |

## Known limitations

### Professional studio increment (2026-10-25)

| Milestone | Status | Evidence / limit |
| --- | --- | --- |
| S-01 Typed editing state, project persistence, settings undo/redo | Tested | Project schema/history tests; caption/style restore; stale-export invalidation. Original media must be re-picked after reload. |
| S-02 Four aspect ratios, Fill/Fit/Original, position/scale/color/blur | Tested | Geometry unit tests, all-ratio MP4s with ffprobe and clean decode, crop/color pixel tests. No blur throughput claim on phones. |
| S-03 Font catalog/uploads and typography | Tested | Eight licensed families/five categories; TTF/WOFF2 MP4 rendering; malformed font rejection; favorites/search/rename/delete; deletion frees active face. WOFF/OTF acceptance is browser-parsing-dependent, without dedicated binary fixtures yet. |
| S-04 Placement and saved subtitle presets | Tested | Drag/center snap, source-relative position, saved preset application/reload without composition loss, desktop/mobile screenshots. |
| S-05 Deterministic subtitle effects | Tested | Eight effects with individual preview/export pixel comparisons. No CSS-only export effects. |
| S-06 Reviewed silence cuts / shared timeline mapping | Tested | Worker RMS proposals, real generated audio, caption/SRT remapping, MP4 duration/decode, phrase-onset drift ≤10 ms on the fixture, Undo/Redo. Not a real-device precision guarantee. |
| S-07 Ordinary titles; genuine subject segmentation | Titles Tested; segmentation Not started (researched/staged) | Titles burned into MP4; local model/runtime evaluation documented; masking is explicitly unavailable. No vision dependency installed. |
| S-08 Release verification | In progress | 254 unit tests passed (six DB tests skipped), full regression 172/172, final expanded advanced suite Chromium 40/40 and Edge 40/40. Webpack production fallback passes. Remaining real-device, long-session/performance, hosted deployment and segmentation gates are documented. |

Per-milestone files, manual test instructions, limitations and next steps: `docs/STUDIO_MILESTONES.md`.

### 2026-10-25 fix verification on Windows

- Ten-minute duration enforcement, finite/positive metadata validation, processing boundary guards,
  Ogg EOS duration checks, and encoder-padding correction: Tested in unit tests and Chromium 153.
- Provider setup diagnostics, unknown/placeholder configuration, rejected-key response, duplicate
  submission prevention, retry, empty output, language/timestamp preservation, and stale-result
  cleanup: Tested with mocked success responses; no successful live transcription without a real key.
- Verification: `npm run check` (219 passed, six Postgres tests skipped); Webpack fallback production
  build; lab 67/67, studio 42/42, server 20/20, phone simulations 8/8. Screenshots checked at desktop
  and Pixel 7 sizes. The server database-row check is skipped without `E2E_DATABASE_URL`.
- Default `npm run build` fails in the Turbopack CSS worker on this Windows checkout. The fallback
  command is in README. No real-device, hosted deployment, or live speech-quality verification.

- Rendering is in a worker and streamed to disk, but peak memory on a real phone has not been measured (needs T-15). On desktop headless Chromium, renders add a fixed ~650–800 MB to the renderer process regardless of clip length.
- HEVC is only accepted where the browser can decode it; elsewhere the user is told how to record H.264.
- Without OPFS writes (older browsers), rendering falls back to an in-memory buffer; the UI says so.
- Each render deletes the previous render file, so two tabs rendering at once can break each other.
- Only Devanagari and Latin are bundled. Other Indic scripts (Tamil, Bengali, …) fall back to system fonts.
- Styles are presets: no per-style colour or size controls yet (that comes with the brand kit, T-19).
- The rate limiter is per server instance, and `X-Forwarded-For` is trusted (only safe behind Vercel's proxy).
- The lab has no cancel for extraction, only for rendering.
- Undo history is not saved; after a restore, undo starts empty.
- Drafts live in one browser profile; clearing site data or private browsing loses them (the UI says so when saving fails).
- Timing is edited by nudging, not by dragging on a waveform or timeline.

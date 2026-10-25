# Tasks

Statuses: **Not started** · **In progress** · **Implemented** (code exists, not tested) ·
**Tested** (automated tests pass) · **Verified on a real device**.

"Tested" for media tasks means headless Chromium 153 on Linux (Playwright 1.63) against
ffmpeg-generated fixtures. No task is verified on a real phone yet.

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
| T-12 | Hinglish bake-off: Groq vs Sarvam vs Instagram Edits (includes Sarvam adapter) | Not started | |
| T-13 | Upload checks (Instagram, YouTube, WhatsApp) | In progress: specs checked and two risks fixed; **uploads not done** (need the owner's accounts) | Fixed: AAC output wherever the browser can encode it (Meta documents AAC only), with a warning otherwise; fast start (moov to front, YouTube recommends it). Tested: 5 unit tests, E2E checks box order and a clean ffmpeg decode of every frame. Test pack: `npm run compat-pack` (6 files incl. ffmpeg controls); checklist in `docs/research/platform-uploads.md` |
| T-14 | Postgres rate limiter + Cloudflare Turnstile | Tested | Limiter tested against real Postgres 16 (6 tests, incl. 60 concurrent → exactly 20 allowed). Turnstile flow tested in E2E with Cloudflare's test keys and a stand-in script (17/17). Not yet run against real Cloudflare or a hosted database (this container can't reach Cloudflare); needs keys + a deployment |
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

## Known limitations

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

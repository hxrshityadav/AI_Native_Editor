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
| T-11 | Caption sync within ±150 ms on 10 real clips | Not started | Needs real Hindi/Hinglish clips and a measurement method |
| T-12 | Hinglish bake-off: Groq vs Sarvam vs Instagram Edits (includes Sarvam adapter) | Not started | |
| T-13 | Upload checks (Instagram, YouTube, WhatsApp), incl. Opus-in-MP4 | Not started | Risk: some platforms may reject Opus in MP4; fallback is AAC transcode where encodable |
| T-14 | Postgres rate limiter (Drizzle) + Cloudflare Turnstile | Not started | Required before any public URL. TODO in `rateLimit.ts` |
| T-15 | First Android device runs, logged in `docs/DEVICE_LOG.md` | Not started | |

## Phase 3: MVP (not started)

| ID | Task | Status |
| --- | --- | --- |
| T-16 | Studio UI: desktop three panes; mobile step flow; shadcn/ui | Not started |
| T-17 | Transcript editor with shortcuts and autosave (IndexedDB) | Not started |
| T-18 | 4–6 caption styles with **bundled** Indic fonts (today: system fonts only) | Not started |
| T-19 | One local brand kit (IndexedDB) | Not started |
| T-20 | Render in a Web Worker; stream output instead of an in-memory buffer | Not started |
| T-21 | Export presets | Not started |
| T-22 | Data-flow disclosure on every step; all error states | Not started |

## Known limitations

- Render runs on the main thread and buffers the whole MP4 in memory (risk on low-RAM phones with long or 4K clips).
- Caption fonts depend on what the system has installed; Devanagari may fall back on some devices.
- The rate limiter is per server instance, and `X-Forwarded-For` is trusted (only safe behind Vercel's proxy).
- The lab has no cancel for extraction, only for rendering.

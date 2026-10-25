# Reel Finisher: rules for coding agents

Read `AGENTS.md` (Next.js 16 notes) and this file before changing code. Product context is in
`PRODUCT_BRIEF.md`, plans in `ROADMAP.md`, current status in `TASKS.md`, and the reasons behind
past choices in `DECISIONS.md`.

## Rules that never bend

- The original video never leaves the device. Only compressed speech audio may be uploaded, and
  only after the UI has said where it goes.
- No fake progress, fake success, or controls that do nothing. Placeholder data is labelled as such.
- Every rejected file or failed step shows a reason and a recovery action.
- Free exports have no watermark.
- No secrets in client code. Provider keys are server env vars only.
- Logs and analytics never contain video, audio, transcripts or file names. Log error codes only.
- `TASKS.md` statuses are honest: Not started / In progress / Implemented / Tested / Verified on a
  real device. Generated code is not "done".

## Stack (TypeScript only)

Next.js 16 App Router, React 19, strict TS, Tailwind 4, Mediabunny (WebCodecs), Zod, Vitest,
Playwright. No separate backend, queues, Redis or FFmpeg.wasm (`@ffmpeg/core` is GPL) unless a
`DECISIONS.md` entry ties it to a measured need.

- Check `node_modules/next/dist/docs/` before using a Next.js API.
- Check `node_modules/mediabunny/dist/mediabunny.d.ts` before using a Mediabunny API.
  Gotcha: `new Quality(32000)` is a quality factor, not a bitrate. Use `new Quality({ bitrate })`.
- Check provider docs before relying on a price or limit, and record it in `docs/research/README.md`.

## Project skills

`.claude/skills/` holds vendored, text-only skills (sources and licenses are in `SOURCES.md`):
`karpathy-guidelines` and `ponytail` for any code change, and `frontend-design` for UI work. When
they conflict with this file or the user's brief, this file and the brief win. For example, the
product brief rules out decorative gradients. Use the built-in `/code-review`, `/security-review`
and `/simplify` for reviews.

## Commands

- `npm run check`: typegen + `tsc`, ESLint, Vitest. Must pass before every commit.
- `npm run build`: production build.
- `npm run e2e`: needs a fresh `npm run build`, plus ffmpeg/ffprobe. Drives `/lab` and then
  `/studio` (desktop and Pixel 7) in Chromium against generated fixtures and verifies outputs with
  ffprobe. Run it for every media or UI change.
- `npm run perf`: needs a fresh build. An emulated mid-range phone pass (Pixel 7 profile, CPU ÷4,
  60 s 1080p clip) that prints step timings, idle main-thread load, the longest stall and Chromium
  memory. `PERF_SECONDS` and `PERF_SIZE` change the clip. It is not a real-device result.

## Layout

- `src/lib/captions/`: Word type, grouping, layout, canvas drawing, SRT (pure, unit-tested).
- `src/lib/media/`: probe, validation, device check, audio extraction, render (browser only).
- `src/lib/transcription/`: provider interface, Groq adapter, route handler logic, rate limit,
  byte sniffing (server), plus `client.ts` (browser fetch helper; must not import node modules).
- `src/app/api/transcribe/route.ts`: wires the handler to env config.
- `src/components/editor/`: `useReelSession` (all workflow state and actions) and shared UI parts.
- `src/app/studio/`: the product UI (layout only, over `useReelSession`).
- `src/app/lab/`: the internal render lab (every step exposed separately; the main E2E target).

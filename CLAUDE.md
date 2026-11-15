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
- `npm run build`: production build (also rebuilds the local-AI workers from `tools/transformers`).
- `npm run e2e`: needs a fresh `npm run build`, plus ffmpeg/ffprobe. Runs the site, photo, video and
  local-AI suites in Chromium against generated fixtures and verifies real outputs. Run it for every
  media or UI change. Individual groups: `e2e:site`, `e2e:photos`, `e2e:video`, `e2e:local`, `e2e:models`.

## Layout

- `src/app/`: the public site (`/`, `/tools`, `/command-center`, `/privacy`, `/supported-formats`),
  the 28 tool routes under `/tools/*`, and `local-models/[...asset]` (allowlisted public model files).
- `src/lib/tools/catalog.ts`: the tool catalog, the single source of truth for names, routes, formats
  and model downloads.
- `src/lib/images/`, `src/lib/videos/`, `src/lib/mediatools/`, `src/lib/media/`: photo, video and
  audio engines and their workers (browser only).
- `src/lib/localtools/`: local AI (Whisper, SpeechT5, RNNoise, PDF text), model delivery and cache.
- `tools/local-ai/`: worker entry points bundled by `scripts/build-local-ai.mjs`; `tools/{ort,pdf,
  neural-audio,transformers}` are isolated installs used only at build time.
- `src/components/site/`, `src/components/tools/`: the shell, design system and shared tool surface.
- `src/components/command-center/`, `src/lib/command-center/`: the Command Center and palette.

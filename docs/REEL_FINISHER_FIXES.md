# Reel Finisher fix verification — 2026-10-25

Current manual timeline/AI studio and production-build status: [MANUAL_STUDIO.md](MANUAL_STUDIO.md). Results below describe the earlier milestone.

## Root causes

1. This checkout has no `.env.local`, `GROQ_API_KEY`, or `SARVAM_API_KEY`. Groq is the intended
   default. The existing integration was present, but its setup errors did not identify the setting.
2. Upload validation retained an old 181-second limit and let non-finite durations through.
   Extraction/render entry points lacked their own duration checks; the API only applied optional
   provider limits, and let unreadable audio durations pass.
3. WebCodecs/Mediabunny added 13.5 ms of Opus tail padding to a valid 600-second video. This caused
   the strict API boundary to reject valid input. The EOS granule now discards only encoder padding;
   the source video is never trimmed and long source videos are rejected.
4. Async extraction/render completions could update a replacement selection, and actions relied on
   UI disabling instead of synchronous guards to prevent duplicate work.

## Changed files and purpose

| Files | Purpose |
| --- | --- |
| `src/lib/media/duration.ts`, `validate.ts`, `types.ts` | One 600-second limit; positive finite metadata; actionable duration and independent size errors. |
| `src/lib/media/extractAudio.ts`, `opusPadding.ts`, `render.ts` | Revalidate before local work; correct the extracted Opus EOS granule and checksum without changing speech timing. |
| `src/lib/transcription/providers.ts` | Validate provider selection, missing/placeholder keys, and Sarvam opt-out; expose safe setup instructions. |
| `src/lib/transcription/handler.ts`, `sniff.ts` | Bound actual multipart bytes; walk complete Ogg pages; require readable EOS duration; reject chained streams and over-limit audio before provider calls. |
| `src/lib/transcription/groq.ts`, `sarvam.ts`, `types.ts`, `client.ts` | Actionable auth failures; timeout handling; malformed-response validation; preserve word timestamps and selected language. |
| `src/app/api/transcribe/route.ts` | Publish safe setup status and request a 180-second hosting budget. |
| `src/components/editor/useReelSession.ts` | Guard actions, avoid duplicate submissions and unnecessary extraction when unconfigured, ignore stale results, clean up on unmount/selection changes. |
| `src/components/editor/parts.tsx`, `src/app/studio/StudioClient.tsx`, `src/app/lab/LabClient.tsx` | Exact setup instructions, ten-minute copy, invalid-action blocking, and input reset for reselection. Existing layout and privacy disclosure remain. |
| `next.config.ts` | Apply the installed Tailwind loader when using Webpack as a fallback for this Windows Turbopack crash. No new dependencies. |
| `tests/unit/duration.test.ts`, `validate.test.ts`, `opusPadding.test.ts`, `providers.test.ts`, `transcriptionClient.test.ts`, `groq.test.ts`, `sarvam.test.ts`, `sniff.test.ts`, `oggFixtures.ts`, `transcribeHandler.test.ts` | Duration boundaries/invalid metadata, padding, config, timestamps/language, auth/timeout/retry/empty/malformed results, body limits, and API enforcement. |
| `tests/e2e/helpers.mjs`, `lab.e2e.mjs`, `studio.e2e.mjs`, `server.e2e.mjs` | Windows server startup/cleanup; same-frame pixel controls for measured encoder luminance drift; exact-600 extraction/decoding, file switching, setup blocking, duplicate/retry/empty states, desktop/mobile screenshots. Server tests support both offline verification and reachable test-key authentication rejection. |
| `.env.example`, `README.md`, `DECISIONS.md`, `TASKS.md`, `docs/research/README.md`, this report | Safe configuration example, setup/deployment instructions, decisions, evidence, and remaining limits. |

## Configuration

Copy `.env.example` to `.env.local` at the project root, replace `GROQ_API_KEY=your-groq-api-key`
with your real key, and restart the server. Keep `TRANSCRIBE_PROVIDER=groq`. In production, set the
key in the hosting server environment and redeploy; never prefix it with `NEXT_PUBLIC_`.
Vercel also needs `DATABASE_URL`, `TURNSTILE_SITE_KEY`, and `TURNSTILE_SECRET_KEY`.
The optional Sarvam adapter requires its own key and confirmed training opt-out and supports only
30-second clips; Groq remains the suitable default for ten-minute inputs.

## Commands and actual results

| Command | Result |
| --- | --- |
| `npm run check` | Passed: Next type generation, TypeScript, ESLint, 219 unit tests. Six Postgres tests skipped without `TEST_DATABASE_URL`. |
| `npm run build` | Failed: Turbopack CSS worker exits before connecting, both sandboxed and outside the sandbox. |
| `node node_modules/next/dist/bin/next build --webpack` | Passed: production pages/API built; Tailwind utility generation confirmed. |
| `npm run e2e` | Passed after padding correction: lab 67/67, studio 38/38, server 20/20, phone 8/8. |
| `node tests/e2e/studio.e2e.mjs` | Passed 39/39 after adding the final missing-key/no-extraction/no-upload test. |
| `git diff --check` | Passed; only Git line-ending normalization notices. |

Browser checks used Playwright Chromium 153 on Windows, desktop 1440×900 and emulated Pixel 7.
Reviewed duration-error screenshots at both sizes. MP4/SRT, caption editing/style/brand kit,
AAC preservation, export framing, fallback audio decoding, and measured caption alignment checks
passed. Corrected 600-second extracted Opus reads exactly 600 seconds and decodes cleanly in ffmpeg.
The server suite skips its database-row assertion without `E2E_DATABASE_URL`.

## Remaining verification

No successful live transcription was possible without a real key and speech clip. Success,
language behavior, and romanization use mocked provider responses; the server test did verify the
real rejected-key path with a deliberately invalid key. Real Hindi/Hinglish quality and word sync
still need the configured provider. No hosted deployment or real-phone verification was performed.
The default Windows Turbopack crash remains; the documented Webpack production fallback works.

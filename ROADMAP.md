# Roadmap

Task-level status lives in `TASKS.md`.

## Phase 1: render lab (done; rebuilt 2026-10-24)

File probe and validation, device check, local speech-audio extraction, burned-in caption render to
H.264 MP4 with original audio, SRT export, and E2E tests on generated fixtures.

## Phase 2: technical proof of concept (now)

- Real transcription: `/api/transcribe`, provider interface, Groq adapter, rate limiting (T-09).
- Feed real transcripts into the lab (T-10).
- Caption sync against speech within ±150 ms on 10 real clips (T-11).
- Hinglish accuracy bake-off: Groq vs Sarvam vs Instagram Edits (T-12).
- Check that outputs, including Opus-in-MP4, upload to Instagram, YouTube and WhatsApp (T-13).
- Abuse control before any public URL: Turnstile and a Postgres rate limiter (T-14).
- First real Android device runs (T-15).

Exit criteria: a real 30–60 s Hinglish clip goes from pick to an uploaded Reel on a mid-range Android
phone with acceptable caption accuracy and sync.

## Phase 3: MVP

Studio UI (desktop three-pane layout; mobile step-by-step flow), transcript editor with keyboard
shortcuts and autosave, 4–6 caption styles with bundled Indic fonts, one local brand kit
(IndexedDB), export presets, rendering in a Web Worker, a data-flow disclosure on every step, and
every error state.

## Phase 4: quality

Accessibility, Android test matrix, crash and interruption recovery, and fixes for the top failure
codes.

## Phase 5: monetization (only after users show they value it)

Free tier plus one paid offer (a 7-day pass or credits). Razorpay (UPI) with server-verified
webhooks and idempotent fulfilment, a merchant of record for international cards, license keys with
optional magic-link recovery, purchase recovery and refunds. Postgres (Neon/Supabase) + Drizzle.

## Phases 6–9

Beta, public launch, growth, scaling. Add infrastructure only for measured needs.

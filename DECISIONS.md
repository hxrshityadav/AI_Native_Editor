# Decisions

Newest last. Each entry: decision, why, and what would change it.

## D-001: Rebuild from scratch (2026-10-24)
The GitHub repo was empty (no commits), so the Phase 1 lab described in the brief was not available.
The owner chose a full rebuild over pushing local work first. If the earlier local code is pushed
later, diff it against this version before merging; do not overwrite either side blindly.

## D-002: TypeScript only; Next.js route handlers are the whole backend
No separate service, queue or Redis. Revisit only with a measured need.

## D-003: Mediabunny + WebCodecs; no FFmpeg.wasm
`@ffmpeg/core` is GPL and slow; WebCodecs uses hardware encoders. Cost: we depend on browser codec
support (H.264 encode, Opus encode), which the device check verifies before any work.

## D-004: Speech audio is Ogg Opus, mono, 48 kHz, 32 kbps
About 0.24 MB per minute. Groq accepts `ogg`. Whisper resamples to 16 kHz mono anyway, so more
bitrate buys nothing. Opus encode is available in Chromium WebCodecs; AAC encode often is not
(headless Chromium reports `mp4a.40.2` encode unsupported).

## D-005: Upload cap is 4 MB, not the ~10 MB in the brief
Vercel functions reject request bodies over 4.5 MB, so a 10 MB app cap would never apply in
production and users would get a platform error instead of ours. 4 MB is ~16 minutes of our audio,
more than 5× the 3-minute clip limit.

## D-006: The server accepts only audio-only Ogg Opus, checked by bytes
The route walks the Ogg beginning-of-stream pages and requires every logical stream to be
`OpusHead`. This rejects video muxed into Ogg and any other file type, whatever the client claims.
This enforces "audio only" on the server, not just in the UI.

## D-007: Groq `whisper-large-v3` is the default, not `-turbo`
Groq recommends it for error-sensitive multilingual use. Price difference per 3-minute clip is about
$0.0056 vs $0.002, which is negligible at our scale. `GROQ_MODEL` can switch it. Revisit after the
T-12 bake-off.

## D-008: In-memory rate limit for now (20 per hour per network)
Keyed by SHA-256(salt : UTC day : IP), so raw IPs are never stored and keys rotate daily. Known gaps:
per-instance on serverless, and spoofable `X-Forwarded-For` off Vercel. Must be replaced by T-14
(Postgres + Turnstile) before any public URL.

## D-009: Input limits: ≤ 3 minutes, ≤ 1 GB, longest edge ≤ 3840 px; landscape allowed with a warning
3 minutes matches Reels and Shorts. Above 4K, phone encoders commonly fail to configure.

## D-010: System fonts for now; removed `next/font/google`
It fetches at build time (a network dependency) and its fonts can't be used in OffscreenCanvas
render anyway. Bundled Indic fonts come with T-18.

## D-011: No shadcn/ui yet
The lab is an internal test page. Add shadcn/ui with the Studio UI (T-16).

## D-012: Vendored three skills as text; no Context7 (2026-10-24)
`karpathy-guidelines`, `ponytail` (skill text only, no hooks or ledger) and Anthropic's
`frontend-design` live in `.claude/skills/` with pinned sources (see `SOURCES.md`). context7.com is
blocked by the cloud environment's network policy. Version-matched docs in `node_modules` are the
primary API reference, backed by official sites.

## D-013: Caption timing is edited by nudges, with in-memory undo
50 ms steps clamped against neighbours, so words can't overlap and every word stays at least 50 ms
long. Three presses cover the ±150 ms sync target. Drag-on-waveform editing waits until T-11 shows
real sync errors are larger than nudges handle comfortably. Undo keeps the last 100 states in memory;
persistence comes with T-17b.

## D-014: Caption drafts: IndexedDB via `idb`, keyed by a content hash
`idb` (ISC, ~1 KB gzipped) is the stack's named choice and will also hold brand kits (T-19). The key
is SHA-256(size + first MiB + last MiB): it's stable across renames and re-downloads and stores no
file name, and it costs about 2 MB of reads. Only real transcripts are saved; placeholder words never
are. Records are Zod-validated on read, so a bad or old record is ignored instead of breaking the
editor. At most 20 drafts are kept, oldest pruned first. Writes are debounced by 400 ms.

## D-015: Render in a worker and stream to OPFS; MP4 metadata at the end
Rendering on the main thread stalled the UI (79 ms longest stall on a 4 s 720p clip; worker: 21–29 ms).
An in-memory MP4 (`fastStart: 'in-memory'`) costs roughly the output size in RAM, and more while
growing, which is risky on 3–4 GB Android phones with 3-minute 1080p clips. OPFS streaming with
`fastStart: false` keeps memory flat. The trade-off is that the moov box sits at the end, which
doesn't matter for local files or for uploads to Instagram, YouTube or WhatsApp (they re-encode;
T-13 will confirm). One worker per render, and cancel is `terminate()`: simpler than cooperative
cancel, and partial files are cleaned up at the next render.

## D-016: Caption fonts are bundled, Devanagari plus Latin, loaded per style
Poppins 700, Baloo 2 800, Mukta 700 and Hind 600 (all OFL-1.1, from Fontsource 5.3.0, licences in
`public/fonts/*/OFL.txt`) cover Hindi and Roman-script Hinglish in one family each. That's 344 KB in
total, and one style needs 47–127 KB, loaded only when picked. Families are prefixed "RF" so an
installed system copy can't shadow ours. If a font fails to load, preview and export pause with a
retry, rather than silently exporting in a different font from the one previewed. Pill highlights
centre on the measured ink box, because Devanagari ink sits high in the em box.

## D-017: Hinglish = Whisper Hindi, then word-by-word romanization (2026-10-25)
The user wants captions in Roman-script Hinglish, not Devanagari. We transcribe with
`language=hi`, the accurate mode for Hindi speech, which keeps word timings, then send only the words
(text, no audio) to Groq `gpt-oss-120b` with a strict JSON schema: one output word per input word, in
order. We check the count and that no Devanagari is left; English words already in Roman script are
never rewritten. Same provider, so the disclosure only adds "text only". Cost is about $0.001–0.002 per
3-minute clip. If romanization fails, the user gets the Hindi-script transcript with a warning rather
than an error, so a paid transcription isn't thrown away.

Alternatives: a rule-based transliterator runs locally but spells English loanwords phonetically
("कैप्शन" → "kaipshan"), so users would fix every one. Sarvam's speech-to-text has transliteration
modes worth comparing in the T-12 bake-off. If it returns Roman Hinglish with word timings in one
call, it could replace this two-step flow.

## D-018: The brand kit overrides a style; it doesn't replace styles
The kit holds what creators brand by: font, text colour, highlight colour, size and vertical
position. The style still decides shape (outline, box, pill, shadow, words per line). That keeps 5
styles × 1 kit instead of a free-form editor. On pill styles, pill text switches between near-black
and white by WCAG luminance, so a dark brand colour never hides the spoken word. The kit is one
record in a new `settings` store (IndexedDB v2 upgrade, drafts kept) and is saved on every change,
since it's a few bytes. It's per browser; syncing across devices needs accounts and isn't planned.

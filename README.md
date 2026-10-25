# Reel Finisher

Browser-first tool that turns a raw talking-head video into a captioned Reel or Short. The video is
processed locally with WebCodecs. Only compressed speech audio is sent for transcription.

Status: Phase 2 technical proof of concept. See `TASKS.md`.

## Run locally

```bash
npm install
cp .env.example .env.local   # then set GROQ_API_KEY
npm run dev                  # open http://localhost:3000/studio (or /lab for the internal test page)
```

## Checks

```bash
npm run check   # typecheck, lint, unit tests
npm run build
npm run e2e     # after build; needs ffmpeg + ffprobe
```

Agents and contributors: read `CLAUDE.md` first.

## Studio editing tools

Video → Composition offers four aspect ratios, Fill/Fit/Original, crop position, scale, letterbox
color and optional blur. Style adds searchable fonts and local uploads, detailed caption appearance,
drag/keyboard placement, saved presets, deterministic animations, and ordinary text titles.
Captions → Silence removal analyzes local audio and offers reviewable, reversible pause cuts.
Settings undo/redo is in the header; caption undo remains in the word editor.

Projects restore after re-picking the same source file. Uploaded fonts and presets remain in this
browser until removed or site data is cleared. Source-specific cuts/titles do not carry to unrelated
videos. A settings change invalidates the previous export so it cannot be mistaken for the new one.
No video or font upload is introduced. Subject masking is explicitly unavailable, pending a measured
segmentation implementation. See [milestone reports and manual test instructions](docs/STUDIO_MILESTONES.md).

## Transcription setup and video limits

Set `GROQ_API_KEY` to a real key in `.env.local` **at the project root**, then restart the server.
The example placeholder is deliberately rejected. No provider credentials are included in this repository.
`TRANSCRIBE_PROVIDER=groq` is the default; `GROQ_MODEL` defaults to `whisper-large-v3`.
For production, set these in your host's server environment and redeploy. Never use a `NEXT_PUBLIC_`
prefix. Vercel additionally requires `DATABASE_URL`, `TURNSTILE_SITE_KEY`, and `TURNSTILE_SECRET_KEY`.
The config endpoint and Captions step explain missing settings without disclosing their values;
a rejected API key requires replacing it and checking the provider account's permissions.

Videos must have a readable, positive duration of **600 seconds or less**. The limit is checked at
selection, audio extraction, transcription upload (using the actual Ogg duration), and export.
Long videos are rejected, never trimmed. Landscape video is allowed with a warning. The separate
1 GB input memory guard and 4K resolution guard still apply; file size is not used to guess duration.

The original video stays on your device. Only locally extracted mono Ogg Opus speech audio is sent
through our server to Groq. Hindi uses `hi`, English uses `en`, and Hinglish uses Hindi transcription
followed by Groq text-only romanization, preserving word timestamps. Failed romanization is disclosed
and leaves Hindi captions available. Optional Sarvam requires `SARVAM_API_KEY` and a completed account
training opt-out (`SARVAM_TRAINING_OPT_OUT=confirmed`); its synchronous adapter only accepts 30 seconds,
so use Groq for longer clips.

The route caps actual multipart bytes, including requests without Content-Length: 4 MiB audio plus
64 KiB form overhead, below Vercel's 4.5 MB payload ceiling. At 32 kbps, ten minutes is about 2.4 MB.
The route requests a 180-second function budget (verify your hosting plan supports it), with a
60-second speech-provider timeout and 30 seconds per romanization request. Hosting failures still
require a deployment check. No large original video is sent through the function.

Live provider acceptance, Hindi/Hinglish quality, and synchronization remain unverified until a real
key and speech clip are available. Successful transcription tests mock provider responses; the
server suite may verify authentication rejection with a deliberately invalid key.

`npm run build` uses webpack because the default Windows Turbopack CSS worker crashes before connecting on this checkout. The existing installed Tailwind compiler is reused; no extra dependency is needed.

The manual editing studio, timeline, AI-plan configuration and current verification notes are documented in [docs/MANUAL_STUDIO.md](docs/MANUAL_STUDIO.md). Historical transcription and initial studio checks remain in the milestone documents.

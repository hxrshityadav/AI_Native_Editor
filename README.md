# Reel Finisher

Free photo, video and audio tools that run in the browser. Files are processed on the device with
WebCodecs, canvas and Web Workers. Nothing is uploaded, no account is needed and exports carry no
watermark. Optional local AI models (Whisper, SpeechT5, U²-Net-p, RNNoise) download only after the
visitor agrees, and run from this browser.

The site has 28 tools under `/tools`, a searchable directory, and a Command Center
(`/command-center`) for pinning tools and returning to recent ones. The catalog in
`src/lib/tools/catalog.ts` is the single source of truth.

- **Photo:** Image Compressor, Converter and Resizer, HEIC to JPG, Background Remover, Passport Photo.
  See [photo utilities](docs/photo-utilities.md).
- **Video:** [Video Compressor](docs/video-compressor.md), Compress to Size, Trim, Convert to MP4,
  Remove Audio, Video to GIF, Text to Video, Image to Video.
- **Audio:** Converter, Extract Audio, Audio Cutter, Increase Volume, Audio to Video, Text to Speech,
  PDF to Audio, Noise Remover, Remove Music, Vocal Remover.
- **AI:** Transcribe to Text, Video Translator, AI Dubbing, Lecture to Notes.

The local AI tools are documented in the [implementation/validation ledger](docs/local-ai-implementation.md)
and the [model inventory](docs/local-models.md). They do not claim neural stems, voice cloning, lip
sync or generative footage. Notes are extractive, and PDF reading needs selectable text (no OCR).

## Run locally

```bash
npm install                  # also installs the isolated build inputs in tools/*
npm run dev                  # open http://localhost:3000
```

`SITE_URL` in `.env.local` (see `.env.example`) sets the canonical origin for deployments. No API keys
are needed.

## Checks

```bash
npm run check   # typecheck, lint, unit tests
npm run build
npm run e2e     # after build; needs ffmpeg + ffprobe
```

Agents and contributors: read `CLAUDE.md` first. Design: `DESIGN.md` and
`docs/design-reference-llmdojo.md`.

`npm run build` uses webpack because the default Windows Turbopack CSS worker crashes before
connecting on this checkout.

## History

Reel Finisher previously included Reel Studio, a timeline editor (an OpenReel integration), plus a
legacy editor and an internal render lab. These were removed on 8 November 2026, together with Shorts
Maker, which finished its exports in the Studio, and the optional cloud transcription routes. See
`DECISIONS.md`. Older documents in `docs/` that describe them are historical.

# Tool implementation matrix (2026-11-01)

Source of truth for availability: `src/lib/tools/catalog.ts`. "Verified" means an E2E suite downloads the real output and inspects it with ffprobe/ffmpeg.

## Working tools

| Tool | Route | Processing location | Engine | Verified by |
|---|---|---|---|---|
| Image Compressor | /tools/image-compressor | Device (worker) | Browser image codecs, quality search for target size | photos.e2e |
| Image Format Converter | /tools/image-converter | Device (worker) | Browser image codecs | photos.e2e |
| Image Resizer | /tools/image-resizer | Device (worker) | Canvas resampling, optional target size | photos.e2e, passport.e2e |
| HEIC to JPG | /tools/heic-to-jpg | Device (worker) | libheif-js (LGPL-3.0, WASM), lazy-loaded | heic.e2e |
| Background Remover | /tools/background-remover | Device (worker), AI model | U²-Net-p (Apache-2.0) on ONNX Runtime Web (WASM), lazy-loaded | background.e2e |
| Passport Photo Maker | /tools/passport-photo | Device (worker) | Image engine crop/fill + print sheet | passport.e2e |
| Video Compressor | /tools/video-compressor | Device (worker) | Mediabunny + WebCodecs | video-compressor.e2e |
| Compress Video to Size | /tools/compress-video-to-size | Device (worker) | Video Compressor with a required target | media.e2e |
| Trim Video | /tools/trim-video | Device (worker) | Mediabunny Conversion: stream copy (fast) or partial re-encode (precise) | media.e2e |
| Remove Audio | /tools/remove-audio | Device (worker) | Mediabunny Conversion, stream copy | media.e2e |
| Convert to MP4 | /tools/convert-to-mp4 | Device (worker) | Remux H.264/AAC; else re-encode to H.264/AAC | media.e2e |
| Video to GIF | /tools/video-to-gif | Device (worker) | Mediabunny frame decode + gifenc (MIT) | media.e2e |
| Extract Audio | /tools/extract-audio | Device (worker) | Mediabunny Conversion → M4A/WAV/Ogg | media.e2e |
| Audio Converter | /tools/audio-converter | Device (worker) | Mediabunny Conversion → M4A/WAV/Ogg | media.e2e |
| Audio Cutter | /tools/audio-cutter | Device (worker) | Trim + sample-level fades; waveform from decoded peaks | media.e2e |
| Increase Volume | /tools/increase-volume | Device (worker) | Gain or peak normalisation with soft limiter | media.e2e |
| Audio to Video | /tools/audio-to-video | Device (worker) | Mediabunny CanvasSource + AudioSampleSource, level visualiser | media.e2e |
| Text to Speech | /tools/text-to-speech | Local SpeechT5 / local system voices | Real 16 kHz mono WAV synthesis, or device listening | localtools.e2e (actual inference); local-ai-compat.e2e |
| Auto Subtitles | /studio | Device (Studio) | Existing local Whisper captions in Reel Studio | openreel.e2e |
| Automatic Editing | /studio | Device (Studio) | Existing silence/gap removal and captions in Reel Studio | openreel.e2e, silence.e2e |

## Additional local tools (2026-11-01 increment)

The eight previously planned entries now have local implementations. Their exact capabilities differ from cloud generative services; see `docs/missing-local-tools.md` for architecture, limits and test results.

| Tool | Route | Actual implementation |
|---|---|---|
| Transcribe to Text | /tools/transcribe-to-text | Existing installed Transformers/Whisper in an isolated browser worker; TXT/SRT/VTT |
| Noise Remover | /tools/noise-remover | Light spectral subtraction or genuine RNNoise v0.1 neural suppression; WAV or copied-picture video |
| Vocal Remover | /tools/vocal-remover | Stereo centre/side WAV extraction; not neural stems |
| Remove Music from Video | /tools/remove-music | Keep stereo centre, copy picture, replace soundtrack; centred music remains |
| Video Translator | /tools/video-translator | Local Whisper speech-to-English subtitles; optional browser-native translation to additional languages |
| AI Dubbing | /tools/ai-dubbing | Local Whisper + SpeechT5; generic English voice, no cloning or lip sync |
| Text to Video | /tools/text-to-video | Caption cards with optional local English narration; no generated footage |
| Image to Video | /tools/image-to-video | Photo zoom/still MP4 with optional captions/narration; no subject generation |

## Advanced capabilities not implemented

Neural separation of arbitrary mono/stereo mixes, multilingual voice cloning, lip sync, and prompt/image-conditioned generative footage are not provided by these basic local implementations. Do not market the stereo/card/photo tools as those capabilities. Detailed implementation limits and remaining model/device checks are tracked in `docs/missing-local-tools.md`.

## Creator increment (2026-11-03)

| Tool | Route | Actual implementation / evidence |
|---|---|---|
| Shorts Maker | /tools/shorts-maker | Local Whisper, deterministic transcript moments, manual crop/range/captions, separate native Studio project and export; creator.e2e actual export and optional real ASR |
| Lecture to Notes | /tools/lecture-to-notes | Existing local Whisper; editable timed transcript, extractive key quotes, gap/time sections and source-word cloze practice; actual TXT/Markdown downloads tested with real ASR |
| PDF to Audio | /tools/pdf-to-audio | Local PDF.js text extraction, page/section review, sentence-based existing SpeechT5 synthesis and genuine WAV. English only; no OCR. Actual WAV → local Whisper content gate passed with full-precision decoder |

See `docs/local-ai-implementation.md` for the staged audit, licensing gates and current validation.

# Missing screenshot tools — local implementation

The existing 18 standalone tools and OpenReel studio are reused. This increment adds eight routes; the catalog now has 26 standalone routes and three studio entries. It does not add accounts, subscriptions, paid providers, uploads or FFmpeg.wasm.

| Route | Actual capability | Important limit |
|---|---|---|
| `/tools/transcribe-to-text` | Local Whisper Tiny; editable segments; TXT/SRT/VTT | Optional model download, two-minute jobs; segment timing is estimated |
| `/tools/video-translator` | Whisper speech-to-English subtitles; additional targets through the browser's local Translator API | Additional languages require supported desktop browser/language packs; subtitle export, not replacement audio |
| `/tools/ai-dubbing` | Local Whisper translation + generic English SpeechT5 voice; copy picture and replace soundtrack | English output only, no cloning/lip sync; review text; phrases too long for their segment are rejected |
| `/tools/noise-remover` | Spectral subtraction from a noise-only opening | DSP, not an AI model; steady noise only, possible artifacts |
| `/tools/vocal-remover` | Stereo centre/side extraction into two mono WAV files | Not neural stems; rejects mono/dual mono; centred instruments and wide vocals cannot be separated reliably |
| `/tools/remove-music` | Keep stereo centre and copy video packets into a new MP4/WebM | Reduces wide stereo content, not arbitrary music; centred music remains |
| `/tools/text-to-video` | Caption-card MP4 from script, optional local English narration | Does not generate footage; silent cards up to 2,000 characters, narration up to 500 |
| `/tools/image-to-video` | Zoom-in/out or still-photo MP4, captions and optional local narration | Does not generate new subjects/scenes; photo fills frame and can crop edges |

The screenshot's generative scene creation, multilingual voice cloning and neural arbitrary-mix stem separation are **not** claimed. These local tools expose their actual algorithms and limits instead of using misleading AI badges. Existing Text to Speech remains unchanged and listening-only.

## Architecture

- Shared photo/media surface and site shell; existing tool engines and editor are preserved.
- `src/lib/localtools/dsp.ts`: WAV encoding, mono resampling, stereo decomposition, FFT/overlap-add noise reduction.
- `audio.ts`: bounded PCM decoding through the already installed root Mediabunny.
- `video.ts`: composable soundtrack replacement and CanvasSource card/photo rendering. Audio is resampled to browser-compatible 48 kHz stereo before AAC encoding; picture replacement copies packets rather than re-encoding.
- `local.worker.ts` / `client.ts`: one worker per media task; terminate on cancellation, replacement, error, timeout or unmount.
- `tools/local-ai/speech.worker.ts`: Whisper Tiny / SpeechT5, using the editor's installed Transformers.js version. Single-thread WASM avoids adding public-page isolation headers.
- `scripts/build-local-ai.mjs`: bundles the owned workers and copies the matching existing browser runtime into generated, ignored `public/local-ai/`. Runs after the editor build. No additional npm dependency or root ONNX installation.
- `/local-models/`: fixed allowlist of public configs/weights and speaker embedding. No media, text, arbitrary models or upstream URLs are accepted. GET-only asset delivery, bounded retries, cancellation, noindex headers.
- Optional browser Translator API requires its own explicit user click to start a language-pack download. Unsupported browsers keep the English subtitle result; no cloud fallback.

## Limits and privacy

New recording tools accept one file up to 512 MiB, mono/stereo at 8–96 kHz, and at most 120 seconds per job. This is an additional memory/inference limit; the application's existing 600-second video maximum is unchanged. PCM is buffered for DSP/model work (unlike streaming utility exports); long/high-rate recordings can use hundreds of MB. Use shorter files on low-memory devices.

New videos are 2–60 seconds, 24 fps, H.264 MP4, portrait 720×1280, square 720×720 or landscape 1280×720. Encoded video output is capped at 128 MiB; native codec/frame memory is additional. Photo inputs reuse existing 25 MiB / 16 MP / 8192-side guards. English narration sets duration; it can use up to 60 seconds. Dubbed speech is placed at segment starts and compressed by resampling only when needed (at most 1.5×; pitch can change); no lip-sync guarantee.

Models download only after a checked consent control and an explicit processing action. Progress reports actual downloaded bytes when supplied by the runtime. Public model files are cached by the browser; user media and transcripts are not persisted. Keeping processing local does not guarantee a full offline page reload or prevent browser storage eviction.

## Research and notices

- Whisper and Transformers.js are reused from the existing studio. [Pipeline documentation](https://huggingface.co/docs/transformers.js/api/pipelines).
- [SpeechT5 ONNX usage](https://huggingface.co/Xenova/speecht5_tts) and [Microsoft model card](https://huggingface.co/microsoft/speecht5_tts): English synthesis, generic speaker embedding; MIT model license. [Vocoder card](https://huggingface.co/microsoft/speecht5_hifigan).
- [Browser Translator documentation](https://developer.chrome.com/docs/ai/translator-api): local language packs, feature detection and user activation; desktop support does not establish mobile support.
- Runtime notices are copied into `/local-ai/`; root Mediabunny's unmodified MPL source and notices remain at `/media-notices/`. Model providers/ONNX conversions and the fixed demonstration speaker embedding are identified in the asset allowlist and model notices.

## Verification

`tests/unit/localtools.test.ts` measures noise reduction and mathematical centre/side correctness, validates output WAV bytes, subtitle timestamps, bounded dubbed speech and model URL restrictions. `tests/e2e/localtools.e2e.mjs` downloads actual WAV/MP4 files and checks decoded frequencies, noise energy, picture shape/movement, duration, consent, navigation cleanup, SEO, mobile layout and local network requests.

Run `npm run e2e:local` after a production build. `LOCAL_AI_INFERENCE=1` additionally downloads real weights and tests Whisper recognition and actual SpeechT5 dubbed exports. Inference is intentionally not simulated in that mode. `LOCAL_TOOLS_DEV=1` is available for iteration; production validation uses the default.

The production model-inference run passes **36/36** checks, including actual Whisper recognition, timed TXT/SRT/VTT exports, actual SpeechT5 dubbed MP4 and narrated caption-card MP4. The original media and generated outputs are independently decoded with ffmpeg/ffprobe. Requests are limited to same-origin GET/HEAD assets, including during model loading and inference. Desktop screenshot reviewed; all eight routes pass phone viewport checks (not physical-device validation).

Final verification:

- `npm run build`: clean production build passes; all eight new routes are statically rendered and model delivery is a dynamic GET-only asset route.
- `npm run check`: typecheck/lint pass; **582 unit tests passed** (330 root, 188 fork web, 64 fork core), with six database and four existing upstream skips.
- `npm run e2e`: **643/643** checks pass: lab 67, legacy studio 39, server 20, phone 8, silence 16, advanced 42, manual 42, ripple 20, native editor 34, migration 9, photos 44, passport 13, HEIC 11, background 13, video compressor 37, media 42, site 154, new local tools 32.
- The full suite skips one shared-database scenario without `E2E_DATABASE_URL` and intentionally skips heavy model inference by default. The separate production inference run above covers real weights, not a simulated model.
- The downloaded dubbed and narrated MP4s were also independently played to their ends in native Chrome video elements: **2/2** playback checks pass.
- Evidence: ignored `output/missing-tools-{build,check,regression,inference-final,playback}.log`, plus actual files and screenshots under `output/missing-tools-inference-final/`.

The eight new page routes share `src/components/media/{AudioCleanup,SpeechTool,StoryMaker,MissingToolPage,useLocalJob}.tsx/.ts`; model typings are in `src/types/local-transformers.d.ts`. Integration updates are limited to catalog/sitemap/robots/privacy, the isolated-worker build step, notices, test scripts and documentation. Previously implemented tool engines and vendor editor source are unchanged by this increment.

Earlier runs caught and corrected incompatible mono/16 kHz AAC probing, composable-conversion tag ownership, stale development worker URLs, and transient model-asset delivery. A development-only Next router error generated framework diagnostic requests; final production testing passes the strict privacy check without exceptions.

Non-English translation accuracy, additional browser translation packs, real voice naturalness/long-segment dubbing, real mobile/Safari performance, storage eviction, long sessions, native codec variability and production asset delivery remain manual gates. Caption-card glyph coverage uses browser/system fonts. No cross-browser or physical-phone support is inferred from desktop Chrome and viewport emulation.
# Current increment

The November 1 results below are historical. Downloadable standalone SpeechT5, neural RNNoise, Shorts Maker, Lecture to Notes and PDF to Audio have since been added; see `local-ai-implementation.md`. SpeechT5 now uses its fp32 decoder after a spoken-content quality failure with q8, so the old speech-download estimates and synthesis timings below do not describe the current configuration. Current weights total about 370.33 MiB plus runtime/configs. Root models use explicit consent and pinned, versioned delivery/cache; final validation status is maintained in the current ledger.


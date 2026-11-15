# ClipUtils reverse engineering with REA MCP

Inspected 3 November 2026. Target: https://www.cliputils.com/ (https://cliputils.com redirects here).

## Conclusion

ClipUtils is a Next.js/React media-tool website with a shared browser media engine, optional local AI models, and multiple remote AI services. It is **not entirely browser-local**. Its public catalog now advertises 31 tools, including three additions beyond the older 28-tool screenshot: AI Shorts Maker, Lecture to Notes and PDF to Audio.

For Reel Finisher, keep the existing Next.js website, OpenReel studio and Mediabunny/WebCodecs processing. The most useful capability upgrades to investigate are neural vocal separation, downloadable local speech, and neural speech denoising. Do not recreate utilities that already exist, substitute FFmpeg.wasm for the working renderer, or copy ClipUtils' cloud and payment architecture into the strictly local/free product.

This is a bounded analysis of public browser-delivered artifacts and public page behavior. It does not recover private server source, prove model quality, or verify the competitor's data-retention claims.

## Method and evidence

Used the installed REA MCP directly: `list_browser_targets`, `inspect_web_page`, `analyze_web_bundle`, `capture_browser_scenario`, `export_web_scripts`, `capture_web_screenshot` and `export_evidence_bundle`. Chrome ran headlessly in an owned, isolated profile; no personal browser session was inspected.

Inspected the homepage, tools directory, and 15 tool/policy/pricing pages: compressor, subtitles, vocal remover, speech, dubbing, image video, pricing, privacy, shorts, lecture notes, PDF audio, AI editor, noise remover, translator and text video. REA performed declared navigation/wait actions. No user media, account, paid generation or provider inference was submitted. Navigation can invoke the site's ordinary telemetry and entitlement checks.

Evidence is retained at `output/cliputils-rea/evidence-final.json`; page text, exported JavaScript and a desktop screenshot are in the same directory. These are investigation artifacts, not application assets.

| Label | REA Evidence ID | What it establishes |
|---|---|---|
| H | `ev_bf85fd24ff9f438900a46e295c144e9763625e87d6aa1d6de7a2a361bfcef749` | Homepage DOM/accessibility, links, script/resource inventory, storage names |
| B | `ev_f0d7ec2ba1060671bb771705b8f732ab83ba2757793c7b6a50738846c9e37af0` | Delivered homepage bundle analysis, fingerprints and candidate endpoints |
| P | `ev_58aa83d7940c4714ba3af0c8243b9515dc650531f7abe14851b7bf6c7512d96d` | First eight page journeys and retained network events |
| X | `ev_5290a1b262e15ae767de69e78fad963483c97b71e78a21dec7158d77d7cd96c5` | Exported response script bytes, digests and URLs from P |
| V | `ev_eaeb6554157981b001d2ec27b1f590664bccebe4cb2c57591e7e8de2d42b9124` | Vocal-remover page's captured JavaScript sources |
| VX | `ev_50eb535b2c889aa8453323cc76546d13815949455392b4a5e6b4271c019b82c8` | 46 exported sources from V |
| T | `ev_365fd5ee3fc70844fbddfb56b77392150ae7ae922e3f2256b237df1facf2b559` | Speech page's captured JavaScript sources |
| A | `ev_440a472fbb78284f3e2920912bafd104e9fbb30a5945a16c3c17982296c6183e` | Seven additional public tool-page journeys |
| S | `ev_024c2a79a2e2ec851d53e6320f7ac12909cf2dc3d8f5d4d7cd518b9be04a1b19` | Text-to-video desktop viewport screenshot |

Evidence classes below: **observed source** means code was delivered and inspected; **page disclosure** means the site says it works this way; **inference** means a conclusion from those observations. None implies an actual export or inference run.

## Recovered architecture

| Layer | Findings | Evidence / qualification |
|---|---|---|
| Web application | Next.js and React fingerprints, Turbopack chunk registration, `/_next/static/chunks/` assets and serialized React server payloads | B, V, T; exact framework/package versions not established |
| Shared UI | Persistent category sidebar, dark/light theme, searchable tools, breadcrumb, upload surface, settings/result area, related tools, instructions, FAQs and shared footer | H, P, A, S; inspected desktop only |
| Core media engine | Shared `getMediaEngine`, queued plan execution, retry path, cancellation signal, input/output cleanup, FFmpeg worker configuration | X, V; static source, no conversion run |
| FFmpeg threading | Multi-thread selected only with both `window.crossOriginIsolated` and `SharedArrayBuffer`; maximum four threads. Single-thread `/st/` fallback otherwise | Source `41gz1h2-8orig.js`, around character 11220; actual isolation header configuration not verified |
| Image work | Dedicated `/image-worker/image.7f70777cb2a0.js`; capability checks for `OffscreenCanvas` and `createImageBitmap` | V; no image processing run |
| Local ASR | `/whisper-worker/whisper.ef065f94d7e1.js`, `onnx-community/whisper-tiny` and same-origin model paths | V; page describes approximately 41 MB including runtime |
| Local separation | Dedicated worker, content-hashed ONNX model URL, SHA-256 validation, cache and fallback download | V; detailed below |
| Local speech | Dedicated speech worker and independent MP3 worker; multiple worker handles; damaged-model recovery code | T; detailed below |
| Offline assets | Root-scoped `/sw.js`; observed caches `cliputils-v2-pages`, `cliputils-v2-static`, `cliputils-engines`, `cliputils-meta` | H, T; full offline operation not tested |
| Remote features | API candidates for transcription, translation, speech, dubbing and Pro management | B, X, T; endpoint names alone do not establish execution |
| Telemetry | Vercel Analytics and Microsoft Clarity scripts; `/api/stats` and sponsor endpoints | P, X, privacy disclosure; no media contents inferred from telemetry |
| Monetization | Free limits, Pro pass/subscriptions, separate image-video packs; Dodo Payments disclosed | P; checkout/payment never exercised |

Do not port the root service worker into Reel Finisher: its existing editor is isolated at `/editor/`, and a root cache controller could interfere with Next.js and editor caches. Likewise, ClipUtils' FFmpeg fallback is an architectural difference, not evidence that Reel Finisher should abandon WebCodecs.

## Where each important feature runs

| Feature | Publicly disclosed processing | Implication for a local/free product |
|---|---|---|
| Trim, compress, convert, mute, audio utilities | Browser FFmpeg/WASM | Existing Reel Finisher equivalents should be reused |
| Compression limits | Desktop 120 MB / 10 minutes; phone 60 MB / 5 minutes | These are competitor limits; preserve Reel Finisher's existing 10-minute maximum |
| Subtitles: On this device | Local Whisper/ONNX; model download and browser cache | Compatible direction; Reel Finisher already has local Whisper |
| Subtitles: Accurate, the default | Audio extracted/compressed locally, sent to `/api/transcribe`; page names Groq Whisper large-v3-turbo with DeepInfra fallback | Conflicts with strictly local processing |
| Vocal/music removal | Local MDX-Net/ONNX; voice and instrumental separation | Substantive improvement over centre/side DSP; requires independent model/license/device validation |
| Noise removal | Page describes FFmpeg RNNoise for Voice and classical filtering for Light | A local RNNoise implementation is worth assessing without adopting FFmpeg |
| Text to speech | Kokoro locally for supported desktop voices; mobile speech and certain languages use a server | Reuse the local model idea, eliminate automatic cloud selection |
| Dubbing | Remote ASR, text translation and speech; local separation and replacement audio; no lip sync | Full competitor workflow conflicts with local-only; generic local dubbing already exists in Reel Finisher |
| Translation | Local or remote ASR, then text sent to remote LLM | Local-only replacement must keep translation local too |
| AI Video Editor | Remote ASR; word timings/text sent to Claude for cuts; local rendering | Reuse studio/silence edits; do not duplicate a second timeline or require Claude |
| AI Shorts Maker | Remote ASR, Claude moment selection/hooks, small video frames sent for crop planning, local final output | Newly missing workflow; not local merely because full video is not uploaded |
| Text to video | Script narration, animated caption/background composition, local video encoding; mobile narration remote | It is not generative footage. Reel Finisher already has a simpler local script-video implementation |
| Image to video | Paid server generation; page names Wan 3.0 with PixVerse V6/P-Video fallbacks through DeepInfra | Not equivalent to Reel Finisher's photo zoom; not suitable for required browser-only parity |
| Lecture to Notes | ASR then transcript sent to Claude for notes, quiz and flashcards | Newly missing workflow; local summary generation needs a separate model feasibility gate |
| PDF to Audio | PDF/photos sent to Claude for reading, OCR/explanation; desktop/local or phone/server speech | Newly missing workflow; a narrower local text-PDF reader is a possible separate product choice |

Locations and providers above are page disclosures in P/A unless corroborated below. Provider retention, training, uptime and output quality were not independently verified.

## Useful implementation details recovered from delivered code

### Neural vocal separation

Observed in V, source `0d6_1urnkv3er.js` (SHA-256 `1507576fe1ee8716d7eaa939e3d5e7b1d79cde50117206b9decdca1e1845a77f`):

- Model: `UVR_MDXNET_1_9703.onnx`, declared 29,704,436 bytes (about 28.3 MiB; engine/runtime add more).
- Model digest: `229ad3bb96a037e89d8ed86732d6d3675856e6a07c3e3f02896eac01ec7ee4be`.
- Same-origin path constructed as `/models/uvr-mdxnet/229ad3bb96a037e8/UVR_MDXNET_1_9703.onnx`.
- Fallback is a pinned Hugging Face revision: `Politrees/UVR_resources`, revision `929e057b81aa49bc2e6490bef8671f47b2c120f6`, `models/MDXNet/UVR_MDXNET_1_9703.onnx`.
- Dedicated `/vocal/separator.6f219d994817.js` worker. Startup passes model bytes, a lite-mode flag, WebGPU runtime URL and CPU fallback runtime URL under `/ort/1.21.0/`.
- Decoder plan requests stereo PCM at **44,100 Hz**. MP3 saving uses a separate FFmpeg plan with `libmp3lame`, default **192k** bitrate.
- Busy-job guard and cancellation dispose the worker. Model ownership uses transfer lists where available.

This identifies a promising local inference pipeline, not a license grant or an independently validated separation algorithm. The separator worker body/model inference was not executed or fully analyzed. Inspect exact model provenance/license and independently implement spectrogram, overlap and reconstruction before replacing Reel Finisher's explicitly labelled DSP tool.

### Downloadable speech

Observed in T, source `1swbrl_ich9ol.js` (SHA-256 `3a9a8c7f8123f852cccd2ea0580fe2ff5d30990372bd3748a63544249a0d79bf`):

- Worker entry `/tts-worker/tts.817574f44d12.js`, module mode.
- MP3 worker `/tts-worker/mp3.f18c908c85ab.js` receives transferable PCM, sample rate and kbps; returns MP3 bytes.
- Worker-handle pool, progress listeners, termination and damaged-model recovery.
- Mobile/low-memory detection includes mobile user agents and `navigator.deviceMemory <= 4`.
- `/api/tts/speak` includes an allowance GET path; source also contains server speech routing. Page explicitly discloses mobile and certain-language server processing.
- Kokoro, 31 voices / 10 languages, and approximately 92 MB are **page claims**. The local worker's actual model variant, weights and phonemizer dependencies were not inspected.

Reel Finisher's standalone speech tool currently uses Web Speech API playback and offers no downloadable file (`src/components/media/TextToSpeech.tsx`). It already has local SpeechT5 synthesis inside the separate narration/dubbing worker. The smallest improvement is to expose that existing downloadable speech capability first; evaluate Kokoro for quality/language expansion separately.

### Server transcription is explicit in source

Source `2xh2guz7ld4wb.js`, SHA-256 `ccef2a26a1a7204c0fd98942320f687c952ec3494756ad090535425e259f52a7`, contains a POST to `/api/transcribe`, with the audio blob as its body, content type, rounded audio duration and optional language header. This corroborates the disclosed remote path; no transcription request was made with our own audio.

## UI and discovery patterns worth reusing conceptually

- A single directory/catalog feeds category navigation and tool discovery. Many conversion-specific links are variants of one engine, not unique implementations.
- Each tool leads with the action and privacy explanation, then instructions, practical limits, FAQs and related tools.
- The same visual shell is reused across media types, with download/result controls beside the working area.
- Product routes, localized landing pages and preset/format routes are separate concerns. The bundle's 77 route patterns are **candidates**, not 77 independently implemented tools.
- Adapt these patterns to Reel Finisher's current components and branding; do not copy competitor text, logos, compiled application code or unreviewed model assets.

## Gaps versus the actual Reel Finisher source

Checked `src/lib/tools/catalog.ts`, `docs/tools-matrix.md`, `src/components/media/TextToSpeech.tsx`, and the existing local model allowlist. This was a focused source comparison, not a fresh full-project audit or regression run.

| Area | Current Reel Finisher | Suggested action |
|---|---|---|
| Core photo/video/audio tools | Already present | Improve existing tools only when a measured gap warrants it |
| Timeline, captions, silence edits | Existing OpenReel studio | Keep its single project/history/render/export authority |
| Vocal/music removal | Centre/side DSP, explicitly not neural separation | Highest-impact new local model capability |
| Speech download | Standalone route playback-only; local SpeechT5 exists elsewhere | Reuse current worker for a downloadable result before adding a second speech stack |
| Noise cleanup | Profile-based spectral subtraction | Assess independent RNNoise worker as an additional mode |
| Text/photo video | Local caption cards and photo zoom | Already implemented; improve composition and timing rather than creating duplicate routes |
| Translation/dubbing | Local Whisper, native translator where supported, generic English SpeechT5 dubbing | Keep capability restrictions explicit; multilingual parity not established |
| Shorts selection | No equivalent catalog entry | New workflow, requiring local moment selection and existing studio integration |
| Lecture notes / PDF audio | No equivalent catalog entries | New workflows; scope independently before implementation |

No application source, routes, dependencies or editor behavior were changed for this investigation.

## Claims not to copy

The privacy page's opening says Accurate subtitles are the “one exception” to device-only processing, but its later sections and other tool pages describe additional remote text/audio/image/PDF processing. Text-to-video's introductory privacy group says the script never leaves the device, while its body describes mobile server speech. Prefer a tool- and device-specific disclosure immediately before processing.

Pricing/homepage use broad no-watermark language, while Shorts Maker and Text to Video disclose a free `cliputils.com` tag. Reel Finisher should preserve its own free watermark-free exports rather than copy conflicting claims.

These are observed differences in public wording, not a finding that the site uploads undisclosed media or violates its retention promises.

## Coverage, limitations and next verification

| Question | Status |
|---|---|
| Public tool inventory and key workflows | Answered within inspected pages; all 31 individual tools were not exercised |
| Framework and main browser processing approach | Answered through delivered-source evidence |
| Local versus cloud boundaries | Answered for listed features from disclosures and selected source corroboration |
| Exact private backend, provider fallback behavior and deletion | Unresolved; server source/access not available |
| Actual generated files, inference quality, speed and offline success | Not tested |
| Mobile, Safari/Firefox, GPU fallback and memory recovery | Not tested |
| Model/engine licensing suitable for redistribution | Not verified; exact artifacts need separate review |
| SEO robots/sitemap/canonical correctness | Not audited; public linked landing pages/FAQ content observed only |

REA's homepage bundle analysis retained 17 sources; 16 completed and one large script hit the selected 20-second per-script deadline. The route inventory is partial, with 77 patterns / 259 occurrences and unresolved facts. No source-map records were produced; original source was not recovered.

The first multi-page scenario completed every navigation action, but network event retention reached its selected memory budget. Subsequent events/bodies were omitted, and many earlier script bodies were unavailable. The exported manifest records those omissions. Later dedicated vocal/speech source captures address specific code questions but do not make the network recording complete. Passive collection also cannot recover requests before attachment or guarantee worker-network coverage. Do not interpret an absent request as proof of no upload.

Before implementing upgrades: validate model/license provenance; generate controlled stereo and mono fixtures; compare neural stems against DSP; measure speech output and word timing; verify cancellation and repeated operations; test download caching and offline processing; decode real outputs; run strict outbound-request monitoring; test desktop/mobile fallback; preserve the 600-second video ceiling and existing editor tests.

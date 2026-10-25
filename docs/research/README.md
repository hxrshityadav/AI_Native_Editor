# Research notes

Facts we rely on, with source and date checked. Recheck before pricing or launch decisions.

## Studio fonts and subject-mask evaluation (2026-10-25)

- Extra fonts come from the official `google/fonts` repository, with each unmodified OFL-1.1 license
  bundled beside the binary. Sources and SHA-256 hashes: `public/fonts/catalog/SOURCES.md`.
  Licenses checked: https://raw.githubusercontent.com/google/fonts/main/ofl/notoserif/OFL.txt,
  https://raw.githubusercontent.com/google/fonts/main/ofl/robotomono/OFL.txt,
  https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/OFL.txt,
  https://raw.githubusercontent.com/google/fonts/main/ofl/anton/OFL.txt.
- Mediabunny's installed declarations were checked before using `processedWidth/Height`, frame
  drawing, `VideoSample`, `AudioSample.trim/setTimestamp`, `AudioSampleSink`, and conversion callbacks.
  Custom composition runs before captions; source/display dimensions are preserved through rotation.
- MediaPipe web guide: https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js.
  `segmentForVideo` is synchronous and the guide recommends workers to avoid UI blocking.
- Model options/benchmarks: https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter.
  Person masks are available from SelfieSegmenter (256×256 or 144×256). The reported Pixel 6 CPU
  timings are about 33–34 ms, **not** browser/WebCodecs measurements. Our inference is that browser
  inference plus encoding needs a separate performance pass before promising real-time behavior.
- Model card: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf.
  It describes 249 KB/244 KB models and Apache-2.0 licensing, with thin-feature, occlusion and lighting
  limitations. This historical card does not pin the latest model binary; verify the chosen artifact
  and license before redistribution.
- Runtime metadata was inspected using `npm view @mediapipe/tasks-vision version dist.unpackedSize --json`:
  version 1.1.1, 42,064,546 unpacked bytes. Unpacked size is not network transfer size or resident RAM.
  Nothing was installed. The core editor has no new ML dependency, API spend or video upload path.
- Segmentation evaluation gates: pin the model/runtime and licenses; measure worker CPU/GPU and memory
  alongside encoding; compare masks during seek and chronological export; test hair/fast movement/low
  light; add deterministic temporal smoothing with reset after seeks/cuts; verify cancellation and
  mid-range Android. Until then the ordinary overlay layer ships with masking explicitly unavailable.

## Ten-minute integration review (2026-10-25)

- Rechecked Groq's official speech guide: https://console.groq.com/docs/speech-to-text.
  Existing multilingual Whisper, Ogg uploads, `verbose_json`, and word granularities remain appropriate.
- Rechecked Vercel's function limits: https://vercel.com/docs/functions/limitations.
  Request/response payload ceiling is 4.5 MB. Our 4 MiB audio + 64 KiB multipart ceiling stays below it.
- Next.js environment loading, Route Handlers, and `maxDuration` were checked against the installed
  `node_modules/next/dist/docs/` reference. `.env.local` belongs at the project root; provider keys
  must never use `NEXT_PUBLIC_`. A 180-second function budget is requested; deployment acceptance
  still needs validation on the actual host.
- No successful live transcription: this checkout has neither real provider key nor `.env.local`.
  Successful responses use mocked adapters/browser interception; server E2E may reach Groq's
  authentication rejection using a deliberately invalid key. These checks do not establish speech
  quality or synchronization on real clips.
- Exact-boundary browser regression: WebCodecs/Mediabunny produced 600.0135 seconds of Opus from
  a validated 600-second source. RFC 7845 §4.4 (https://www.rfc-editor.org/rfc/rfc7845#section-4.4)
  defines EOS granule end trimming for encoder padding. Our extractor caps only this end marker
  at the validated source duration and recomputes that page's Ogg CRC; it never accepts or trims a
  video longer than the limit. E2E checks the resulting duration and clean ffmpeg decoding.

## Groq speech-to-text (checked 2026-10-24, https://console.groq.com/docs/speech-to-text)

- Endpoint: `POST https://api.groq.com/openai/v1/audio/transcriptions`, OpenAI-compatible.
- Models: `whisper-large-v3` ($0.111/h, WER 10.3%), `whisper-large-v3-turbo` ($0.04/h, WER 12%, no translation).
- Limits: 25 MB upload on the free tier (100 MB on the dev tier); minimum billed length 10 s.
- Formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm. Only the first audio track is used.
- Word timings: `response_format=verbose_json` + `timestamp_granularities[]=word` → `words[{word,start,end}]`.
- `language` takes ISO-639-1 (we send `hi`, `en`, or omit for auto). `prompt` (≤224 tokens) can steer
  spelling or style. Worth testing for Hinglish in T-12.
- Not yet verified: Groq's data retention for audio inputs. Read their privacy policy and terms
  before launch and update the disclosure if needed.

## Groq chat for Hinglish romanization (checked 2026-10-25)

- Structured Outputs (https://console.groq.com/docs/structured-outputs): `strict: true` (constrained
  decoding, schema always matched) works on `openai/gpt-oss-20b`, `openai/gpt-oss-120b`,
  `qwen/qwen3.8-27b` and `meta-models/muse-spark-open`. Strict mode needs every property `required`
  and `additionalProperties: false`. Array length can't be pinned, so we check it ourselves.
- Reasoning (https://console.groq.com/docs/reasoning): GPT-OSS takes `reasoning_effort` low, medium
  or high; `include_reasoning: false` drops reasoning from the response.
- `openai/gpt-oss-120b` price (https://console.groq.com/docs/model/openai/gpt-oss-120b): $0.15 per
  1M input tokens, $0.60 per 1M output; 131k context. A 3-minute clip (~500 words) is roughly 2–4k
  tokens, about $0.001–0.002.
- Why not Whisper `language=en` for Hinglish: Whisper tends to translate non-English speech into
  English rather than transliterate it. To be confirmed on real clips in T-12.

## Vercel (checked 2026-10-24, https://vercel.com/docs/functions/limitations)

- Function request and response bodies are capped at 4.5 MB. This drives D-005.

## Platform upload specs (checked 2026-10-25)

See `platform-uploads.md`: YouTube recommends MP4 with moov at the front, AAC or Opus. Meta's
Instagram, Facebook and WhatsApp specs say AAC. WhatsApp's app defaults to 100 MB and 720p.

## Cloudflare Turnstile (checked 2026-10-25)

- Siteverify (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/):
  `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`, JSON `{secret, response, remoteip?}`.
  Tokens are at most 2048 characters, valid for 300 s and single use (`timeout-or-duplicate` on reuse).
  The error codes `invalid-input-secret`, `missing-input-secret`, `bad-request` and `internal-error` are on our side.
- Test keys (https://developers.cloudflare.com/turnstile/troubleshooting/testing/): site key
  `1x00000000000000000000AA` (passes), secret `1x0000000000000000000000000000000AA` (passes),
  `2x...AA` (fails), `3x...AA` (already spent). The dummy token is `XXXX.DUMMY.TOKEN.XXXX`. Automated browsers are
  detected as bots by the real widget.
- Widget (https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/): explicit
  rendering via `api.js?render=explicit`, `turnstile.render/reset/remove`. Defaults: `refresh-expired: auto`,
  `retry: auto`, `appearance: always`. We use `interaction-only`.
- Privacy (https://www.cloudflare.com/turnstile-privacy-policy/, updated 2025-06-18): collects client IP,
  TLS fingerprint, User-Agent, and site key with its origin. Used for bot detection and improving it.
- Pricing: free for managed widgets, but not rechecked here. Check the dashboard before launch.

## Sarvam speech-to-text (checked 2026-10-25)

- REST (https://docs.sarvam.ai/api-reference/speech-to-text/transcribe): `POST https://api.sarvam.ai/speech-to-text`,
  multipart, header `api-subscription-key`. Accepts OGG/OPUS among others. Models `saaras:v4` (default)
  and `saaras:v3`.
- `mode`: transcribe, translate, verbatim, **translit** (Roman script only: "mera phone number hai") and codemix
  (Devanagari plus English words). The docs say `mode` applies to saaras:v3 only, yet describe v4 as supporting
  all modes. We default to v3; `SARVAM_MODEL` can switch.
- **Under 30 s per REST request.** Longer audio uses the Batch API (job, upload, poll; up to 2 h per file,
  20 files per job).
- **No word-level timestamps**, in REST or Batch. `with_timestamps=true` gives chunk (phrase) start/end only.
- Price (https://docs.sarvam.ai/api/getting-started/pricing): ₹0.49/min pay-as-you-go, billed per second
  (₹1.47 per 3-min clip). Groq whisper-large-v3 is $0.111/h (about $0.0056 per 3 min).
- **Privacy** (https://www.sarvam.ai/privacy-policy): uses your content, including inputs and uploads, to train
  and improve its models **unless you opt out** in account settings or by emailing privacy@sarvam.ai. The
  Trust Center says audio storage can be opted out of. We require `SARVAM_TRAINING_OPT_OUT=confirmed`.
- Not verified here: api.sarvam.ai is blocked from this container, so no live call has been made.

## Instagram Edits

- No public API. The bake-off compares it by text only: type or paste its captions into `<clip>.edits.txt`.

## To do

- Real upload results for the T-13 test pack (`platform-uploads.md`).
- Vercel plan terms for commercial use before charging money.

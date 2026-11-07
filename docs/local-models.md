# Local model and runtime inventory — November 4, 2026

Public models/runtime assets only; no media, document or transcript is sent for inference. No paid provider or account is required. Large speech/Whisper weights are optional downloads after consent, not included in the production build. RNNoise's small model is embedded in its optional runtime; retained models outside this increment are documented below. Existing OpenReel remains the sole project/history/timeline/render/export workspace.

## Current models

| Asset | Exact revision / origin | Bytes | License / scope |
|---|---|---:|---|
| Whisper Tiny q4 encoder | `onnx-community/whisper-tiny`, `ff4177021cc41f7db950912b73ea4fdf7d01d8e7` | 9,020,667 | OpenAI Whisper Apache-2.0; multilingual ASR, estimated segment times |
| Whisper Tiny merged q4 decoder | Same | 86,713,702 | Same; weights total 95,734,369 bytes / 91.30 MiB, plus configs/tokenizer/runtime |
| SpeechT5 q8 encoder | `Xenova/speecht5_tts`, `1723781b8ce2d02f0400c8337be04ae8ee3d6d56` | 88,402,301 | Microsoft's MIT SpeechT5, ONNX conversion; English generic voice |
| SpeechT5 **fp32** merged decoder | Same | 244,486,683 | Replaces q8 decoder after actual spoken-content failure |
| HiFiGAN fp32 | `Xenova/speecht5_hifigan`, `cf980c3610d7b7f20919960031066ef7905737bd` | 55,432,026 | Microsoft MIT; current speech weights total **388,321,010 bytes / 370.33 MiB** |
| Fixed generic speaker vector | `Xenova/transformers.js-docs`, `542437c29cc5273cfd29e25c77696f2b349badd7` | 2,048 | Exact hash matches `Matthijs/cmu-arctic-xvectors` row 7306, `cmu_us_slt_arctic-wav-arctic_a0508`, revision `5c1297a9eb6c91714ea77c0d4ac5aca9b6a952e5`; MIT dataset declaration plus original CMU 2003 permissive commercial-use terms retained |
| RNNoise embedded v0.1 model/runtime | Unmodified async build in `@jitsi/rnnoise-wasm@0.2.1`, git `cb529a59a8478fe604e57986fc96afdaecfa6fb7` | WASM 112,141; JS 12,265 | RNNoise BSD-3-Clause, wrapper Apache-2.0; total 121.49 KiB, no separate weights |

SHA-256 values below were independently verified against actual downloaded/cache bytes in Chrome, Edge and Firefox (13/13 checks each). Records: `output/local-ai-cache/hashes-{chrome,msedge,firefox}.json`.

```text
Whisper encoder q4    45a55cedf1ff46606520f5938ed40c94bd4f6b38beb2a646eed8636225342488
Whisper decoder q4    a7573efde84f7d018d59e50e7f860c03e26623d68e23eb6037b76135367e72eb
SpeechT5 encoder q8   407375255d220d8ddf81e9a06d4100f80f870f8446e77d4f20951d2a4c08a156
SpeechT5 decoder fp32 c055656c559c5d17055a87d5c7ec544326b8852d372f171ce27c52945d836465
HiFiGAN fp32          26408d9b8b3e83e66a3ef614a5621b84cacdcabd81b3a6a2fa984eb788566e6c
Speaker vector       7384027325428d6eda21f47213572541443f5864044295a2e5c07fbaaf372bb3
RNNoise WASM         677147b9248aedc0a00de79dc090d1ecead37c08c8bb773a790da16109d2c487
RNNoise JS           83a86f528a0f4d5c61a84be40dac9f15e5d114f24971bd5953f7f21879bc9bdf
```

The worker verifies the speaker vector before use and repairs a corrupt cached copy once. RNNoise verifies its WASM and retries that asset alone with HTTP cache reload after an integrity mismatch. Known speech/Whisper cache entries now have their Blob size checked; truncated entries are individually evicted for retry without clearing Studio storage. Large model SHA-256 integrity is checked against actual cached bytes in the opt-in browser suite; it is not rehashed on every production inference, so same-size corruption remains a recovery limitation. See `production-readiness-report.md` for current release gates and results. The original unknown-vector provenance item was resolved by byte-for-byte comparison with the documented SLT vector and the original corpus COPYING file; the voice itself was not changed.

## Runtime and redistribution notices

- Transformers.js **3.8.1**, Apache-2.0, reused from the existing editor install. Console calls are removed in its built browser bundle.
- Matching ONNX Runtime Web **1.22.0-dev.20250409-89f8206ba4**, MIT. Its exact source revision's 326,866-byte third-party notices are retained. Build fails if this runtime version changes without updating that audit.
- PDF.js / `pdfjs-dist@6.5.438`, Apache-2.0, isolated under `tools/pdf`. Only unmodified legacy API/worker, Adobe CMaps, Foxit Symbol/Dingbats and notices ship. Bundled core-js 3.51.0 is MIT; Adobe/PDFium notices are retained. Liberation fonts and image decoder/QuickJS/WASM assets do not ship. Optional native canvas dependencies are omitted.
- PDF API SHA-256 `522ad2c83bc8a0010e7f0cc60d0892b77c8d2bf2c9702dc12288311d94270f42`; worker `b4c8353ded0d88d2e2009574a29eb4e0c3ff7e942ecdf51ef5f71566a9667f31`.
- RNNoise lives in isolated `tools/neural-audio`; root processing continues to use the existing Mediabunny/WebCodecs engine. Mediabunny's MPL-2.0 source offer and notices are retained. OpenReel's MIT license/notices remain in the source fork. This does not imply every bundled third-party asset has the same license.
- Local speech notices: `/local-ai/MODEL-NOTICES.txt`, `/local-ai/SPEAKER-NOTICE.txt`; noise: `/local-ai/RNNOISE-NOTICE.txt`; PDF: `/pdfjs/6.5.438/NOTICE.txt`; existing media: `/media-notices/SOURCES.txt`.

## Cache and recovery policy

Root model URLs use `/local-models/v1/`; the server resolves `main` to the exact approved revisions above. Browser Cache Storage uses **`reel-finisher-models-v1`** and accepts only same-origin public URLs in that namespace. It never caches media/transcripts, clears another cache or writes to a project DB. Unversioned delivery remains an alias for older clients, with shorter HTTP caching. Versioned models and immutable RNNoise/PDF runtime assets use long-lived cache headers. No root service worker is introduced.

Change a model revision only with a new namespace and a reviewed manifest; retain published old resolvers while old clients are supported. Do not repoint a published immutable URL. Storage is best-effort: quota/private-mode failures permit an online job but may require another download. To recover an unusable root model cache, delete only `reel-finisher-models-v1` in browser DevTools Cache Storage and retry after consent. **Do not clear all site storage to repair a model**: that can erase Studio projects and local media. Keep originals and exports. Model-network-blocked reload tests prove model-cache reuse, not a complete offline installation of the Next.js website.

## Practical limits and measured evidence

- HTTPS/localhost, module workers, SIMD-capable WebAssembly; speech uses single-thread CPU/WASM, without a new SharedArrayBuffer or WebGPU requirement on public pages. Studio retains its own scoped isolation headers.
- Speech: one English voice; 500 characters/60 seconds standalone; PDF selections up to 5,000 characters, sentence-based chunks of at most 100 characters, 100-ms joins and ten-minute output cap. Other video duration guards remain 600 seconds; existing cleanup/dubbing jobs stay at 120 seconds.
- PDF: 10 MiB, 50 pages, 100,000 extracted characters; no OCR/password support. Complex layout/font reading order needs review.
- Controlled paragraph: old q8 decoder achieved only 31.5% unique content-word recall through local Whisper. The same engine with fp32 decoder achieved 100% and produced a 37.18-second WAV in 241,871 ms including download/loading. These are generated fixtures, not perceptual quality or warmed-inference benchmarks.
- Neural noise short fixtures: broadband RMS ratio .133; fan/traffic/room/keyboard/hiss/clean speech correlations .959–.970. Earlier isolated runs took 677–1,161 ms. See the ledger for exact run conditions and later concurrent-run measurements.
- Real Chrome/Edge/Firefox engine and mobile viewport results are logged in the ledger. Physical phones/Safari, long-job peak memory, deployment streaming of the 244.5-MB decoder, real-world listening and offline site reload remain separate manual gates. No total-process memory benchmark is claimed.

## Candidates not adopted

UVR `UVR_MDXNET_1_9703.onnx` remains blocked: metadata names a 29,704,436-byte file and hash, but model-specific redistribution authority and exact tensor/STFT contract are unresolved. No weights downloaded or neural separation button shipped. Demucs' maintainer restricts weights to research; Spleeter browser conversion is unvalidated. Existing stereo DSP remains available.

Kokoro metadata was inspected (ONNX repository revision `1939ad2a8e416c0acfeecc08a694d14ef25f2231`, Apache-2.0/English card), without adding a second model/phonemizer stack. CPU/WebGPU/memory/voice-quality comparisons are not benchmarked. SmolLM2-135M-Instruct metadata, context and memory bounds were investigated; generative summaries/ranking remain deferred. Notes and moment suggestions are explicitly extractive/deterministic.

## Retained models outside this increment

The existing Background Remover retains local `u2netp.onnx` (4,574,861 bytes, SHA-256 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`, U²-Net Apache-2.0 model/source provenance in `/media-notices/SOURCES.txt`) with its separate `tools/ort` ONNX Runtime Web **1.30.0** install. It is not replaced by the borrowed speech runtime.

Native Studio retains its own model choices from `vendor/openreel/apps/web/src/workers/whisper-models.ts`: default `onnx-community/whisper-tiny` (about 100 MB) and optional `onnx-community/whisper-large-v3-turbo_timestamped` (about 760 MB; WebGPU recommended). This increment does not replace their model delivery/cache or claim new accuracy/performance results for the large model. Root creator tools use the pinned Tiny inventory above. These sizes are separate, not included in the 370.33-MiB speech total.

Primary sources: [Whisper](https://huggingface.co/openai/whisper-tiny), [SpeechT5](https://huggingface.co/microsoft/speecht5_tts), [HiFiGAN](https://huggingface.co/microsoft/speecht5_hifigan), [CMU vector dataset](https://huggingface.co/datasets/Matthijs/cmu-arctic-xvectors), [original CMU copying terms](http://festvox.org/cmu_arctic/cmu_arctic/cmu_us_slt_arctic/COPYING), [RNNoise](https://github.com/xiph/rnnoise/tree/v0.1), [Jitsi wrapper](https://github.com/jitsi/rnnoise-wasm/tree/cb529a59a8478fe604e57986fc96afdaecfa6fb7), [PDF.js](https://github.com/mozilla/pdf.js), [ORT third-party notices](https://github.com/microsoft/onnxruntime/blob/89f8206ba4/ThirdPartyNotices.txt).

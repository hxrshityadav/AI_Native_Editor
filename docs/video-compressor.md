# Standalone video compressor

`/tools/video-compressor` uses the existing root Mediabunny 1.62.1 dependency in a dedicated worker. It does not import the OpenReel app, use the legacy renderer's shared OPFS directory, or call an upload/transcription API. No dependencies were added.

## Implementation and limits

- `src/lib/videos/policy.ts`: file/container validation, existing 600-second duration guard, even-pixel resolution fitting, bitrate and target estimates.
- `src/lib/videos/engine.ts`: actual probing/decoding, runtime video/audio encoder checks, native Conversion transcoding and measured output validation.
- `src/lib/videos/bounded-target.ts`: seekable encoded-byte pages, checked before allocation; source and output are never decoded as an entire movie.
- `src/lib/videos/video.worker.ts` and `client.ts`: one worker per job, real conversion progress, termination on cancellation/replacement/unmount and a 90-second inactivity timeout.
- `src/components/videos/VideoCompressor.tsx`: shared photo-tool styling and Blob URL lifecycle, native before/after video previews, measured downloads and recoverable errors.
- Route, tools index, sitemap, related photo links and privacy text provide server-rendered discovery. Canonicals follow the existing configured `siteOrigin`; configure the real production origin before deployment.

Input: 512 MiB, positive finite duration at most 600 seconds, longest edge 3840 pixels, at most 3840×2160 pixels, one video and at most one audio stream. Accepted containers are MP4/MOV/WebM; extensions/MIME alone do not establish decodability.

Output: MP4 H.264/AAC preferred, WebM VP9/Opus fallback, only after probing actual browser support at selected dimensions. Audio is retained as stereo 48 kHz/128 kbps unless explicitly muted; unavailable audio encoding blocks export. Resolutions fit both landscape/portrait bounds without upscaling, rounding down to even pixels. Rotation is baked in, whole frames are contained, frame rate is normalized to at most 30 fps. VFR cadence, HDR colours, channel layout and metadata are not promised unchanged. Tags and subtitle/data tracks are not copied; multiple video/audio streams are rejected.

Encoded output is capped at 128 MiB. Source parsing uses an 8 MiB cache; encoding uses native streaming queues and 1 MiB output pages. Pages plus the final Blob can briefly require roughly twice the output size, in addition to native codec/frame/preview memory. This is not a total process-memory guarantee. Real low-memory devices still need testing. Targets use decimal KB/MB, a 4% overhead estimate and a minimum video bitrate of 100 kbps; size is measured before reporting success or target attainment. An already-compressed input may become larger.

Workers and URLs are released on completion, failure, cancellation, replacement and unmount. Settings invalidate downloads. There is no persistent video storage and no upload fallback. MP4 uses a trailing index; the local Blob is seekable, but the output is not optimized for progressive network playback.

## Licensing

The existing root Mediabunny runtime is MPL-2.0, separate from OpenReel's MIT license and older vendor dependency. `scripts/prepare-media-notices.mjs` runs before dev/build and copies its installed license and unmodified source to `/media-notices/`, linked from the tool. Generated source is excluded from app typechecking/linting. Retain this material with deployments and review it when updating the dependency. No FFmpeg runtime ships in this feature; ffmpeg/ffprobe are test-only executables.

## Change inventory

- New route/UI: `src/app/tools/video-compressor/page.tsx`, `src/components/videos/VideoCompressor.tsx`, `VideoCompressor.module.css`.
- Reused and hardened media layer: `src/lib/videos/{policy,engine,client,video.worker}.ts`; reused the existing `bounded-target.ts` and root media probe/duration helpers. Fixed packet-rate API usage, first-sample timestamps, output container validation, resolution short-edge bounds and late worker callbacks.
- Shared UI: `src/components/tools/useBlobUrl.ts` now handles the initial undefined resource safely; `src/components/images/ToolPage.tsx` links the new tool. Photo processing itself is unchanged.
- Discovery/disclosure: `src/app/tools/page.tsx`, `src/app/sitemap.ts`, `src/app/privacy/page.tsx`.
- Tests: new `tests/unit/video-compressor.test.ts` and `tests/e2e/video-compressor.e2e.mjs`; updated `tests/unit/site.test.ts` sitemap expectation and `tests/e2e/photos.e2e.mjs` tools-index heading assertion.
- Delivery: `scripts/prepare-media-notices.mjs`, `package.json`, `.gitignore`, `tsconfig.json`, `eslint.config.mjs`, README, TASKS and this guide. Generated `public/media-notices/` and test artifacts are ignored. No dependency/lockfile update or editor-source change is required.

## Verification

Run `npm run check`, `npm run build`, then `npm run e2e` (includes `npm run e2e:video`). The video suite generates synchronized flash/beep, rotated, variable-frame-rate, MOV, WebM and invalid fixtures. It downloads real results, probes/decodes them independently, checks timing/content and playback, and exercises codec failure, explicit mute, cancellation, retry, replacement, resource cleanup, local requests, SEO and mobile layout.

Desktop generated-file checks on Windows:

- Chrome 156.0.8078.48: 37/37 video checks, including synchronized H.264/AAC MP4, VP9/Opus WebM and actual downloaded playback.
- Edge 156.0.4314.50: 37/37 of the same checks.
- Firefox 155.0: 16/16 compatibility checks. Its AAC encoder was unavailable: MP4 with audio was correctly blocked. WebM/VP9/Opus retained audio and played independently; explicit mute enabled valid H.264 MP4. Rotation, VFR duration, audio onset, URL cleanup, mobile viewport and local requests were tested. This does not establish AAC encoding support in Firefox.

The first Firefox run assumed AAC and timed out waiting for the intentionally disabled action. The compatibility test now probes that condition explicitly and tests supported recovery rather than assuming codec parity.

`npm run check` passes: 315 root + 188 fork web + 64 core tests = **567 passed**, with six database and four existing upstream skips; typecheck and lint pass. `npm run e2e` passes **378/378**: lab 67, legacy studio 39, server 20, phone 8, silence 16, advanced 42, manual 42, ripple 20, OpenReel 34, migration 9, photos 44, video 37. The separate server shared-database check remains skipped without `E2E_DATABASE_URL`.

Production builds pass from a clean `.next` directory. An incremental build encountered this checkout's existing internal Next `undefined.length` cache exception; clearing only generated `.next` and rebuilding resolved it. Generated dependency source initially entered the app's TypeScript scan; `tsconfig.json` and ESLint now explicitly exclude `public/media-notices`.

After the final tools-index heading update, the clean production build passed again, followed by photo **44/44** and video **37/37** checks against that build. Evidence is in ignored `output/launch-video-{check,build,regression,photos-final,final,edge,firefox}.log`; desktop and phone screenshots and actual outputs are in `output/launch-video/` (plus separate Edge/Firefox directories).

Manual release gates: actual iOS Safari/Android devices, low-memory/long-duration/high-motion sources, sustained encoder throughput/thermal effects, HEVC/HDR and unusual camera metadata, assistive technology, public-domain canonical and CDN/cache/CSP behaviour. Desktop emulation does not verify physical phones. Cancelling a worker releases application references; native/browser reclamation timing is implementation-dependent.

# Sprint 1 photo utilities

Implementation and automated verification complete. Real-device and deployment checks remain below. No new dependencies or services were introduced.

## Routes and reuse

- `/tools`: crawlable photo-tool index.
- `/tools/image-compressor`: measured JPEG/WebP quality search and lossless PNG re-encoding.
- `/tools/image-resizer`: custom dimensions, ratio lock and whole-image bounding-box presets.
- `/tools/image-converter`: JPEG, PNG and WebP with explicit JPEG background compositing.

Repository inspection found no standalone photo utilities in the Next application. Its existing `editor/parts.tsx` combines button styles with video, captions and session/render imports. OpenReel's compressor is for video bitrate targets; its image exporter renders a native project frame. Reusing those engines would couple simple image pages to the editor's heavy project runtime. The new tools instead share one small native-canvas image layer and interface, reusing the current CSS colour tokens, system typography, Next page conventions, `siteOrigin`, sitemap and browser-test infrastructure. `/studio`, `/studio-legacy`, `/lab` and the vendor integration are unchanged by this sprint.

## Changed files

| Area | Files |
| --- | --- |
| Shared image logic | `src/lib/images/policy.ts`, `engine.ts`, `image.worker.ts`, `client.ts`, `tools.ts` |
| Shared interface / server content | `src/components/images/ImageTool.tsx`, `ImageTool.module.css`, `ToolPage.tsx` |
| Pages | `src/app/tools/page.tsx`, `tools/image-compressor/page.tsx`, `tools/image-resizer/page.tsx`, `tools/image-converter/page.tsx` |
| Discovery / privacy | `src/app/page.tsx`, `src/app/sitemap.ts`, `src/app/privacy/page.tsx` |
| Tests / commands | `tests/unit/images.test.ts`, `tests/unit/site.test.ts`, `tests/e2e/photos.e2e.mjs`, `package.json` |
| Delivery notes | `README.md`, `TASKS.md`, this document |

## Processing and limits

- Still JPEG, PNG and WebP only; 25 MiB encoded input, 8192 px per side, 16 million decoded/output pixels. Headers are read from a bounded 1 MiB prefix before decoding. Unreadable/oversized headers are rejected rather than allocating blindly. MIME declarations are checked against signatures, then the browser must actually decode the image. Empty/generic MIME declarations require the same signature/decode validation.
- GIF, SVG, HEIC/RAW and animated PNG/WebP are rejected. A JPEG whose dimension header lies beyond the metadata prefix must be re-exported first. Limits bound allocations but do not guarantee a low-memory phone can process every permitted image.
- Dedicated module workers perform decode, alpha inspection, canvas rendering and repeated encoding when supported. Each job owns a worker; cancellation/replacement terminates it. A DOM image/canvas fallback is available when worker/canvas capabilities are absent. In the fallback, in-flight native encode work may finish internally after cancellation, but its result is discarded and resources released.
- Original files remain immutable. Every operation starts from the original file, avoiding cumulative lossy re-encoding. Browser orientation is applied to pixels where supported. EXIF/location/camera metadata is not preserved. Colour-profile conversions, HDR and precision are subject to the browser's standard canvas pipeline; this is not a professional colour-managed/RAW workflow.
- JPEG/WebP quality is a ceiling, not a fidelity percentage. Optional targets use **decimal KB (1,000 bytes)**. At most ten measured encodes are considered; only a tested candidate within the target is reported as meeting it. When none meets it, the smallest measured result is shown with a resize/format recovery message. No mathematically global optimum or exact-byte-size promise is made. PNG is lossless, ignores quality and can grow in size.
- Resizer presets fit inside 1920, 1080, 800 or 400 px bounding boxes without cropping/upscaling. Custom dimensions can upscale; unlocking ratio intentionally stretches. Ratio calculations use a fixed reference to avoid rounding drift across repeated changes.
- PNG/WebP retain alpha. Transparent JPEG conversion warns before processing and blends onto a user-selected solid background. The encoder's actual Blob MIME type is checked; a browser's PNG fallback cannot be mislabeled as WebP/JPEG.
- Previews are capped at 1024 px per side to avoid decoding full-size previews on the UI thread. Bitmaps/canvases are closed/released after jobs; object URLs are revoked on replacement/unmount. Changing settings removes stale results/downloads. The file picker retains a `File` before resetting its live `FileList`.
- No uploads, provider calls, accounts, persistence, analytics or external assets were added. A download is an explicit action with a new suffixed filename. There is no image API route. Existing dependency/license obligations are unchanged; these tools add no library licenses.

## SEO

Each tool has a server-rendered title, description, heading, instructions, FAQs and internal links. `/tools` and its three utilities are added to the existing sitemap. Canonicals continue to use **`SITE_URL` configured before production build**; no domain is invented when unset. The existing exclusions/noindex rules for the editor, legacy editor and lab remain intact. Deployed-domain/CDN/canonical checks still require the real deployment.

## Verification

`npm run check` passes: lint, Next/root and fork typechecks, **308 root + 188 fork web + 64 core tests (560 total)**. Six database tests and four pre-existing upstream tests remain skipped. No new tests are skipped. `npm run build` passes, including the unchanged OpenReel build and all four new prerendered routes. An earlier incremental build hit an internal Next error; removing only the verified generated `.next` folder and repeating the full build succeeded. Its underlying cause was not established. Existing warnings about large editor chunks/browser datasets remain.

`npm run e2e:photos` passes **44/44 in installed Chrome 156**, and the same suite passes **44/44 in Firefox 155**. These are automated desktop sessions and mobile viewport emulation, not real-phone certifications. Browser tests generate actual PNG/JPEG fixtures, add EXIF orientation, download and decode the outputs with ffprobe/FFmpeg, compare opaque/partial/transparent pixels and dimensions, check byte budgets, validate errors, cancel/retry work, exercise the HTML-image/canvas fallback and a deliberately unsupported encoder, and inspect mobile layouts and local-only requests. They also verify missing MIME handling, excessive bytes/pixels, malformed metadata, corrupt compressed data, same-file reselection, stale-result invalidation and object-URL cleanup. No editor/model assets or external processing requests were observed on the photo pages.

The final **`npm run e2e` exits 0: 341/341 checks** — lab 67, legacy studio 39, server 20, phone simulation 8, silence 16, advanced 42, manual 42, legacy ripple 20, OpenReel editor 34, migration/gap 9 and photo tools 44. The server suite's shared database-row check remains skipped without `E2E_DATABASE_URL`. This exercises the existing routes and media exports after adding the photo pages. The separate Firefox photo run also exits 0 with 44/44; it does not certify Safari or Edge photo behaviour.

Screenshots/media/logs are in ignored `output/launch-photos/`, `output/launch-photos-firefox/` and `output/launch-photo-*.log`. A mobile screenshot was visually inspected as well as checked for horizontal overflow. Installed Chrome was 156.0.8078.48; the Firefox test binary was 155.0.

## Manual verification still required

1. Real iPhone/iPad Safari and Android devices: large phone photos close to the limits, portrait EXIF, camera colour profiles, orientation, memory pressure, cancellation and background/tab interruption. Desktop browser emulation is not a real-phone result.
2. Safari and Edge image encoding/decoding and download UX; unsupported WebP must explain recovery. Synthetic fallback checks do not certify every older browser.
3. Keyboard and screen-reader review, high zoom, dark mode and touch drag/drop/file-picker behaviour. Automated viewport/label checks are partial accessibility coverage.
4. Deploy with the actual `SITE_URL`; inspect canonical hosts, sitemap entries, crawlable HTML, privacy text and navigation through the real CDN. Confirm no image requests leave the device in browser developer tools.

# Reel Finisher: code analysis report (7 Nov 2026)

Branch `redesign/site-and-tool-workspace`, last commit `9443cb2`. This report covers the working tree as it is
now, including uncommitted work.

## 1. Summary

The product is a local-first media toolkit on Next.js 16. It has a public site, 28 tool pages, a Command Center,
and the Reel Studio editor (vendored OpenReel). The tool engines are solid. They run in workers, can be
cancelled, re-read their output before download, and are honest about their limits ("DSP, not AI separation",
"no cloud fallback"). Unit tests pass.

The main risks are about process, not code:

1. **A large amount of work is not committed.** There are 43 modified tracked files and about 300 untracked files
   on top of `9443cb2`, from several sessions. That includes every new tool route, the local-AI stack, the
   Command Center and the Shorts Maker handoff.
2. **The Studio was modified.** Four files under `vendor/openreel` were changed or added for the Shorts Maker →
   Studio handoff, which goes against the "do not modify the Studio" rule.
3. **The release is NO-GO.** `docs/production-readiness-report.md` says so: there is no deploy target,
   `SITE_URL` is unset, and the 244 MB model decoder has not been certified on any real host.

## 2. Architecture

| Layer | Where | Notes |
|---|---|---|
| Public site | `src/app/page.tsx`, `tools/page.tsx`, `privacy`, `supported-formats`, `components/site/*` | Dark sidebar shell, ToolFinder (`?q=`, `?category=`), category illustrations |
| Tool pages | `src/app/tools/*` (28 routes), `components/tools/ToolPageLayout.tsx`, `tools/surface/ToolSurface.*` | Shared staged workspace: upload → configure → process → result |
| Photo engines | `src/lib/images/*` | Canvas encode, passport crop, HEIC worker (libheif), background removal worker (ORT + U²-Net-p) |
| Video/audio engines | `src/lib/mediatools/*`, `src/lib/videos/*` | Mediabunny Conversion: trim, mute, MP4, audio, GIF (gifenc), audio→video |
| Local AI | `src/lib/localtools/*`, `tools/local-ai/*` | Whisper-tiny (transcribe, translate to English, Shorts moments, lecture notes), SpeechT5 TTS, RNNoise, PDF.js text, Chrome Translator API |
| Model delivery | `src/app/local-models/[...asset]`, `src/app/editor-models/[...asset]`, `lib/localtools/modelDelivery.ts` | Same-origin proxy of allowlisted public weights pinned to fixed revisions; no media or text crosses it |
| Command Center | `src/app/command-center`, `components/command-center/*`, `lib/command-center/*` | Workspace and command palette |
| Studio | `src/app/studio`, `vendor/openreel`, `public/editor` (75 MB built) | Editor; Auto Subtitles can use `/api/transcribe` (Groq/Sarvam) with disclosure |
| Server | `src/app/api/transcribe`, `api/edit-plan` | Provider keys in server env only; rate limit (Postgres optional), Turnstile |

## 3. Tool inventory

The catalog (`src/lib/tools/catalog.ts`) lists **31 entries, all `available`**. Nothing is `planned` any more,
so the sidebar's "planned" UI now has nothing to show.

- **Photo (6):** Compressor, Converter, Resizer, HEIC to JPG, Background Remover (AI, local), Passport Photo.
- **Video (11):** Compressor, Compress to Size, Trim, Convert to MP4, Remove Audio, Video to GIF, Text to Video,
  Image to Video, Shorts Maker, Reel Studio.
- **Audio (11):** Converter, Extract, Cutter, Increase Volume, Audio to Video, Text to Speech, PDF to Audio,
  Noise Remover, Remove Music, Vocal Remover.
- **AI (6):** Transcribe, Video Translator, AI Dubbing, Lecture to Notes, plus Auto Subtitles and Auto Editing.
  The last two link to `/studio`.

The labels are honest. Remove Music and Vocal Remover say they are centre/side stereo DSP. Translator says it has
"no cloud fallback". Dubbing says "generic voice; no voice cloning or lip sync". Image/Text to Video say "no
generated footage". This matches the "no fake AI" rule.

## 4. Privacy and security

**Good:**
- Media never reaches our server except through the Studio's disclosed transcription route. The only `fetch`
  calls in `src` are model downloads, a sample file, `/api/transcribe` and `/api/edit-plan`.
- The model proxies allowlist exact org/model pairs and filename patterns. `local-models` rewrites `main` to a
  pinned commit SHA. `HEAD` is explicit, so it doesn't open a weight stream. There are idle timeouts, and client
  aborts propagate upstream.
- The Shorts handoff stores the original video in IndexedDB only. It uses a UUID id, a 24 h expiry, a size cap
  and a fingerprint check. The Studio listens for messages from the same origin and from its parent window only.
- Translation uses the browser's on-device Translator API and refuses to fall back to the cloud.

**Concerns:**
1. **The model proxies have no rate limit.** Anyone can use `/local-models/*` and `/editor-models/*` as a
   bandwidth relay for about 250 MB of allowlisted weights. On a metered host that is a cost-abuse vector.
   Options: CDN caching in front, a per-IP limit, or serving the weights from object storage instead of a function.
2. **`/editor-models` still follows upstream `main`.** It does not pin a revision on `media.openreel.video`, so a
   change upstream changes what users run. `/local-models` already pins revisions; do the same here.
3. **Serverless limits are unproven** for streaming a 244 MB decoder (timeouts, payload size). The readiness
   report flags this; `scripts/audit-release-host.mjs` exists but has never run against a real origin.
4. **One sidebar claim is too broad.** The footer says "Nothing is uploaded", but the same nav links to the
   Studio, whose Auto Subtitles can upload compressed speech audio. It is qualified by "Local tools…", but worth
   tightening.

## 5. Studio scope violation

Files changed or added under `vendor/openreel/apps/web/src/`:

- `App.tsx` skips project recovery and new-project creation when the editor was opened from Shorts Maker
  (`?creator=<uuid>` on the parent page).
- `hooks/useProjectRecovery.ts` adds a `prompt` flag.
- `main.tsx` adds a `reelfinisher:open-creator` message handler that lazy-imports the creator import.
- `reelfinisher/creator-import.ts` is new.

The changes are small, guarded and look correct. **Resolved 2026-11-07:** the user approved keeping them. The
exception and its file list are recorded in `DECISIONS.md` ("Studio patch for the Shorts Maker handoff").

## 6. Dependencies and licences

| Dependency | Licence | Note |
|---|---|---|
| mediabunny 1.62 | MPL-2.0 | Core engine |
| libheif-js 1.23.5 | **LGPL-3.0** | Needs a release review (relinking/notice obligations) before launch |
| onnxruntime-web 1.30 (`tools/ort`) | MIT | Isolated install so the editor's type-check is unaffected |
| SpeechT5 / HiFi-GAN, CMU ARCTIC x-vector | MIT / BSD-style | Notices in `tools/local-ai/` |
| RNNoise 0.2.1 (`tools/neural-audio`) | BSD | |
| PDF.js 6.5 (`tools/pdf`) | Apache-2.0 | |
| gifenc 1.0.3, lucide-react | MIT / ISC | |
| Stageshow 1.1.1 (vendored, `vendor/stageshow`) | MIT | Used for the static workflow illustrations |
| **gsap 3.15.1** | GSAP standard licence | **Not imported anywhere in `src`, `scripts` or `vendor/stageshow`.** Remove it, or document why it is there |

`postinstall` now runs three nested `npm ci` installs (`tools/ort`, `tools/neural-audio`, `tools/pdf`). That works,
but it slows installs and fails offline. Make sure CI caches these folders.

## 7. Code quality

- **Readability regressed in the local-AI files.** 107 lines across `src/lib/localtools/*` and
  `src/components/media/*` are over 300 characters, written minified with no spaces. Examples are
  `local-models/[...asset]/route.ts` and `translate.ts`. They pass lint, but review and debugging are much harder
  than in the older engines. A Prettier pass (on these folders only) would fix it mechanically.
- The shared `ToolSurface` / `ToolPageLayout` reuse works well. New tools mostly compose existing parts.
- `ToolPageLayout` has an empty `ai: []` feature list. AI pages show no feature band unless each one passes its
  own list. That is fine, but it is a silent gap.
- The `PlannedItem` / `PlannedTools` code is dead while nothing in the catalog is planned. It is harmless; keep it
  only if more tools will be planned later.

## 8. Tests and verification

| Check | Result (this run) |
|---|---|
| `npm run check`: Vitest (site) | **46 files passed, 1 skipped; 366 tests passed, 6 skipped** |
| `npm run check`: editor Vitest | 15 files, 188 passed, 4 skipped (export-runner) |
| ESLint, `tsc` (site) | Passed |
| E2E (`npm run e2e`, now including `e2e:local`, `e2e:models`) | **Not run in this pass.** It needs a fresh build and ffmpeg. Earlier full regression: 17 suites, 603/603 checks, before the local-AI tools landed |
| `TASKS.md` | 28 Tested, 3 In progress, only 1 item Verified on a real device |

The new local-AI tools (Whisper, SpeechT5, RNNoise, PDF) have E2E suites (`localtools`, `creator`, `notes`,
`pdf-audio`, `local-model-cache`). Their pass/fail is recorded in the readiness report's ledger, not in this run.

## 9. Repository hygiene

- `output/` is 1.1 GB on disk. Most of it is ignored, but **80 files under `output/` (`output/site/*.png`
  screenshots, `output/skill-review/`) are untracked and not ignored**, so a `git add .` would commit them.
  Ignore `/output/` as a whole.
- `.impeccable/` and `.taste-skill/` (skill working folders) are untracked. Decide whether they are tooling to
  commit or scratch to ignore.
- There are 15 new docs (redesign reviews, audits, reports), several of them overlapping. Consider merging them
  into `DECISIONS.md` and `TASKS.md` and archiving the rest.
- `public/models/u2netp` (4.4 MB) is committed as a binary. That is fine at this size; larger weights correctly go
  through the proxy.

## 10. Recommendations (in priority order)

1. **Commit the work now**, in a few logical commits: site/redesign, photo tools, media tools, local-AI + model
   delivery, Command Center, Shorts handoff. Ignore `/output/` first.
2. ~~Decide on the Studio patch~~ Done: approved and recorded in `DECISIONS.md`.
3. **Choose a deploy target**, set `SITE_URL`, and run `scripts/audit-release-host.mjs` against it. Put a CDN or
   object storage in front of the model weights and rate-limit the proxies.
4. **Pin the `/editor-models` revision.**
5. **Run the full E2E suite** on a fresh build. Then test on a real device: at least one Android phone and one
   iPhone for HEIC, background removal, TTS and Whisper memory.
6. **Do the LGPL review for libheif.** Remove `gsap` if it is unused.
7. **Reformat the minified local-AI files.**

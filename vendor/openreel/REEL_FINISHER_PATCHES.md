# Reel Finisher fork

Upstream: Augani/openreel-video, commit `367d7e90b61b5181f9861b852bb8b9d7a7d2954a`.
The upstream MIT license is retained in `LICENSE`. This is a source workspace, not an npm editor dependency.

## Host and build

- Vite base `/editor/`; separate React/Tailwind providers, hosted by the Next.js `/studio` iframe.
- Root npm scripts run the pinned pnpm 11.7.0 workspace through Corepack; generated files go in `public/editor`.
- Service worker owns only `/editor/` and `rf-editor-*` caches. A separate `/studio` navigation fallback opens the cached iframe offline.
- Build-generated precache manifest includes JS, WASM, fonts and public UI assets. COOP/COEP/CORP and an editor-only CSP are configured by Next.js.

## Local-only runtime

- Removed cloud chat, generated-asset polling, generation tab, remote sharing page and service/API configuration from the browser interface.
- Disabled analytics initialization; production compilation drops console calls, including worker logs.
- A fetch/XHR/beacon/socket guard refuses uploads and external processing. Browser requests stay on the same origin. The fixed `/editor-models/` GET route delivers only allowlisted public model assets, avoiding the upstream host's missing CORS headers. CSP independently restricts browser resource loads.
- Removed `@ffmpeg/*` dependencies and executable FFmpeg fallback loading. Codec paths that require FFmpeg report unsupported operation errors. Build output is scanned for forbidden runtime artifacts.
- Google font stylesheet injection is removed. Reel Finisher's local fonts and uploaded faces load before export. Native subtitle presets use bundled families.

## Captions, migration and synchronized edits

- `apps/web/src/reelfinisher` contains the local tools, migration converter and versioned caption extension.
- Core `TitleEngine` has a required host renderer for Reel Finisher caption metadata; preview and export share the existing Reel Finisher canvas renderer.
- Native project state/history owns edits. `project/applyEditSnapshot` commits complex operations and their inverse in one native action.
- Manual captions, per-caption appearance, animations, local fonts, brand presets and SRT remain available. Segment/manual timings are marked estimated; karaoke requires verified word timings matching the current text.
- Legacy migration reads the existing database, validates its media fingerprint and creates a separate UUID and media copy in OpenReel storage. Missing fonts and unsupported trailing gaps are reported before commit.
- Gap closing, ripple deletion and silence review remove output ranges across media, captions, overlays, markers and keyframes. Locked affected tracks reject the whole operation. Multiple selected ranges commit once. Ordinary media deletion and text deletion remain independent.
- Native caption splitting/trimming slices word timings rather than stretching them.

## Explicit limits

- Synchronized removal across transitions at a cut, speed ramps/freeze frames, eased keyframes, nested/motion instances, masks, adjustment layers or multicam is rejected with a recovery message. This avoids partially shifting unsupported data.
- Legacy trailing empty gaps must be closed in the legacy editor before migration. Legacy records remain recoverable.
- Whisper returns segment timestamps. No automatic Roman Hinglish conversion or general AI chat ships.
- Browser codec, GPU, memory, storage and model-host availability still determine device support. Real mobile hardware is a separate validation gate.

## Updating upstream

Keep `UPSTREAM.json` pinned. Compare a new upstream revision in a separate checkout, port changes deliberately, retain this patch inventory and license, then run root checks, build, editor E2E, legacy E2E and real-device gates before replacing the pin.

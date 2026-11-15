# Stageshow public UI refinement

Date: 2026-11-05. This is a visual refinement of the approved Finishing Bench
direction, not a new product, tool implementation, or release certification.

## Delivered

- Homepage: four illustrated workflow destinations replace the plain category
  buttons. The actual local compression bench remains live and unchanged.
- Directory: compact category imagery and more consistent list spacing.
- Public tool pages: a shared workspace/instructions/category navigation row,
  stronger section hierarchy, and a more spacious shared file-picker surface.
- Shared shell: consistent search height, current-route icon treatment, selection
  color, reading-page rhythm and an All tools footer link.
- Mobile: separate 358px illustration compositions, stacked discovery cards,
  wrapping page navigation and existing accessible navigation drawer.

All existing routes, metadata, origin configuration, local processing, download
controls, model consent and limits remain in place. No processing engine or
Studio source is changed by this task. `/studio`, `/studio-legacy` and `/lab`
retain their independent interfaces. They are regression-tested, not visually
redesigned in this pass.

## Implementation and delivery cost

Public components changed: `src/app/page.tsx`,
`src/components/site/WorkflowShowcase.tsx`, `ToolDirectory.tsx`, `SiteShell.tsx`,
`public-site.css`, `src/components/tools/ToolPageLayout.tsx` and
`surface/ToolSurface.module.css`. `tests/e2e/redesign.e2e.mjs` adds actual image
decoding, responsive-source and instruction/workspace navigation checks.
`tests/e2e/site.e2e.mjs` waits for the asynchronously allocated blob preview and
decodes both images before asserting their presence; the earlier immediate check
could race React's effect. The assertion still checks the actual thumbnail,
original preview and source dimensions.
`scripts/prepare-media-notices.mjs` exposes the illustration attribution through
the existing notices page. DESIGN.md documents the illustration role.

No npm dependency, product route, paid service, account requirement or runtime
Stageshow bundle is added. The workshop source under `vendor/stageshow` uses the
existing React/Vite/Playwright toolchain only to generate static assets. The kit
is reduced to its 20 reachable source files; unused brand art is excluded.
MIT license and notices are preserved. Eight WebP files total **457,524 bytes**
on disk; a visitor selects the four appropriate variants, lazy-loaded below the
main bench. That total is an asset measurement, not a measured network budget.

## Visual evidence

Before: `output/stageshow-before.png`. Final fully loaded production captures:
`output/redesign/stageshow-home-1440.png` and `output/redesign/stageshow-home-390.png`.
Representative directory, workspace and privacy captures are also in `output/`.
All capture paths are local QA artifacts, not production device evidence.

The Stageshow `static-card` gold was rendered before adapting the compositions.
All eight final desktop/compact still checks report no issues and rehearsal
passed. An independent reviewer caught cropped video/audio controls and excessive
video-image prominence; revised stills were reviewed and those findings were
confirmed resolved. See `vendor/stageshow/REHEARSAL.md` for exact limits.

Impeccable source detector: **0 non-advisory findings, 40 advisories**, principally
literal type/radius values against the existing abbreviated design-token ramp.
Taste reports **2 FAIL / 6 WARN** on the homepage and **1 FAIL / 3 WARN** on the
workspace. These are not presented as clean passes. Its flags include inherited
tool-list icon structure, minimal motion, the existing local Mukta/system font
instead of its older dealt Switzer sheet, warm foreground, sticky header rules
and control borders. The approved identity and accessible controls are retained;
decorative video/autoplay and external font downloads were not added to satisfy
those heuristics. The design sidecar was already stale before this task and
remains unrefreshed; DESIGN.md and actual source are the visual authority.

## Verification

- `npm run check`: passed. Root 366, editor web 188 and core 64 tests passed;
  10 existing skips. Root lint and TypeScript checks passed.
- `npm run build`: passed, including the existing OpenReel build.
- Separate illustration workshop production build: passed, 55 transformed modules;
  this output is not loaded by the public site.
- Separate strict TypeScript check of the illustration source and its imported kit:
  passed (`tsc --noEmit --strict`, ES2022, React JSX, bundler resolution).
- Production browser coverage: **796/796 checks across 22 suites**, assembled
  from serial runs against the completed build: first 16 suites **458/458**,
  corrected `npm run e2e:site` **249/249** (158 public shell + 91 redesign), and
  `npm run e2e:local` **89/89**. The full `npm run e2e` command itself stopped
  at the test timing issue described below; it is not claimed as an uninterrupted
  green run. No app code changed between that run and the targeted reruns.
- Final standalone root lint and typecheck: passed. The final lint run includes
  the preview-test synchronization correction, with zero warnings.
- The redesigned route suite checks all 33 public pages at 1440, 1280, 1024,
  768, 390 and 360px. It validates image decoding and desktop/mobile image
  selection, mobile anchor clearance, no speculative editor/model requests,
  real JPEG/PNG/WebP downloads, cancellation and retry. These are browser
  viewport checks, not physical-device certification.

The first sandboxed check reached and passed root tests but could not fetch the
existing editor's declared pnpm version. The full command was rerun with the
required network access and passed; no package versions were edited.

One workshop build initially copied public assets into its QA output directory,
which caused a later root typecheck to inspect copied dependency sources. Only
that generated directory was removed; workshop public copying is now disabled.
The subsequent root typecheck passed. The first browser-suite run was interrupted
when a final rebuild replaced its server assets; it is superseded by a serial run
against the completed build, not counted as a successful full run.

That completed-build run passed all first 16 suites, then stopped at the public
site suite (157/158) on its premature blob-preview assertion. The test now waits
for the actual images and decodes them. The public-site suites and remaining local
suites are rerun separately against the same build; the earlier full command is
not represented as an uninterrupted pass.

## Remaining limits

Browser viewport automation is not physical Android/iOS testing. Human
screen-reader evaluation, real production hosting, field performance and existing
AI speech/noise-quality release gates remain outside this UI pass. Static stills
have no motion to certify. The previous production release NO-GO is unchanged.

# Reel Finisher 2.0 implementation plan

> Status 2026-11-08: implemented and tested; see `docs/reel-finisher-premium-redesign.md` for what shipped and `docs/command-center-library-research.md` for the library review.

2026-11-06. User-confirmed direction: **command-led workstation**, retaining the
live compression demonstration. Explicit black/blue/orange brand supersedes the
November 5 amber-only appearance. Product truth and engines remain authoritative.

## Existing design audit

Next 16.4.3 App Router, React 19.3, Tailwind 4. Root public tokens are scoped to
`.site` in `public-site.css`; Studio has independent styling. Existing primitives
are native shadcn-style components, not a complete Radix/shadcn installation.
No GSAP dependency or blog route exists. The actual catalog holds 32 available
entries across 29 standalone tools and Studio destinations. No fake blog or
analytics surface will be added.

The FinishingBench performs real worker-backed image conversion; WorkflowShowcase
ships labelled Stageshow stills. ToolSurface owns working upload/preview/settings/
result composition. ToolPageLayout owns instructions, FAQ and related links.
Sidebar already handles collapse persistence and an accessible mobile dialog.
These functions should survive, while the public visual world is replaced.

## Reuse and routes

Reuse catalog, media workers, all current tool forms and actual result handling,
accessible dialogs, fonts, icons, image comparisons, limits and consent gates.
Redesign `/`, `/tools`, all 29 standalone tool routes, `/privacy` and
`/supported-formats`; add functional `/command-center` (private local preferences,
noindex). `/studio`, `/studio-legacy`, `/lab`, their source and OpenReel remain
excluded. Preserve the model asset routes and caches.

## Design system and creative exploration

Single runtime token authority remains `.site`. Black layered surfaces, electric
blue navigation/selection/focus, readable orange main actions; explicit semantic
success/warning/error. Locally bundled display type plus native readable control
type; fluid headline, precise tabular metadata. Keep Stageshow attribution and
illustrations as honest workflow examples rather than measured results.

Subject inventory: free exports without watermark, ten-minute limit, local
compression, source/output comparisons, word captions, downloadable SRT, browser
Whisper consent, English SpeechT5 consent, RNNoise fallback, PDF embedded text,
local originals and the separate timeline editor. Page argument: try real work,
find the next operation, pin a useful tool, understand local models, keep files
private, review and download.

Grounded systems considered: creative workstation, contact sheet, edit-decision
list, command-led launchpad, export queue, caption proof sheet, field recorder.
The user selected the command-led workstation; that commitment constrains the
skill deal. Taste dealt product-performs, sentence-as-layout and one-motif.
Product-performs carries the actual compression bench and was selected. The
Impeccable seed was rerun with its documented network access; its assignment does
not override the user's explicit chosen system. Architecture atmosphere and
fictional charts are unsuitable to the actual product material and are omitted.

## Component libraries

Inspect Skiper, Vengence, Watermelon, Bencho and GSAP from primary sources.
Document exact adoption/licensing in `command-center-library-research.md`.
No paid source copying. Existing native controls remain foundational; do not add
multiple overlapping UI frameworks. Add GSAP only for homepage interface
choreography, dynamically imported and cleaned up; never use it in Studio or
user-authored/exported animation.

## Command Center

Catalog-driven quick actions, text/category search, native-dialog command palette
with Ctrl/Cmd+K, keyboard selection, Escape, focus return and real route launch.
Local versioned allowlisted favorites and tool-visit history (route metadata only),
clear history, disable recording and clear favorites. Recover gracefully when
storage is unavailable. No file names, transcripts, processing-job tracking or
invented counts. Export one RouteActivity observer for public tool navigation.

## Animation

One homepage sequence orchestrates the title and real bench; visible by default,
reduced-motion aware, no fake processing progress. Selected/hover/press and native
dialog transitions use CSS. GSAP stays off ordinary tool pages. Live controls,
workers and results retain their own state and cancellation semantics.

## Validation

Before and after browser captures at 1440/1280/1024/768/390/360. Functional palette,
favorites/reload/cross-tab/blocked-storage and route-history checks; no requests
containing media or transcripts. Source and rendered detectors, fresh-eye review,
contrast/focus/mobile/empty/error states. `npm run check`, production build, full
existing browser suites and new command-center suite. Serial heavy suites and no
concurrent production rebuilds. Record failures honestly and exact reruns. No
physical-device or production-hosting claim from localhost tests.

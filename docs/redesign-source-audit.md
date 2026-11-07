# Public redesign source audit

2026-11-04. Read-only independent review of the implemented Option A direction. Reviewed FinishingBench, public-site.css, shared ToolSurface source/CSS, ToolPageLayout, SiteShell, Sidebar, image client/engine and blob URL ownership. No application files changed. No browsers or processing tasks run. This is source evidence; production rendering, keyboard behavior and cancellation timing still require the parent's pending verification.

## Outcome

No blocking functional regression found in the scoped source. The bench performs a real explicitly requested local conversion, suppresses cancelled results and cleans up its worker and blob URL resources. Public palette boundaries and file-picker focus treatment improve on the previous source. Two small accessibility/recovery issues remain below.

## Findings

- **P2 — Network/module failures can expose a raw message without a specific recovery instruction.** `FinishingBench.tsx` catch displays any `Error.message` verbatim. Its explicit non-OK HTTP branch explains recovery, but failed fetches and dynamic-import failures commonly produce browser/runtime messages instead. The generic recovery sentence is only used for non-Error throws. Append a consistent user-facing recovery action for these failures (retry the sample or open Image Compressor). The persistent own-image link provides a workaround, so this does not block normal conversion.
- **P2 — Bench quality accessibility value does not match the displayed percentage.** The range has a clear accessible name and keyboard behavior, but its native min/max/value are 0.1/1/0.8 while the visible output says 80%. Add `aria-valuetext` with the displayed percentage to ensure a screen reader receives the same unit. The disabled PNG state is visibly labeled Lossless and correctly prevents irrelevant adjustment.

## Cancellation, races and cleanup

- A new operation aborts the previous controller. Cancellation aborts fetch/worker and clears busy state. Controller identity gates `finally`, so a stale operation cannot clear a newer operation's busy state.
- Async import is followed by fetch with the operation signal or `runImageTask`, whose entry checks an already-aborted signal. Cancelling during import therefore prevents later processing. After inspect and process, explicit aborted checks prevent stale measured output/status publication.
- Unmount aborts the current controller. `runImageTask` terminates its worker on message, error or abort and removes the abort listener. Fallback image processing checks cancellation and closes decoded images and canvas resources in `finally`.
- `useBlobUrl` allocates only after commit, revokes on replacement/unmount, and returns an empty value immediately when its tracked blob differs. Result invalidation removes stale preview/download links even before effect cleanup.
- Settings are disabled while busy and invalidate the result when changed. Format captured by the operation remains consistent with its eventual download extension. PNG bypasses quality in the engine. The source sample is retained only for the mounted component and is not a user upload.
- The sample's original size and output size are actual File/Blob sizes. Status describes phases without fabricated percentages. Output can honestly be reported as larger than the source.

## Models, uploads and isolation

- The initial bench render requests a same-origin generated preview image. The source JPEG is fetched only after Compress sample. Dynamic image client import and worker work occur in the click handler; no model or AI dependency is invoked by this path.
- Inspected image client/engine use local canvas and workers. No upload/API POST or external model URL appears in this path. This conclusion is limited to the reviewed bench dependency path, not a new audit of every existing AI tool.
- Public stylesheet is imported from SiteShell and its selectors are rooted in `.site`; keyframes do not affect an element unless assigned. Scoped variables leave root Studio tokens intact. A source search found no SiteShell, `.site` frame or ToolSurface imports in Studio, Studio Legacy, Lab or editor components. ToolSurface's module classes are hashed and used by the standalone tools and bench. No visual leakage into the excluded editors is evident in these sources; navigation/render checks remain the final evidence.
- ToolPageLayout wraps the existing processing children without replacing their engines, cancellation handlers, route paths or result controls.

## Accessibility and responsive source checks

- Updated strong edge #77746d is 3.16:1 against field #282828 and 3.49:1 against raised #202020. Supporting text #b9b7b1 against canvas #171717 is 8.94:1; faint text #aaa8a2 against raised is 6.85:1. These are calculations from declared opaque tokens, not computed rendered audits of every state.
- Initial and replacement file picker wrappers now expose focus-within outlines. Native radio/range/select controls, comparison range labels, result focus and live status remain present. Reduced motion now explicitly stops animations, including spinner motion.
- Main bench actions are at least 46px; selects are 44px. The bench slider is 28px high, shared segmented controls 38px, presets 40px and desktop navigation 40px: below the desired 44px comfort target, but not automatically WCAG target-size failures.
- Bench stacks below 768px; shared tool workspace stacks at 1100px and wraps file actions below 560px. The 224px desktop sidebar changes available content width: inspect 1024/1101/1280 breakpoints and loaded previews in production screenshots. Source structure alone cannot prove no clipping or overlap.
- Global `.site :is(button,a,input,select,textarea,summary):focus-visible` provides a strong focus outline. Comparison and hidden inputs have additional parent/handle treatment, preserving visible focus when inputs themselves are transparent or clipped.

## Actual source detector follow-up

The parent subsequently obtained the pinned engine with SHA256 verification. Reviewed actual `output/redesign-impeccable-source.log`: **exit 0, zero primary findings, 53 advisories** (33 font-size, 13 color, 7 radius). This replaces the earlier unavailable-engine limitation for this source scan only; it is not a rendered detector pass or a claim of zero advisories.

| Advisory context | Classification |
| --- | --- |
| FinishingBench `#ffffff` | Image processing background passed to the JPEG encoder, not a public interface color. Preserve output semantics. |
| Sidebar `0.65rem` | Desktop aside rule overrides to 0.8125rem. The mobile dialog has no aside ancestor, so its badge/planned-label sizes retain 0.65rem in the reviewed source. This conditional small-text drift merits a mobile-specific correction or explicit decision. |
| public-site.css selector text `text-[0.65rem]` | Detector matches the class fragment inside an attribute selector; this declaration actually sets 0.8125rem, not 0.65rem. |
| ToolPageLayout h1 `2rem`/`2.5rem` | Literal utility declarations are superseded by the more specific `.site .tool-header h1` fluid rule. The fluid endpoints themselves are genuine differences from the four documented typography roles. |
| Source `.sideFoot` 16px radius and `.chips button` 999px radius | Existing earlier declarations are superseded by later 12px footer corners and 6px chips; not final computed token drift. |
| Source `.download` `#06261a` | Superseded by later `color:var(--accent-ink)` on the same module class. |
| White comparison handle/shadows, translucent black preview labels/processing scrim, black video stage | Active functional media chrome; not processing colors or dead code. Legitimate contrast treatments over arbitrary media, but undocumented extensions to DESIGN.md rather than exact palette conformance. |
| `#a1a1aa` badge secondary text and `rgb(11 12 14 / .25)` primary spinner border | Active legacy literal values within media/control states; minor actual palette drift to reconcile or document. The new palette is not literally applied to every state. |
| 8px thumbnail, 4px segmented-label corners, 999px media badge/progress radius | Active conditional UI shapes beyond documented 6/12px scale. Functional exceptions or small design-system documentation debt, not proof of broken layout. |
| 0.8125rem metadata/captions, 1.125rem bench heading, 1.25rem upload title, .95rem controls/prose, responsive heading endpoints | Mostly active additional type steps, including pre-existing shared tool styles. They should be consolidated or documented if intentional. A source declaration cannot establish visibility or computed size at every viewport/state. |

The source scan does not resolve cascade, rendered state, arbitrary-media contrast or layout overlap. Advisories contain repeated occurrences and some superseded declarations; count is not equivalent to 53 visible defects. Conversely, it would be inaccurate to dismiss all 53 as false positives: active type and media-chrome exceptions exist.

Both original bench findings are now fixed in reviewed source: error messages append explicit recovery options and the quality slider supplies percentage `aria-valuetext`. The parent reports a separate reviewer found stacked-workspace sticky-footer overlap; the reviewed stylesheet now sets `.sideFoot { position:static; }` through 1100px. That fix is source-confirmed only here. Production rebuild and its recovery assertion rerun were still pending at this follow-up. The parent's reported 33-route/six-width browser evidence is separate and was not independently run or inspected by this assessor.

## Required remaining evidence

Production screenshot/reflow checks at the requested widths; keyboard menu/file-picker/result flow; a real bench conversion with measured downloadable output; cancellation during loading/encoding followed by another operation; navigation away during processing; and excluded-editor regression smoke checks. This audit does not replace the project's required check/build/E2E gates and does not change release certification status.

# Before redesign: independent evidence assessment B

Date: 2026-11-04. Scope: public homepage and shared SiteShell, Sidebar, ToolPageLayout, ToolSurface and its stylesheet. Product context read from PRODUCT.md; method read from Impeccable critique reference. This assessment did not consume assessment A.

## Provenance and limits

Reviewed `.taste-skill/before/report.json`, `output/redesign-before.log`, desktop and mobile fold screenshots, and current source. The stored TasteSkill run covers 1440×900, 768 and 390 pixel viewports of `/`, timestamped 2026-11-04T17:40:12.430Z. This is existing browser evidence, not a fresh independent browser run and not an Impeccable detector result. The parent reports the actual Impeccable engine attempt stalled/failed during download; this assessment did not repeat the download. No injected overlay is claimed. No network access, app edits, server changes or processing tests were performed.

1280, 1024, 360, zoom, keyboard interaction, live dialog behavior, screen-reader output and loaded-file tool surfaces remain unverified here. Source observations about those surfaces are identified below rather than presented as measured browser failures. This is partial assessment B evidence, not a completed full Impeccable critique certification.

## Confirmed useful measurements

| Homepage width | Page height | Horizontal overflow | Body size | Body contrast | Console errors |
| --- | --- | --- | --- | --- | --- |
| 1440 | 4611px | 0 | 14px | 7.6:1 | none reported |
| 768 | 5496px | 0 | 14px | 7.6:1 | none reported |
| 390 | 7892px | 0 | 14px | 7.6:1 | none reported |

The stored report has no low-contrast samples or broken images. This homepage sample cannot establish accessibility or correctness across all routes or states.

## Priority findings grounded in evidence

1. **P1 — Desktop task entry is pushed to the bottom of the first screen.** The 1440 fold shows a largely empty upper-left main region; the h1 starts around y=596 and primary actions reach the bottom edge. `src/app/page.tsx:18` vertically centers the left content against an unbounded list of every utility tool on the right (`utilityTools.map`, line 32). The reported hero section is 1554px high. This is a concrete composition/first-action discovery problem; fixing headline length alone will not fix it. Make the initial task choices bounded and align the principal introduction near the top.

2. **P2 — The same large catalogue is presented repeatedly.** Persistent desktop navigation, the complete “Start with a tool” list and the directory all compete for task selection. The mobile page is 7892px tall and the start list begins within its first screen; the later directory is far below. The mobile screenshot does preserve a clear heading and two large CTAs, so it is incorrect to call mobile entry unusable. Reduce repeated initial choices and retain a searchable comprehensive directory.

3. **P2 — Important supporting text is unnecessarily small.** Stored measurements find 15 blocks below 13px on desktop, 13 on tablet/mobile. Sidebar category labels use `text-xs`, badges and planned status use 0.65rem, and workspace result terms use 0.72rem (`ToolSurface.module.css`). 14px is not itself a WCAG violation, and the homepage lead is actually 18px. The practical problem is small limitation/status/metadata text rather than every paragraph needing blanket enlargement.

4. **P2 — Some workspace controls depend on a faint boundary.** Source palette calculations: `--edge-strong #37383f` against `--field #1b1c20` is 1.46:1; against `--raised #141518` it is 1.56:1. Inputs styled by `.field` and segmented radio containers use these boundaries. Where the outline is needed to identify the control, it does not reach the 3:1 non-text contrast target. This is a source-derived risk to verify in the rendered loaded-file state, not evidence of a homepage text contrast failure. Text colors are substantially stronger: subtle/canvas 7.64:1, faint/raised 5.41:1, download label/brand 8.40:1.

5. **P2 — Replacement file picker focus needs a visible parent treatment.** `ToolSurface.tsx:47` hides the keyboard-focusable file input with `sr-only`. The initial `.browse` wrapper has `:focus-within`, while the default `.secondary` picker wrapper lacks equivalent styling. A global input focus outline on a clipped input may be visually lost. Add a visible wrapper focus state and verify keyboard file replacement after loading a file. Initial upload has the stronger existing wrapper treatment.

## Responsive and accessibility strengths to preserve

- SiteShell has a skip link and focus target, minimum-zero-width content track, and a mobile header below the desktop breakpoint.
- Sidebar links have accessible names even in the collapsed rail, current-page semantics, searchable tool names, and explicit planned states. Mobile navigation uses a native modal dialog with a labeled close button and close-on-navigation behavior. These are sound source patterns; actual focus return and Escape behavior still need browser validation.
- ToolSurface keeps native file, radio, range and select controls; fields have labels, processing has live status, progress uses native progress, results receive focus, and comparison supports a native range input.
- Workspace grid stacks at 1100px; file actions wrap and image pairs stack at 560px. The page itself has no measured horizontal overflow at sampled widths. The 1100px stacking cutoff is viewport based despite the 256px desktop sidebar, so verify preview/control proportions around 1101–1280 rather than assuming a good layout from the homepage samples.
- Primary actions and input fields are 44–48px high. Sidebar links (40px), segmented labels (38px), preset chips (34px) and secondary actions (40px) miss the product's desirable 44px target, but are not automatically WCAG 2.2 target-size failures (24px minimum and spacing exceptions exist).
- Global reduced-motion CSS suppresses duration to 0.01ms; the spinner retains infinite repetition. Verify and preferably stop decorative rotation under reduced motion; shrinking duration alone can create a very rapid cycle. This is a source concern, not a captured animation failure.

## Interpreting the TasteSkill findings

The stored run reports 10 FAIL and 3 WARN. These are the tool's design rules, not thirteen independently established usability or accessibility defects.

| Detector category | Evidence interpretation |
| --- | --- |
| headline-lines | Three lines at desktop/mobile are real; a two-line maximum is a taste rule. The desktop vertical placement is more consequential. |
| hairline / outlined-box | Eight rules and 33 outlines describe visual repetition. Outlines on inputs, tables and navigation are functional; do not delete all borders indiscriminately. |
| body-size / small-text / size-count | Useful readability and scale consistency signals. Separate 10–12px status text from the 18px homepage lead; no minimum CSS font size is mandated by WCAG. |
| few-pictures / no-footage | This product handles user media locally. No decorative pictures or autoplay footage is defensible. An honest labeled sample/demo can add product specificity without implying actual user output. |
| focal-point | Supported directionally by the blank upper desktop region; the fixed 8.4vw comparison is not a requirement. |
| off-centre | Global margins include the intentional 256px desktop navigation. A sidebar app frame should not be forced into symmetrical outer margins by this heuristic. |
| font-not-dealt | A comparison against a proposed design sheet, not a broken-font report. RF Display is loaded; body intentionally uses system UI. |
| still-page | Quiet motion is appropriate for a focused local media utility and reduced-motion support. Motion count is not a defect or a reason to add gratuitous entrances. |

The report's heading summary counts one heading although the source visibly includes category headings, and its layout classifies the directory wrapper as a footer. Its nav dimensions describe a full-height sidebar. These classification limits warrant inspecting raw source/render evidence before interpreting the higher-level heuristics.

Questions skipped: this independent evidence subtask is reporting to the parent for synthesis; user follow-up belongs to that parent workflow.

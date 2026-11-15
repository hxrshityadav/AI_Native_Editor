# Live reference comparison and correction

Inspected https://llmdojo.dev/ in desktop Chrome at 1440px and mobile at 390px
before modifying the sidebar. Switched the reference's real theme button to dark,
hovered its actual navigation, and saved screenshots and computed styles under
`output/dojo-reference/`. Brand, copy and assets are not copied.

| Detail | Live LLM Dojo | Current Reel Finisher before correction |
|---|---|---|
| Dark capsule | #131315 | #252527 (too gray) |
| Active background/text | #f6f6f7 / #0a0a0b | #f6f6f7 / #211c17 |
| Muted inactive ink | #babac2 | #babac2 |
| Expanded / collapsed | 208px / 56px | 216px / 60px |
| Item height | 44px | 48px |
| Capsule padding / gap | 6px / 8px | 8px / 4px |
| Capsule radius | 28px | 32px |
| Icons | 20px, 1.6 stroke | 20px, 1.75 stroke |
| Desktop control | Hover/focus; no permanent collapse button | Visible toggle below capsule |

The actual live dimensions differ from the suggested 184–196/48–52 starting
values; this implementation follows the measured reference. Nine real Reel
Finisher destinations produce a taller capsule than Dojo's seven destinations.
Their row geometry and local icon alignment can match without removing routes.

Live dark page/surface/frame/border/text are #0a0a0b, #131315, #1c1c1f, #27272b,
#f6f6f7. Existing public-page tokens already match those values: keep them and
correct the sidebar-specific tokens rather than recoloring every tool.

The reference mobile layout hides the rail and exposes a 65px bottom bar. Reel
Finisher keeps its existing bottom navigation plus the user's requested accessible
drawer, sharing the same capsule component. This is an intentional adaptation.

Retain a stable reserved desktop slot: Dojo changes content placement on hover,
but this brief explicitly requires no shifting or obstructing main content.
Remove the persistent desktop toggle from fine-pointer presentation while
retaining touch and keyboard access. Use 100ms entry/250ms exit delay, 220ms
capsule width and 140ms label transition. Preserve installed Motion skill's
CSS-first guidance, reduced motion, cleanup and existing processing behavior.

Final implementation additionally anchors the independent RF mark above the
56px icon lane, exactly as the live reference keeps its mark fixed when expanding.
The reserved grid slot is 232px, with the capsule origin 24px inside the frame.
This aligns its expanded right edge with the slot boundary and the header/page
reading edge on a common 24px gutter. The reference color values are preserved
rather than replacing them with the brief's approximate starting values.

Changed: Sidebar.tsx (20px/1.6 stroke and exit timing), public-site.css (palette,
geometry, fixed logo and pointer-specific control), public-motion.css (220/140ms
width/label tokens), DESIGN.md and sidebar regression tests. No dependency,
product-engine, model, route or excluded editor-directory changes.

## Verification

Final npm run check passed: clean TypeScript, zero ESLint warnings and 84 unit
tests. Final npm run build passed. The reference-specific hover suite passed
76/76, including computed colors, 208/56px widths, 44px rows, 6px padding, 28px
radius, fixed logo, no persistent fine-pointer toggle, focus/touch/re-entry and
reduced motion. Main content stayed at identical sampled coordinates throughout
expansion. Final screenshots under output/dojo-correction-hover-release include
expanded, collapsed, transition and mobile drawer states. Expanded and collapsed
tool screens were viewed directly alongside output/dojo-reference/dark-expanded.png
and dark-collapsed.png. Homepage and Command Center captures are produced by the
light/dark capsule matrix under output/dojo-correction-capsule-release/.

Remaining limits: Chromium viewport/touch emulation is not physical-device
certification. No screen-reader speech session or production hosting test was
performed. The live reference has seven links versus nine preserved product
links; their total capsule heights therefore differ. The mobile drawer and
stable reserved desktop slot deliberately follow this brief rather than copying
the reference's mobile bottom bar and horizontal content reflow. No MotionScore
or pixel-perfect whole-page equivalence is claimed.

Final serial completed-build checks passed: reference-specific hover/color/geometry
76/76; light/dark capsule matrix 86/86; npm run e2e:site 262/262 (158 public shell,
89 public routes and real sample outputs, 15 Command Center). Total 424/424 browser
checks. Final clean root check retained 84 passing unit tests; production build
passed. Earlier partial runs are not included. Settled mobile drawer screenshots
are recaptured after the 240ms entrance so they are not confused with transition
frames. No new animation dependency or paid feature was used.
Settled light/dark matrix rerun also passed 86/86; final mobile captures are in
output/dojo-correction-settled/. The fully open dark 390px drawer was visually
reviewed after its entrance completed.

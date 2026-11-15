# Reference capsule sidebar

The old navigation lacked a self-contained capsule and placed its toggle between
the brand and links. Collapsing changed icon padding. Mobile used a separate list
composition rather than the same primary navigation design.

Changed `Sidebar.tsx` and the navigation section of `public-site.css`, retaining
the existing SiteShell grid and preference key. The independent centered mark
sits 20px above the capsule; the toggle sits below. Expanded width is 216px in a
240px column; collapsed width is 60px in an 84px column. Shared 8px padding, 48px
rows, 20px outlined Lucide icons and 12px icon/label spacing keep icon positions
constant relative to the capsule. Labels never wrap. Links retain accessible
names, focus outlines and collapsed hover/focus tooltips.

Sidebar-specific light tokens render a white capsule, warm neutral hover and
charcoal active pill; dark tokens retain the Dojo application theme with matching
geometry and inverse active contrast. No page-theme switch is forced. Active
labels and icons also use increased weight. No dependencies or processing changes.

Below 1280px the rail defaults compact unless a stored choice exists. Below
1024px the native dialog reuses the expanded capsule, with the existing searchable
individual-tool list retained beneath it. Backdrop, Escape, focus return, scroll
lock and selection dismissal remain. Drawer entrance and label transitions use
CSS, with the existing reduced-motion override. DESIGN.md records these rules.

Added `tests/e2e/capsule-navigation.e2e.mjs`: dimensions, invariant icon coordinates,
nested photo route activation, page/footer clearance, theme states, mobile drawer,
saved collapse, backdrop and tool selection. Initial expanded test pass: **86/86**
at 1600/1440/1280/1024/768/430/390/360, both themes. Captures are in
`output/capsule-navigation-final/`, including homepage, tool and Command Center.
Light expanded and dark collapsed tool screens were visually inspected.

Final build/check and serial regression results are appended below. An earlier
public-site run passed 158 checks but was interrupted by a concurrent rebuild;
that partial run is not a completed E2E pass. No physical-device or screen-reader
speech testing is claimed. The source is scoped to .site and excluded editor
paths were not modified.

Final completed-build validation: npm run check passed (TypeScript, ESLint with
zero warnings, 84 unit tests); npm run build passed. Capsule matrix repeated
against that build: 86/86. Final reference captures are in output/capsule-release/.
The existing public shell suite passed 158/158; the remaining route and Command
Center regression totals are appended on completion. No runtime dependency was
introduced and theme/storage behavior remains local.

Final npm run e2e:site completed successfully: 158 public shell + 89 route/workspace
and real sample-download + 15 Command Center checks = 262/262. With the dedicated
capsule matrix, 348/348 browser checks passed. The successful serial run is in
output/capsule-regression-release.log; no rebuild ran concurrently with it.

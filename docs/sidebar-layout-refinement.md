# Responsive sidebar and spacing refinement

The desktop grid previously reserved a fixed rail width while hover/focus expanded
the rail beyond its column. Its higher stacking order placed navigation over page
content. The footer also used an independent 32px horizontal inset rather than
the shared page gutter. A fixed corner-mask shadow added a paint layer over long
page captures.

The frame now owns a 240px expanded / 76px collapsed grid column, with a
minmax(0,1fr) content column containing the header, page and footer. Explicit
toggle controls replace hover expansion. Tablet defaults to the compact rail;
expanding at 1024px still reserves layout space. Below 1024px the native modal
drawer provides backdrop dismissal, Escape, focus return and document scroll
lock. Collapsed navigation retains named links and hover/focus tooltips.

The preference is stored under rf-sidebar-collapsed, applied before initial paint
and synchronized on client navigation; blocked storage leaves session controls
usable. Shared desktop and mobile gutters are 24px and 20px. Footer columns use
controlled grids, and the footer belongs to the content column. The rounded
application frame now clips itself rather than using a fixed painted mask.

The existing Dojo colors, Geist fonts, tonal panels and pill controls remain.
Processing engines, model delivery and excluded editor experiences are untouched.
No dependency was added.

Modified: Sidebar.tsx, SiteShell.tsx, public-site.css, DESIGN.md. Added
tests/e2e/sidebar-layout.e2e.mjs. Existing site tests now assert explicit toggle
behavior rather than obsolete hover expansion, and support a separate screenshot
output directory to recover from an observed screenshot-file write failure.

Validation logs and captures live under output/sidebar*. The first geometry
matrix passed 61/61; it is repeated against the final frame-clipping build.
Production build and root check passed (84 unit tests). Final regression results
are recorded below after completion. No physical-device testing is claimed.

Final verification: npm run check passed (TypeScript, ESLint with no warnings,
84 unit tests); npm run build passed. The responsive matrix passed 61/61 at
1600, 1440, 1280, 1024, 768, 430, 390 and 360px across homepage, image compressor
and Command Center. Final public-shell regression passed 158/158. Captures include
output/sidebar/footer-expanded.png, footer-collapsed.png and viewport/route/state
screenshots. The initial file-write failure and intermediate tooltip failure are
retained in logs; subsequent runs supersede them. Physical touch devices and
screen-reader speech output were not tested. Engines and models were not changed
or separately re-benchmarked in this layout-only task.

Completed browser regressions: public shell 158/158; all-public-route and real
sample processing suite 89/89. Command Center completed in a targeted rerun using
COMMAND_TEST_OUT=output/sidebar-command-final after its default screenshot path
also produced an OS file-write error. The combined npm run e2e:site invocation
therefore is not claimed as an uninterrupted successful run. Mobile backdrop
click and destination selection were separately confirmed to close the drawer.
The final matrix passed 61/61 after the mask removal. Screenshots were visually
inspected, including the expanded desktop footer and mobile drawer.

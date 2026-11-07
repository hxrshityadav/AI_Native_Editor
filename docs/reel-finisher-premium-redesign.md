# Reel Finisher 2.0: premium redesign and Command Center

Date: 7–8 November 2026. Branch `redesign/site-and-tool-workspace`, uncommitted.
Status: **Tested** (automated). Not verified on a physical device or a production host.

## 1. Creative direction

**The Command-Led Workstation.** The product performs instead of describing itself. The homepage hero is the real worker-backed image-compression bench. The next section is a working slice of the Command Center search over the real catalog. The Command Center itself is an operate-mode surface built for actions, not metrics.

- Taste Skill direction: *The product performs*, seed **1780194044**, dealt 6 November with `--keep palette,type`. It was not redrawn. The dealt hero blueprint ("controls on the sentence") was adapted as the sheet's own adjustment notes require: the primary action is a real button, the headline is held to two lines, and the working fragment is the bench.
- The idea sentence: *on this page, the tool's own measured output (a real compressed file and real search results from the catalog) becomes the hero fragment.*
- The live thing: the compression bench (choose a format and quality, run it, compare, download), plus the live catalog search fragment.
- The previous November 5 charcoal-and-amber look was replaced; its working bench, Stageshow illustrations and attribution were kept.

## 2. Colour and type

Single token source: `.site` in `src/components/site/public-site.css`. The duplicate green token block in `globals.css` was removed. Tailwind utilities read the same variables.

| Role | Tokens |
|---|---|
| Black surfaces | canvas `#08090b`, sunken `#0d1015`, surface `#121720`, field `#181f2b`, hover `#1d2533`; edge `#252d3a`, control edge `#566176` |
| Ink | `#f5f7fa`, `#d3d9e2`, muted `#a0a9b7`, faint `#8b95a6` |
| Blue (where you are, what is selected, focus, secondary) | `#4d88ff` (lightened from #397bff for 5:1 text contrast on black), strong `#246bfd`, deep `#143c91`, surface `#101d35`, focus `#5b93ff` |
| Orange (the next action, real progress) | `#ff6b35`, hover `#ff824d`, press `#e85a27`, on-orange ink `#08090b` |
| Status | success `#5bd69a`, warning `#ffb86b`, error `#ff7a70`, each with a soft surface |

The type stays on two faces. Display is the bundled RF Display (Mukta Bold, OFL); body and controls use the system UI stack. The homepage scale is display `clamp(2.25rem, 6.6vw, 6rem)`, h2 `clamp(2rem, 3.4vw, 3rem)`, title 1.75rem, body 16–19px and metadata 13px. Tracking is -0.035em on display type. Tabular figures are used for sizes.

Full spec: `DESIGN.md` (frontmatter and prose updated).

## 3. Design-system architecture

- `buttonClass()` in `src/components/site/ui.tsx` is the only button system. The `ds-primary`, `ds-secondary` and `ds-destructive` classes it emitted had no CSS at all before this pass; they are now defined: an orange primary, a dark secondary with a blue border, a ghost and a red destructive. Press feedback, a 3px icon nudge and focus rings are included.
- The tool surface (`ToolSurface.module.css`) has its roles corrected. Selection (dropzone drag, segments, chips, ranges, checkboxes, link toggles) is blue. Browse, process, download, the spinner and real progress bars are orange. Stray radii and sizes are mapped to tokens.
- Homepage composition lives in `src/components/site/home/` (`home.css`, `CommandPreview.tsx`, `HomeMotion.tsx`), so other routes don't load it.
- Command Center: `src/components/command-center/*` and `src/lib/command-center/*`.

## 4. UI libraries actually used

The full review is in `docs/command-center-library-research.md`. In short, **no source was imported from Skiper UI, Vengeance UI, Watermelon UI or Bencho**:

- Skiper UI and Vengeance UI need Framer Motion, a second animation runtime alongside GSAP. Skiper's free tier also requires attribution.
- Bencho's blocks are paid, and the project has no licence.
- Watermelon's dashboard blocks centre on metrics this product doesn't have.

Their patterns (command bar, filter chips, text reveal, collapsible rail) were rebuilt on the existing native primitives. **GSAP 3.15.1** is used. shadcn-style primitives remain the existing native adaptation; no Radix was added.

## 5. GSAP animation

`HomeMotion.tsx` is the homepage only. GSAP and ScrollTrigger are dynamically imported after hydration.

- **Signature move:** the headline lines rise out of overflow masks, staggered 90ms. The lead and the actions follow, then the real bench settles.
- **Scroll entrance:** each section's heading, then its copy, then its fragment enter once (`data-reveal` / `data-reveal-part`, staggered 75ms, 14–28px rise).
- **Scroll drift:** a slow, scroll-linked scale on the bench sample image (desktop only, transform only).
- **Safety:** `gsap.matchMedia` runs nothing under `prefers-reduced-motion`. Content is visible in the server HTML. Everything is reverted, and all ScrollTriggers killed, on unmount. SplitText is not used.
- **Elsewhere:** CSS transitions handle buttons, cards, the palette opening and the FAQ icon. There is no fake processing progress anywhere.

## 6. Command Center (`/command-center`, noindex)

- **Section rail:** Overview, All tools, Photo, Video, Audio, AI Studio, Favorites, Recent activity and Settings, each showing its real count. It becomes a horizontal strip below 1024px. Views can be deep-linked (`/command-center#audio`).
- **Overview:**
  - a first-run guide, shown only when nothing is pinned or recorded;
  - ten Quick actions taken from the catalog;
  - favorites and recently opened tools, with relative times;
  - category tiles.
- **Category and All tools views** have search by name or format.
- **Global command palette:** one instance, mounted by the site shell. Before this pass it existed but was never rendered.
  - It opens with Ctrl/⌘ K or the launcher in the sidebar and phone header.
  - It has category filters, arrow, Home and End keys, Enter to open, and Escape with focus return. Recent tools are listed first.
- **Favorites:** pin and unpin, persisted in a versioned, allowlisted localStorage record, synced across tabs, with a clear action.
- **Recent activity:** `RouteActivity`, which was also previously unmounted, records tool routes and visit times only, up to 12. It can be paused and cleared, and it never records file names, results or transcripts. The UI says these are visits, not processing jobs.
- **Blocked or corrupt storage:** shows a recovery message and keeps working for the session.

## 7. Routes redesigned

The global shell applies everywhere: sidebar with palette launcher, blue current state, phone header with palette, and a new footer.

- `/`: rebuilt from scratch. Sections: hero with the bench, Command Center fragment, featured tools as a large-type list, the Stageshow category illustrations, a local AI model table with real download sizes, the creator workflow, a blue-field privacy statement, how it works, FAQ, the final call to action and the footer.
- `/command-center`: rebuilt.
- `/tools`: new tokens; filled tool tiles instead of hairline rows; blue selected chips; the "0 planned" copy removed.
- All 29 standalone tool pages: new tokens, role-correct blue and orange, token radii, and an "AI tools" label fix.
- `/privacy` and `/supported-formats`: new tokens, shell and footer.

There is no blog or other content route in the repository, so none was invented.

## 8. Routes intentionally excluded

`/studio`, `/studio-legacy` and `/lab`, along with OpenReel source, are excluded. None of them mounts `.site`, and none was edited in this pass. The Studio regression suite was run (results below).

## 9. Responsive validation

The Taste inspector (`inspect.mjs`) ran at 1440, 768 and 390. The redesign suite measured every public route at 1440, 1280, 1024, 768, 390 and 360: one h1 and no horizontal overflow on each. The site suite also checks 320 and 1920. Screenshots are in `.taste-skill/v2-*` and `output/redesign/`, with Command Center captures in `output/command-center/`. They were inspected by eye at desktop and phone widths.

Fixed along the way:

- the headline wrapping to four lines;
- icon-topped category tiles;
- 18 type sizes on one page, reduced to 13;
- footer wordmark contrast (1.2:1, raised to about 3.2:1 for decorative large text);
- inset-shadow selection states;
- long unbroken words at 390px;
- grid min-width overflow at 320px;
- 32px tap targets in the model table.

## 10. Impeccable

`impeccable context` was loaded; PRODUCT.md and DESIGN.md were updated. `impeccable detect` (source scan of the changed UI) found **no rule findings**. Its 64 advisory token-drift notes were mostly tool-surface radii and sizes, now mapped to tokens. The page-level rules need a live page; they were not run separately, because the Taste inspector covers contrast, size and overflow in a real browser.

## 11. Taste Skill results

| Surface | Result |
|---|---|
| Homepage (`inspect.mjs`, page mode) | **0 FAIL**, 3 WARN |
| Command Center (`--app`) | **0 FAIL**, 2 WARN |
| `/tools`, Image Compressor, Trim Video, Transcribe, Privacy, Supported Formats | **0 FAIL** each |
| `lint.mjs` on changed sources | **0 FAIL**, 6 WARN |

The warnings that remain, and why each stays:

- **No video on the homepage:** the subject has no honest clip, and the live bench is the moving picture.
- **Off-centre margins:** this is the asymmetric sidebar app shell.
- **13 font sizes:** these include app-UI metadata sizes inside the fragments.
- **Ragged card rows:** an empty favorites tile beside a filled recent list.
- **Outlined boxes:** these are real form fields.

Self-critique, last round. The first screen says what this is and what to do. The bench and the search fragment are real. The weakest part is the long sidebar list beside the homepage, which competes with the hero on wide screens.

## 12. Performance and bundle

- GSAP is two lazy chunks, about 95 KB raw and 37 KB gzipped, fetched only after the homepage hydrates. Neither the prerendered homepage HTML nor a tool page's HTML (checked: Image Compressor) references them.
- No model runtime, Studio asset or editor bundle loads on public pages; the redesign suite asserts this.
- The Command Center adds no dependency.

## 13. Accessibility

- One palette dialog: a native `<dialog>` with combobox and listbox roles, `aria-activedescendant`, Escape and focus return.
- Rail buttons use `aria-current`; pins use `aria-pressed` with named labels; counts are announced through status regions.
- The model table is a real `<table>` with a caption and row headers.
- Focus rings are blue, 2px, with an offset; on the blue privacy field they turn white.
- Reduced motion turns off all GSAP and CSS travel. Touch targets are 44px or more.

## 14. Test results (production build, Windows, installed Chrome)

| Run | Result |
|---|---|
| `npm run check` (types, ESLint, Vitest, editor checks) | Passed: 366 site unit tests (6 skipped) plus editor suites |
| `npm run build` (clean) | Passed |
| `command-center.e2e.mjs` (new) | **15/15** |
| `site.e2e.mjs` | **159/159** (three assertions updated for intended changes: the Command Center sidebar link, the "Explore tools" CTA and the new theme colour) |
| `redesign.e2e.mjs` (all public routes × 6 widths) | **91/91** |
| Media and Studio regression | photos 44/44, passport 13/13, HEIC 11/11, background removal 13/13, video compressor 37/37, media tools 43/43, Studio 39/39 |

## 15. Remaining limitations

- Nothing is committed.
- Results come from browser emulation only, with no physical phone or tablet. The production host is still NO-GO (`docs/production-readiness-report.md`).
- Tool workspaces were restyled through the shared tokens and surface. Their individual layouts (waveform players, range controls) were not recomposed one by one in this pass.
- No paid or third-party component source was used. If Skiper or Bencho components are wanted later, they need a licence and attribution decision first.
- The full `npm run e2e` chain, including the long lab, phone and local-AI model suites, was not rerun in this pass; only the suites listed above were.

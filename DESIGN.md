---
name: Reel Finisher
description: LLM Dojo's design language applied to a local media toolkit; neutral near-black surfaces, one warm amber accent, Geist, borderless panels and pill actions.
colors:
  # LLM Dojo palette, dark default (verified; docs/design-reference-llmdojo.md)
  background: "#0a0a0b"
  frame: "#1c1c1f"
  surface: "#131315"
  surface-2: "#1c1c1f"
  border: "#27272b"
  control-edge: "#62626b"
  foreground: "#f6f6f7"
  secondary-ink: "#dcdce1"
  muted: "#babac2"
  faint: "#90909a"
  accent: "#f2a65a"
  accent-hover: "#f5b97a"
  ring: "#f5b97a"
  success: "#b5e48c"
  info: "#8fd6b4"
  warning: "#fbbf24"
  danger: "#f87171"
  chart-amber: "#f2c14e"
  chart-coral: "#f28c6b"
  chart-lime: "#b5e48c"
  chart-mint: "#8fd6b4"
  chart-sand: "#b8a98a"
  chart-cream: "#f3e9d2"
  light-background: "#faf7f2"
  light-surface: "#ffffff"
  light-surface-2: "#f3eee6"
  light-border: "#e6ded1"
  light-foreground: "#1f1a14"
  light-muted: "#6b6256"
  light-accent: "#a64f0c"
typography:
  page-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 3vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  hero:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.4vw, 2.875rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  section:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
  card-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.55
  lead:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.0625rem"
    lineHeight: 1.6
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
  metadata:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontFeature: "tabular-nums"
  kbd:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
rounded:
  sm: "10px"
  md: "16px"
  lg: "20px"
  panel: "24px"
  frame: "36px"
  pill: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  gap-panel: "24px"
  pad-panel: "20px (<768) / 24px"
  control-height: "40px"
  search-height: "44px"
motion:
  curve: "cubic-bezier(.2,.8,.2,1)"
  fast: "140ms"
  base: "220ms"
  dialog: "180ms"
  disclosure: "240ms"
  panel-in: "420ms, staggered 50ms"
components:
  button-primary:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    rounded: "{rounded.pill}"
    height: "40px"
    fontSize: "14px"
    hover: "opacity .9"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
  button-destructive:
    backgroundColor: "#331717"
    textColor: "{colors.danger}"
  input:
    backgroundColor: "{colors.surface}"
    border: "1px {colors.border}"
    rounded: "{rounded.pill} (search) / {rounded.control} (fields)"

---

# Design System: Reel Finisher

> **Revision 8 November 2026, pass 2: LLM Dojo design language (current).** The black, electric-blue and orange identity is **retired**. Reel Finisher now uses LLM Dojo's verified palette, typography, shapes, buttons, icons and shell: a neutral near-black frame, borderless panels, one warm amber accent, Geist and Geist Mono, pill buttons, and a light theme behind a toggle. Anything below that mentions blue, orange, `--brand` as blue, or "The Command-Led Workstation" colours is superseded by this section.

## Geometry and consistency rules *(pass 3, 8 Nov — current)*

One geometry system for every public page. Tokens live in `.site` in `src/components/site/public-site.css`; no page sets its own radius, gap or button size.

| Token | Value | Used for |
|---|---|---|
| `--space-1 … --space-8` | 4, 8, 12, 16, 20, 24, 32px | 8 inline, 12 compact groups, 16 related content, 20 inside secondary panels, 24 between panels, 32 between page sections |
| `--gap-panel` | 24px | Gaps between columns and panels (homepage, directory, Command Center, tool pages) |
| `--pad-panel` | 20px below 768px, 24px from 768px | Padding of every primary panel |
| `--radius-sm` | 10px | Fields, small controls, list-row hovers |
| `--radius-md` | 16px | Cards and tiles: tool cards, quick actions, FAQ rows, workflow rows, steps, related links |
| `--radius-lg` | 20px | Secondary panels: the bench inset, category cards |
| `--radius-panel` | 24px | Primary panels, the dropzone, the rail |
| `--radius-frame` | 36px | The application canvas only |
| `--radius-pill` | 9999px | Buttons, search, chips, tabs |
| `--control-height` | 40px | Every button (primary, secondary, destructive, tool actions, bench), fields and selects |
| `--search-height` | 44px | The one search pill: top bar, directory, homepage finder, Command Center |

**Panels.**
- **Primary** (`.panel`): surface background, 24px radius, `--pad-panel` padding, no border or shadow.
- **Secondary** (`.panel-inset`, category cards): surface-2 background with a 20px radius.
- **Cards** use 16px.
- Never nest more than panel, then secondary, then card.

**Shell (layout architecture, pass 5, 13 Nov — current).** One element owns the width: `.app-frame`. It is fluid: the viewport width minus 24px on each side, with **no desktop maximum**, as measured on LLM Dojo at 1900px (frame 24–1876px). There are no per-page `max-width` rules.

Measured at 1900px: the frame is 1852px wide; content runs from 120px to 1852px (1732px); the homepage columns are 1139px and 569px with a 24px gap.

- **Sidebar allocation:** the frame grid is `[--rail-width | content]`. `--rail-width` is 72px collapsed and 224px expanded (`data-sidebar` on the frame), so content gives up 152px when the sidebar opens and takes it back when it closes.
- **Homepage grid:** `minmax(0,1.9fr) minmax(320px,.95fr)` with a 24px gap. It stacks when the workspace container is 900px or narrower, which includes the case where the sidebar expands on a small laptop.
- **Bench:** the preview is flexible; the settings column is `clamp(260px, 30%, 340px)`. It stacks when its column is 620px or narrower.
- **Search pill:** up to 480px in the top bar, shrinking as needed.
- **Breakpoints:** 1024px and up shows the frame, rail and top bar; below that, the phone header, drawer and bottom tabs with 20px insets. The footer goes to three columns below 1280px and two below 768px.

| Token | Value | Role |
|---|---|---|
| `--frame-inset` | 24px | Frame distance from the window, on all four sides |
| `--rail-width` | 96px | Rail column (64px rail plus margins); it grows to 268px on hover or focus and pushes content |
| `--page-inset` | 24px (16px below 768px) | The shared horizontal inset of the top bar, `main` and the footer |
| `--radius-frame` | 40px | The frame's corners |

- **Frame grid:** `[--rail-width | content]`. The content column holds, in order, the sticky top bar, `main` and the footer. All three use `--page-inset`, so the search pill, the panels and the footer share exact left and right edges at every width.
- **Corners:** a fixed, non-interactive `.frame-mask` (rendered once by `SiteShell`) paints the page colour outside a rounded rectangle that matches the frame. All four corners stay rounded while content scrolls under the sticky top bar. Dialogs sit above it in the top layer.
- **Rail alignment:** the rail's top edge lines up with the first panel's top edge (both at frame inset + top bar).
- **Rhythm:** `main` padding is 24px top and `--gap-panel` bottom; the footer follows at the same gap, then `--frame-inset` to the frame's bottom.
- **Phones:** no frame or mask, 16px insets, and 88px bottom space for the tab bar.

**Footer.** One grid of six tracks: the brand (1.6fr) and five link columns (1fr each), sharing tracks through `subgrid`. It has 32px padding (24px/20px on phones) and 24px gaps, and its first row is 32px tall so the wordmark and headings align. Below 1280px: brand on top, then three columns. Below 768px: two columns.

**Homepage.** Two independent columns (8 + 4). The last panel in each column stretches, so both columns end on one line. Below 1024px the columns dissolve into one sequence ordered by each panel's `order`: hero, finder, categories, models, workflows, featured, formats, privacy, FAQ.

**Panel header pattern.**
- The title is 20px/27.5px, weight 600, with an optional 18px Lucide icon in the muted colour.
- Any action sits on the right as a secondary pill ("All 29 tools" (the count comes from the catalog), "Details").
- A panel-level call to action at the foot is a full-width secondary pill ("Read the privacy notes").

**Icons.** Lucide, stroke 1.75 with round caps and joins: 16px inline, 18px in rows, 20px in the rail and panel headers, 22px in phone tabs.

**Metadata.** Geist Mono, 12px, muted: formats, sizes, counts, model sizes, limits, durations and keys. Descriptions stay in Geist. The Taste linter flags mono; it is kept deliberately because the brief requires it.

**Tabs.** Section tabs on tool pages are pills; the current tab is surface-tone.

## Palette and roles *(pass 2)*

The tokens live in one place: `.site` and `:root[data-site-theme="light"] .site` in `src/components/site/public-site.css`. They keep their existing names so every component inherits them.

| Token | Dark | Light | Role |
|---|---|---|---|
| `--canvas` | `#0a0a0b` | `#faf7f2` | Page behind the frame; phone background |
| `--frame` | `#1c1c1f` | `#f3eee6` | The 32px rounded application canvas (desktop) |
| `--sunken` | `#131315` | `#ffffff` | Panels (reference `surface`) |
| `--raised` / `--field` | `#1c1c1f` | `#f3eee6` / `#faf7f2` | Insets inside panels, secondary pills |
| `--hover` / `--edge` | `#27272b` | `#e6ded1` | Tonal selection, hover; borders on fields, `kbd`, dialogs |
| `--ink` / `--subtle` / `--faint` | `#f6f6f7` / `#babac2` / `#90909a` | `#1f1a14` / `#6b6256` / `#776d60` | Text, muted, metadata |
| `--accent` (also `--brand`) | `#f2a65a` | `#a64f0c` | Links, focus ring, control accent colour, real progress, pinned star, small status dots |
| `--primary` / `--on-primary` | `#f6f6f7` / `#0a0a0b` | `#1f1a14` / `#faf7f2` | Primary pill buttons |
| success / info / warning / danger | `#b5e48c` / `#8fd6b4` / `#fbbf24` / `#f87171` | `#46720e` / `#1f7a5a` / `#8a5a00` / `#b42318` | Semantic only |
| chart amber, coral, lime, mint, sand, cream | reference values | darker counterparts | Real data pictures only (model sizes on the homepage) |

**Rules:**
- The interface stays neutral; amber is never a large fill.
- Selection is tonal: a `--raised` or `--hover` background, with no coloured outline.
- Icons are neutral at rest and turn `--ink` when active.
- There are no gradients, glows or neon.

## Theme *(pass 2)*

Dark is the default. The sun and moon toggle in the top bar (and the phone header) sets `data-site-theme="light"` on `<html>` and remembers it in `localStorage` (`rf-site-theme`). An inline script in `SiteShell` applies a saved choice before first paint.

The attribute name `data-site-theme` was chosen when the site still embedded an editor that used `data-theme`; it is kept for stability.

## Shapes, panels and buttons *(pass 2)*

- **Radii:** see the pass 3 geometry table (frame 36, panel 24, secondary 20, card 16, field 10, pill).
- **Panels:** borderless, with 20–28px padding and 16–20px gaps. Hierarchy comes from tone (frame, then panel, then inset), type and spacing.
- **Borders:** only on fields, `kbd`, dialogs, rows inside a list and the result table rows.
- **Buttons:** 40px tall at 14px, weight 500, pill-shaped.
  - Primary: foreground background, hover at opacity 0.9.
  - Secondary: surface-2, hover to the border tone.
  - Tertiary: text only.
  - Destructive: danger on danger-soft.
  - The tool surface's Browse, Process and Download actions follow the primary rule; loading keeps the button's size.
- **Icons:** Lucide, outlined, with stroke 1.9 on the 24px grid (the visual equivalent of the reference's 1.6 on 20px) and round caps and joins. 16px in buttons and search, 18–20px in navigation and rows, 22px in phone tabs.


> **Revision 8 November 2026.** Reworked using the principles in `docs/design-reference-llmdojo.md`: working panels on tone steps, true counts as mono metadata, one search everywhere, pill actions and calm motion. The palette and the product-performs direction are unchanged; type, shape, navigation and motion changed. Where this revision and older prose below disagree, this section and the sections marked *(rev. 8 Nov)* win.

## Principles *(rev. 8 Nov)*

1. **Every block is a working entry point.** A panel opens a real tool, runs a real sample or lists real facts. No decorative sections.
2. **True numbers only.** Tool counts, model sizes, formats and limits come from the catalog or `docs/local-models.md` and are set as mono metadata. No usage numbers.
3. **Panels, not lines.** Content sits in borderless 20px panels on `--sunken`, with nested 14px insets on `--raised`. Hairlines appear only between rows of a list, in tables, in fields and in dialogs.
4. **One search.** A wide search pill in the top bar on desktop, and a Search tab on phones, both open the same Ctrl/⌘ K palette.
5. **One primary action per block.** It is a foreground pill (pass 2). Secondaries are surface-2 pills; tertiaries are text.

## Typography *(rev. 8 Nov)*

Public pages use **Geist** and **Geist Mono**. They are variable fonts under SIL OFL 1.1, vendored at `/fonts/geist` (about 58 KB each, with `font-display: swap`). RF Display (Mukta) is no longer used on public pages and remains available to the editor family.

| Role | Size / line | Weight | Notes |
|---|---|---|---|
| Hero (homepage) | clamp(32–40px) / 1.2 | 600 | −0.025em, two lines at every width |
| Page title (tools, directory, Command Center) | 32px / 40px | 600 | −0.025em |
| Section / panel title | 20px / 27.5px | 600 | −0.025em |
| Card and tool name | 16px | 600 | |
| Body | 16px / 1.55 | 400 | Full ink for running text |
| Lead | 17px / 1.6 | 400 | `--ink-2` |
| Label / button | 14px | 500–550 | |
| Metadata | 12px mono, tabular | 400 | Formats, sizes, counts, durations, limits |
| Keyboard | 11px mono in a 1px `--edge` box, 4px radius | | `Ctrl K`, `↑ ↓ ↵ esc` |

Mono is reserved for measurements, file facts, counts and keys. Prose, labels and promises such as "Free" or "No account" stay in the sans.

## Iconography *(rev. 8 Nov)*

- **Library:** Lucide (`lucide-react`) only. No emoji or other icon sets. Custom SVG appears only for real drawings: none today; the Stageshow stills are raster.
- **Stroke:** 1.9 on Lucide's 24px grid (pass 2; it was 1.75), with round caps and joins (the Lucide default). It is never filled; a selected state changes colour or background, not the glyph.
- **Sizes:** 16px inline (buttons, search, links, breadcrumbs), 18px in list rows and the palette, 20px in navigation, panel titles and quick actions, 22px in the phone tab bar and tool header tiles.
- **Colour:** icons inherit text colour. Icons are neutral (`--subtle`) at rest and `--ink` when current or hovered (pass 2). Amber colours an icon only for a small status, such as onboarding steps or the pinned star.
- **Spacing:** 8–10px from the icon to its text; icons align to the first text line.
- **Tool icons:** each tool has one Lucide glyph in `TOOL_ICONS`. Cards show it bare at 20px; the tool page header shows it in a 44px `--sunken` tile.

## Navigation *(rev. 8 Nov)*

- **Desktop (1024px and up):** the collapsible labelled sidebar, which holds every working tool grouped by category with a quick filter. A sticky top bar holds the search pill (`Ctrl K`), the Command Center pill and the theme toggle.
- **Phone and tablet (below 1024px):** a sticky header (wordmark and the Menu drawer with the full list) and a fixed bottom tab bar: Home, Tools, Command, and Search (opens the palette).
- **Palette:** a native dialog with "Try" suggestion chips, category filters, arrow, Home and End keys, ↵ to open and Esc to close with focus return. It is one instance, mounted by the shell.
- **Footer:** a panel holding real navigation columns generated from the catalog: AI, Video, Audio and Photo tools, plus Reel Finisher pages and open-source notices.


## Overview

**Creative North Star: "The Command-Led Workstation"** (Reel Finisher 2.0, November 7, 2026. It replaces the November 5 charcoal-and-amber "Finishing Bench" look and keeps its working bench.)

The product performs. The homepage hero is the real worker-backed compression bench, and the Command Center section is a working slice of the real catalog search. Public tools share layered near-black surfaces and electric-blue selection and focus. Orange is reserved for the action that moves the work forward. Actual photos, clips, waveforms, documents and transcripts provide the visual material.

Operate surfaces prioritize the task. Read surfaces prioritize comprehension. The public identity is scoped to `.site`, which every page mounts.

**Key Characteristics:**
- A visible source, intentional settings and a measured result.
- Flat tonal layers and restrained color.
- Locally bundled display typography paired with native control readability.
- No fabricated proof, ornamental progress or automatic model loading.

## Colors

Black dominates. Canvas, sunken, surface, field and hover form five near-black steps that separate regions by tone, not lines.

**Blue** marks where you are and what is selected: current navigation, selected chips and segments, ranges, focus rings and secondary buttons. One full blue-deep field holds the homepage privacy statement.

**Orange** marks what to do next: the primary button, the browse, process and download actions, real progress bars, and the pinned-star state.

Status colours always come with text.

**The One Action Rule.** One orange fill per decision point. Blue never fills a primary action, and orange never marks a selection. The single token source is `.site` in `src/components/site/public-site.css`. Tailwind utilities (`bg-brand`, `bg-accent`, …) read the same variables through `globals.css`. Studio tokens are not changed.

## Typography (superseded 8 Nov, kept for history)

**Display Font:** RF Display, the existing locally bundled Mukta Bold Latin subset under SIL OFL 1.1. Its compact proportions connect public identity to the product's caption heritage without loading editor code.

**Body Font:** System UI stack, selected for native form readability and zero extra downloads. **UI/control font:** the same stack at a smaller, medium-weight step. File sizes, dimensions and times use tabular figures instead of decorative monospace.

Display and headings establish hierarchy; running copy uses the body step. Model caveats and file metadata remain readable smaller text. Mobile headlines adapt without clipping.

## Layout

Desktop uses a 224px collapsible sidebar and a centered content region: 1240px for tools, 1320px for the homepage and Command Center. Gutters scale from 20px to 48px. Below 1024px, the sidebar becomes the existing accessible modal navigation drawer.

The homepage bench uses a flexible media column plus a 280px settings column with a 24px gap. Below 768px it stacks media above controls. Tool workspaces use a flexible preview plus a 320px control column; they stack on narrower screens. Transcript, speech and PDF tools retain their specialized layouts and controls. Tool support content follows the workspace, with larger separation between sections than within a control group.

## Elevation & Depth

Surfaces are flat at rest; differences in lightness carry depth. Only true overlays (the command palette and dialogs) carry `--shadow-2`. No decorative shadows, glows or glass. Fields keep visible boundaries. Focus uses a two-pixel outline with an offset; file-picker labels also expose focus-within.

## Shapes

Controls use modest corners; working surfaces use larger corners. Repeated icon tiles are removed. Transparency checkerboards and waveform marks remain functional information, not background ornament.

## Components

### Buttons

`buttonClass(variant, size)` is the only button system. Its variants are `ds-primary`, `ds-secondary`, ghost and `ds-destructive`.

- **Primary:** orange fill with black text. Hover brightens it; press darkens it and scales it to 98.5%.
- **Secondary:** dark surface with a blue border. Hover fills it with blue-surface.
- **Ghost:** text only.
- **Destructive:** red text on a red-tinted surface.

A trailing arrow moves 3px on hover. Shine, glow, liquid and magnetic effects were tried and rejected for file-processing screens. Busy buttons use `aria-busy`. Downloads remain real links to validated blobs.

### Inputs / Fields

Dark fields with a visible neutral stroke and inherited ink. Native labels, sliders, radio semantics and keyboard interactions are preserved. Lossless PNG disables quality control in the bench.

### Navigation

The catalog remains the source of truth. The current destination uses the blue surface with a blue icon. One global command palette searches the catalog; Ctrl/⌘ K or the launcher in the sidebar and phone header opens it. The desktop collapse preference, mobile focus trapping, Escape and return focus still work.

### Command Center

`/command-center` (noindex) has a section rail: Overview, All tools, Photo, Video, Audio, AI tools, Favorites, Recent activity and Settings. Below 1024px the rail becomes a horizontal strip. Each view has its own hash link. Favorites and recent visits store routes only, versioned, in this browser. When storage is blocked, the page shows a recovery message and keeps working for the session.

### Media Bench

The sample is explicitly generated demonstration media. Worker import and processing begin only on request. Every byte count and saving comes from an actual output Blob; changing settings invalidates the old result. Original and result use the same viewport crop, and full dimensions are retained in the download.

### Tool Workspace

Shared surface pieces handle file metadata, previews, settings, processing, warnings and result comparison. Specialized tool components retain their own processing state and engine. Informational messages recede; failures and recovery remain prominent.

### Workflow illustrations

Stageshow stills introduce photo, video, audio and caption workflows in discovery
surfaces. Their charcoal windows and orange selections sit inside the black-and-orange system. Desktop
and mobile have separately composed images; their pixels never replace live
controls or measured results. Illustrations are labelled, lazy-loaded, decorative
to assistive technology, and pre-rendered so no Stageshow runtime ships. Shared
tool headers link to the workspace, instructions and their real category.

## Do's and Don'ts

- **Do** put the user's media and primary task first.
- **Do** preserve local processing, cancellation, limits, integrity checks and cleanup.
- **Do** use the real catalog and truthful capability descriptions.
- **Do** respect reduced motion, keyboard access and native semantics.
- **Don't** add stock images or autoplay footage just to satisfy an image/motion count.
- **Don't** turn computed measurements into static marketing claims.
- **Don't** add tokens outside the `.site` source.
- **Don't** add decorative AI badges, gradients or nested icon cards.

## Motion *(rev. 8 Nov)*

GSAP was removed (dependency dropped). Motion is CSS only:

- **Homepage panels:** settle once on load (420ms, 10px rise, staggered 50ms).
- **Command palette:** opens over 180ms.
- **Disclosures:** animate height over 240ms where `interpolate-size` exists.
- **Hover:** tone changes over 140ms. Arrows nudge 2–3px, and category pictures scale 1.03 over 600ms.
- **Buttons:** press scales to 0.98.

All of it uses transform and opacity on the `cubic-bezier(.2,.8,.2,1)` curve, and nothing delays an action. Under `prefers-reduced-motion` the animations are removed and transitions drop to 0.001ms. Progress only ever reflects real pipeline events.

### Previous motion (7 Nov, superseded)

GSAP 3.15 runs on the homepage only, under its standard no-charge licence, and is imported after hydration:

- The headline lines rise out of their own masks.
- The lead and the actions follow.
- The real bench settles into place.
- Each section's parts enter once as it scrolls into view.
- The bench sample drifts slowly with the scroll.

Everything is visible in the server HTML. `gsap.matchMedia` skips all of it under reduced motion, and the context is reverted on unmount. SplitText is not used.

Elsewhere, CSS transitions handle hover, press, the palette opening and the FAQ icon rotation. Processing progress only ever comes from real pipeline events.

## Accessibility *(rev. 8 Nov)*

- Text contrast is 4.5:1 or better. Ink on canvas is about 18:1, `--subtle` about 8:1, and `--brand` text on black about 5.6:1. Large decorative text is at least 3:1.
- Focus is a 2px `--ring` outline with an offset on every control, pills included.
- Touch targets are at least 44px for actions and 32px for dense footer links. The phone tab bar is 52px tall.
- One `h1` per page and a heading on every panel. Lists are real lists, tables real tables, and the palette a labelled combobox and listbox.
- Bottom tabs and the top bar are labelled navigation landmarks (`Primary`, `Workspace`). Content reserves space so the tab bar never covers the end of a page.
- Every page mounts `.site`; there is no separate editor surface any more (removed 8 November 2026).

## Responsive shell refinement (2026-11-13)

The public frame uses one grid with a 240px expanded sidebar and 76px collapsed
rail; the content column is minmax(0,1fr), and the footer lives inside it. Hover
never changes column width. Below 1280px the default is the collapsed rail; an
explicit expansion reserves space. Below 1024px navigation uses a native modal
drawer with backdrop, Escape, focus return and document scroll lock. A stored
rf-sidebar-collapsed preference is applied before paint and synchronized after
client navigation. The existing Dojo palette, Geist type and tonal pill controls
remain unchanged. Page and footer horizontal padding use --page-inset (24px on
desktop, 20px mobile), with 24px panel gaps and 32px section/footer spacing.

## Reference capsule navigation (2026-11-13)

Supersedes the earlier sidebar geometry: expanded column 240px / capsule 216px;
collapsed column 84px / capsule 60px. Columns reserve their own grid space. The
logo is centered independently above the capsule with a 20px gap; the explicit
toggle sits below it. Capsule padding is 8px and radius 32px; each row is 48px,
with a 20px Lucide outline, 1.75 stroke, 12px icon/label gap and pill corners.
Icon coordinates inside the capsule do not change between states. Collapsed
links retain accessible names and show labels on hover or focus.

Light mode uses white capsule, #766f65 neutral ink, #f3eee6 hover and #211c17
active pill with white text. Dark mode uses #252527 capsule, #babac2 neutral ink,
#353438 hover and #f6f6f7 active pill with charcoal text. Sidebar-specific tokens
never alter the rest of the application's theme. Active state also increases
font and icon weight. Existing 1280px compact default and 1024px mobile-drawer
breakpoints, preference storage, reduced motion, page gutters and footer grid
are retained. The mobile drawer reuses the expanded capsule and keeps individual
tool navigation below it, with 44px minimum touch targets.

## Hover navigation and motion (2026-11-13)

This supersedes manual resize/reclaim behavior. Desktop reserves a stable 240px
sidebar slot at all widths >=1024px, while the visible capsule defaults to 60px.
Hover-capable mouse entry expands it to 216px after 100ms; leaving schedules a
collapse after 300ms. Internal pointer movement does not reschedule. Re-entry
cancels collapse. Focus on a navigation link expands immediately and holds the
capsule until focus leaves and the pointer is outside. The separate toggle works
with touch and keyboard; an explicit collapse remains possible. Mobile still
uses the native dismissible drawer. Width changes are local to the capsule, not
the page grid. Old manual-width preferences are no longer read or overwritten;
every new page defaults compact without first-paint script mutation.

`public-motion.css`, scoped to `.site`, owns semantic timing: press 100ms,
feedback 140ms, labels 150ms, menus 160ms, dialogs 200ms, drawers 240ms,
sidebar 250ms and disclosure 260ms. Entrances use the existing ease-out; reversible
width/height changes use cubic-bezier(.4,0,.2,1). No overshoot, synthetic progress,
large-media transform or route-wide entrance cascade. CSS opacity feedback marks
messages, measured-result controls and working status; reduced motion removes
movement/animation including backdrops. Runtime Motion/GSAP is not required.

## Live LLM Dojo correction (2026-11-13)

Supersedes earlier capsule measurements. Live Chrome inspection verified a dark
#131315 capsule, #f6f6f7 active pill, #0a0a0b active ink, #babac2 muted ink and
#1c1c1f hover. Use the measured 208px expanded / 56px collapsed widths, 6px capsule
padding, 28px radius, 44px item height and 8px row gap. Icons remain 20px with a
consistent 1.6 Lucide outline, 12px label gap and identical local coordinates.
The original live values differ from the brief's suggested starting estimates;
measured geometry takes precedence. See docs/dojo-sidebar-comparison.md.

Desktop capsule origin is 24px inside the application frame's left edge; logo
and navigation are separated by 16px. A reserved 232px grid column keeps the
208px expanded capsule clear of the content gutter and leaves page geometry
unchanged on hover. Entry delay is 100ms, exit 250ms, width 220ms, labels 140ms.
The permanent fine-pointer collapse button is hidden, with its keyboard-focus
presentation retained; coarse pointers keep a visible tap toggle. Hover/focus
remain primary desktop affordances. Mobile reuses the same capsule in the native
drawer with 44px touch rows. Light mode remains separately themed.
The independent RF mark stays centered above the collapsed icon lane in both
states, matching the live reference; expanding the capsule does not move it.

## Dynamic sidebar grid (2026-11-13)

Supersedes the permanently reserved sidebar slot. On desktop >=1024px, .app-frame
has --rail-width:72px; its existing data-sidebar="expanded" state changes it to
224px. Grid tracks are var(--rail-width) minmax(0,1fr), transitioning together over
the existing 220ms motion token. The main column has width:100% and min-width:0;
header, page and footer inherit it without independent width calculations. The
capsule fills its column's content box after 8px side padding: 56px collapsed,
208px expanded. It has no second width animation and no translate/scale substitute.
The logo stays fixed over the icon lane and icons retain local alignment.

The shell is a named inline-size container. Homepage columns stack when available
workspace width falls below 900px, rather than relying on viewport width alone.
The bench also stacks inside a narrow main homepage column. ToolSurface responds
to its actual container below 860px; stacked action footers stay in normal flow.
Reading text retains intentional ch-based limits. Footer columns and header use
the same grid column and gutters. Below 1024px the sidebar consumes no grid track;
mobile continues to use a modal navigation drawer. Hover/focus/touch timing,
colors, active states, reduced motion and processing engines remain unchanged.

## Shared header/content separation (2026-11-14)

The public shell owns --header-content-gap:var(--space-5) (20px) on .site.
Its #content flex item has margin-block-start using that token; flex-item
margins do not collapse. Every main has zero top padding, retaining the shared
horizontal insets and bottom padding. This supersedes earlier main top-padding
specifications. The header stays sticky and in normal document flow; no fixed
header offsets or per-page top margins are needed. At desktop frame origin
24px, header height is 68px, header bottom is 92px, and main starts at 112px.
Mobile header height is 60px and main starts at 80px. Both have a 20px gap.
The desktop action cluster does not shrink or wrap; search absorbs available
width changes, preserving header height during sidebar expansion. Sidebar
state, allocation, motion, mobile drawer and all tool processing stay intact.

## Header/scroll-region architecture (2026-11-14 correction)

Supersedes the preceding margin-based header/content specification. The public
shell is a viewport-height grid with two rows: the normal-flow visible header
and a minmax(0,1fr) content scroller. Its row-gap is the sole authority for
--header-content-gap (20px). #content has no compensating top margin or padding.
Desktop shell height is viewport minus the existing 24px frame insets; mobile
reserves the fixed bottom tabs and safe area. Only .shell-scroll scrolls; it
contains both page content and footer. Overflow clips content at its own top,
so content cannot paint behind the header or into the protected gap. The header
is relative, not sticky, and remains visible because it is outside that scroller.
At 1900x1000 the header is y24-92 and the content scrollport starts at y112.
Offscreen descendants may have negative bounding coordinates during scrolling;
the painted content boundary is the scroller, not an offscreen main rectangle.
The focusable named Page content region supports keyboard scrolling. Sidebar
hover expansion still changes horizontal grid allocation, with no vertical jump.

## Spacing scale and unslop pass (2026-11-15)

Audit method: [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky (CC BY 4.0), run on all 35 public routes
at 1920, 1440, 1280, 1024, 768, 390 and 375px (`tests/e2e/ui-sweep.e2e.mjs`). The verdict was light slop: no emoji, no
hue gradients, no glows and no looping motion. Polish mode kept the palette, type, layout and visuals.

- **Spacing:** every margin, padding and gap in the shell, tool surface and Command Center sits on the 4px scale
  (`--space-1` 4 … `--space-8` 32). Exceptions that exactly centre a child stay: the rail capsule's 6px padding, the
  logo badge and keycaps. Do not add `rem` fractions such as `.35rem`; use a token.
- **Type:** emphasis tops out at 600 (`strong`/`b`), and the logo badge is 600. Small mono meta (`.meta`) has zero letter
  spacing; negative tracking is for headings of 20px and up only. Headlines have no trailing period.
- **Controls:** native checkboxes are 18px in the accent colour, inside a label that is the touch target.
- **Tool header:** the privacy badge and the format list share one baseline row (`.tool-meta` owns the spacing).
- **Directory:** one card per row when the workspace is 600px or narrower; tool badges never wrap.
- **Command Center below 1024px:** the section rail is in normal flow (`top:auto`). The desktop sticky offset used to
  push it 112px over the content.

Subtitle Studio and the zoomable waveform use the same tokens. Their panels follow the tool surface: raised panel,
sunken rows, 36–44px controls, mono figures for times, and keycaps for shortcuts.

## Document scrolling (2026-11-15, supersedes the 2026-11-14 scroll-region architecture)

The browser document owns vertical scrolling, as in the LLM Dojo reference. Its native scrollbar sits at the viewport's
right edge, outside the rounded frame.

- **Root cause of the inset scrollbar:** `.shell-content` was pinned to the viewport height (`100dvh`, minus the 24px
  frame insets on desktop), and `.shell-scroll` inside it had `overflow:auto`. That region was the only scroller, so its
  scrollbar was drawn inside the frame.
- **Now:** `.shell-content` grows with its content (`min-height` fills the frame); `.shell-scroll` is `overflow:visible`
  and is no longer a focusable region. Keyboard scrolling is the document's own.
- **Header:** `.top-bar` is `position:sticky; top:var(--frame-inset)` on desktop, and `.mobile-header` is sticky at 0. A
  `::after` strip the height of `--header-content-gap`, in the header's own background, keeps the 20px gap clear while
  content scrolls beneath it. Resting geometry is unchanged: header y24–92, content from y112.
- **Rail:** `.rail-sticky` is sticky at `--frame-inset`, so the capsule never moves.
- **Corners:** on desktop a fixed, non-interactive `.frame-mask` (z-index 48, below top-layer dialogs) paints the page
  colour outside a rounded rectangle at the frame inset, so all four frame corners stay rounded while the page scrolls.
- **Anchors:** `scroll-padding-top` is 112px on desktop and 80px on phones, so `#workspace` and `#how-to` land below
  the header.
- **Scrollbar:** native, `scrollbar-width:thin`. Colours: thumb #4a4a52 on #0a0a0b in dark, #b3a795 on #faf7f2 in
  light. Overlay scrollbars stay overlay. No `scrollbar-gutter`: every public page scrolls, so no shift was measured.
- **Unchanged:** dialogs (palette, drawer) are top-layer; the drawer still locks scrolling with `html.navigation-open`.
  Inner scrollers that need their own scrolling (palette list, caption list, menus) keep it.

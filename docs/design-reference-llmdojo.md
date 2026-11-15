# Design reference: LLM Dojo (llmdojo.dev)

Studied 8 November 2026 as a reference for the Reel Finisher public redesign. LLM Dojo is a free AI-engineering course and interview-prep site. It is a reference for **principles**, not a source of brand, copy or assets. Nothing from it was copied into the product.

Evidence comes from three sources:
- computed styles and stylesheet rules read in a live Chromium tab (`getComputedStyle`, `document.styleSheets`);
- the DOM;
- full-page captures at 1440 and 390 px of `/`, `/interview` and `/curriculum`.

The captures are stored outside the repository build in `output/design-reference/` (`llmdojo-home-1440.png`, `llmdojo-home-390.png`, `llmdojo-interview-1440.png`, `llmdojo-curriculum-1440.png`). They are reference material and are not shipped.

Labels: **Verified** means read from CSS or the DOM. **Estimated** means inferred from screenshots. **Unknown** means not observable.

## 1. Design philosophy

The site behaves like an application, not a brochure. Every block on the homepage is a working entry point into real content, and almost every block carries a real number or a real data picture:
- "492 questions", "0 of 8 topics · 24 min", "78 junior · 224 mid · 190 senior";
- an XOR decision-boundary plot, tokenizer bar charts, an embedding scatter.

There are no testimonials and no decorative illustrations. The hierarchy comes from **tone steps and type weight**, not borders, gradients or shadows. Accent colour is scarce. It appears on short status lines ("Free, no paywall", "Module 01"), the logo dot and the data marks.

Principles worth carrying over:
1. **Show the product's real output as the picture.** Each card's image is a small, labelled, real chart of what the lesson contains.
2. **Numbers that are true and countable.** Counts, durations and levels act as metadata, set small and often in mono.
3. **One clear primary action per block.** The primary is a dark, solid pill; the secondaries are flat pills on a lighter tone.
4. **Panels, not lines.** Content sits in borderless rounded panels on a slightly different tone from the page.
5. **Search is first-class.** A wide search pill sits at the top of every page, with a visible `⌘K` and suggested queries.
6. **Dense but calm.** Body text is 14–16px; headings are modest (32px h1) and tight. Whitespace comes from consistent panel padding, not huge section gaps.

## 2. Colour (Verified, from `:root` custom properties)

The site ships a dark default with a light theme behind `:root[data-theme="light"]`. The live tab rendered dark; Firecrawl's captures rendered light.

| Token | Dark (default) | Light |
|---|---|---|
| `--background` | `#0a0a0b` | `#faf7f2` |
| `--surface` | `#131315` | `#ffffff` |
| `--surface-2` | `#1c1c1f` | `#f3eee6` |
| `--border` | `#27272b` | `#e6ded1` |
| `--foreground` | `#f6f6f7` | `#1f1a14` |
| `--muted` | `#babac2` | `#6b6256` |
| `--accent` / hover | `#f2a65a` / `#f5b97a` | `#a64f0c` / `#8a4109` |
| `--ring` | `#f5b97a` | `#a64f0c` |
| success / info / warning / danger | `#b5e48c` / `#8fd6b4` / `#fbbf24` / `#f87171` | `#46720e` / `#1f7a5a` / `#8a5a00` / `#b42318` |
| chart inks | amber `#f2c14e`, coral `#f28c6b`, lime `#b5e48c`, mint `#8fd6b4`, sand `#b8a98a`, cream `#f3e9d2` | darker counterparts |

The palette works through three near-black steps (background, surface, surface-2) that are only about 8–10 levels apart, plus one warm accent. The border colour exists but is rarely visible: it appears on inputs, `kbd` and dialogs only.

## 3. Typography (Verified)

- **Families:** `Geist` for everything, and `Geist Mono` for keyboard keys, progress counters ("0/8", "0 of 8 topics · 24 min") and the captions inside data pictures. Both are variable fonts (weights 100–900).
- **h1:** 32px / 40px, weight 600, tracking −0.8px (−0.025em). The light capture at 1440 shows a larger, roughly 40px hero h1 (Estimated; responsive step).
- **h2 (panel titles):** 20px / 27.5px, weight 600, tracking −0.5px. Smaller panel h2s are 16px / 24px, weight 600.
- **Body:** 16px / 24px. Lead copy is about 16–17px in muted colour (Estimated). The status line above titles is 14px / 20px, weight 500, in the accent colour.
- **Buttons:** 14px / 20px. The primary is weight 500; secondaries are 400.
- **Mono metadata:** 12px in muted colour. Chart captions are 6.5–8.5px (decorative-scale, inside images). `kbd` is 10–11px Geist Mono with a 0.8px border, 4px radius and `0 4px` padding.
- **Overall:** a single family, few sizes (32 / 20 / 16 / 14 / 12), weight 600 for every heading, negative tracking only on headings.

## 4. Layout and composition

- **App frame (Estimated from captures):** the whole page sits in a large rounded canvas (about 32px radius) inset roughly 24px from the viewport, one tone off the page.
- **Desktop shell:**
  - a floating, icon-only **navigation rail** (a pill column, about 56px wide) on the left;
  - a top bar with a wide **search pill** (about 448px) carrying `⌘K`;
  - a theme toggle and a "Sign in" pill grouped on the right.
- **Homepage:** a 12-column grid with `lg:col-span-8` main and `lg:col-span-4` side columns (Verified class names). The main column holds the hero panel, with the current module nested inside it, then the module panel with three lesson cards. The side column holds Review, Playground and Interview-prep panels.
- **Interview page:** three columns.
  - Left: a grouped topic index with uppercase group labels and right-aligned counts; the active row has a tonal fill.
  - Centre: the title, a lead with real totals, tab pills with counts, a full-width search field, filter pills with coloured level dots, and expandable question cards.
  - Right: a sticky summary panel with a big count, per-level bars with numbers, and one primary action.
- **Panels:** `rounded-3xl` (24px), `bg-surface`, padding `p-5 sm:p-6` (20/24px), no border, no shadow (Verified classes). Cards nested inside panels use a lighter or darker step and a 16–20px radius (Estimated).
- **Gaps:** `gap-4 lg:gap-6` (16/24px) between panels (Verified). On the homepage the panels tile, so there are no large empty section bands.
- **Content width:** the frame fills the viewport with about 24px insets. Text measures stay under about 75ch through panel widths.

## 5. Components

| Component | Observation | Status |
|---|---|---|
| Primary button | `h-10 rounded-full px-5 text-sm font-medium bg-foreground text-background hover:opacity-90`, `transition duration-200` | Verified |
| Secondary button | `h-10 rounded-full px-5 text-sm bg-surface` or `bg-surface-2`, `hover:bg-border` | Verified |
| Full-width panel action | Pill spanning the panel width ("Open the playground", "Practise all 492 questions") | Verified (captures) |
| Search trigger | `h-11 rounded-full` pill on the surface tone, 16px icon, "Search" text, mono `⌘K` kbd | Verified |
| Command palette | Native `<dialog class="pop">`, `w-[min(42rem,calc(100vw-2rem))]`, `mt-[10vh]`, `rounded-2xl border border-border bg-surface`, shadow `0 24px 80px -16px rgb(0 0 0 / .3)`. Contents: input "Search lessons and terms…" with Cancel; a "Try" row of suggestion chips; "Jump to a lesson" listbox; footer `↑ ↓ move · ↵ open · esc close` | Verified |
| List row with count | Label left, muted count right, chevron, separated by a hairline inside a panel | Verified (captures) |
| Progress | Segmented bars (one segment per topic) and thin rounded bars with mono `0/8` | Estimated |
| Filter pills | Selected: filled tonal pill. Unselected: text with a coloured status dot | Estimated |
| Expandable card | Question number, level dot and label, title, and a round chevron button on the right; `details` content animates height | Verified (CSS) / Estimated (look) |
| Logos row | Small 36px rounded tiles holding brand marks, then "and 52 more" | Estimated |
| Mobile tab bar | Fixed bottom bar: Home, Learn, Interview, Playground, Search, each an icon over a label | Verified (390 capture) |

## 6. Iconography (Verified from inline SVG)

- **Not Lucide** (no `lucide-*` classes). It is a small custom set of inline SVGs on a **20×20 viewBox**, `fill="none"`, `stroke="currentColor"`.
- **Stroke widths:** **1.6** for most icons (navigation, search, theme), **1.8** for a few small 16px glyphs, and 1px for hairline art. Caps and joins are round.
- **Sizes:** `size-4` (16px) inside the search pill and buttons; `size-5` (20px) in the rail and toggles; 22px in the mobile tab bar.
- **Style:** outlined only, with no filled icons except the active rail item, which is shown by a filled circular background, not a filled glyph.
- **Meaning without noise:** icons appear in navigation, search, the theme toggle, the lock on "Review", chevrons and the mobile tabs. Content cards carry real data pictures instead of icons. Status uses small coloured dots.

## 7. Interaction and motion (Verified CSS)

- Hover changes background tone (`hover:bg-border`) or opacity (`hover:opacity-90`) over `transition duration-200`. There is no transform on buttons.
- Focus uses `--ring` (`#f5b97a`), a light amber, as an outline. The exact width was not read: Unknown.
- **Page transitions:** View Transitions, `::view-transition-new(*.page)` with `page-in` over 0.18s on `cubic-bezier(.2,.8,.2,1)`; the old page goes to opacity 0.
- **Details:** `details::details-content` animates height over 0.24s on the same curve (`interpolate-size`-style).
- **Dialogs and drawers (`.pop`, `.drawer`):** opacity and scale over 0.18s ease-out, translate over 0.26s.
- **Reduced motion:** a global `transition-duration: .01ms !important; animation-duration: .01ms !important`.
- **Theme switch:** transitions are suspended while switching (`[data-theme-switching]`).
- **Keyboard:** `⌘K` opens search (a synthetic event did not trigger it, which is consistent with a trusted-key listener). The palette footer documents ↑ ↓ ↵ esc.

## 8. Responsive behaviour (390 capture)

- The rail and the top search disappear. A **bottom tab bar** carries navigation and Search. The top keeps the logo and the theme and sign-in pill.
- Panels stack in one column at full width with 16px insets. Cards inside panels switch from a 3-up grid to rows, with the picture left and the text right.
- Hero buttons wrap. The primary stays first and full-strength, and the secondaries wrap beneath.
- List rows truncate long labels with an ellipsis and keep the counts visible.

## 9. Translation to Reel Finisher

| LLM Dojo principle | Reel Finisher translation |
|---|---|
| Real data pictures on cards | Tool cards and category panels show **real interface fragments or real media facts**: formats in, format out, limits, where it runs. The homepage keeps the real compression bench. |
| True counts as metadata | Tool counts per category, model download sizes, file limits and formats, set in Geist Mono. No invented usage numbers. |
| Panels on tone steps, few lines | Black (`#08090b`) page, `#0d1015` and `#121720` panels with a 20–24px radius and no borders. Borders only on fields, `kbd` and dialogs. |
| One family, few sizes | Geist plus Geist Mono (vendored, OFL), replacing the system stack and Mukta display face on public pages. Headings use weight 600 with negative tracking. |
| Search pill with `⌘K` in the top bar | A persistent top bar with a search pill that opens the existing Command Center palette, plus "Try" suggestion chips in the palette. |
| Icon rail and bottom tabs | Keep the labelled tool sidebar (Reel Finisher has about 30 destinations, more than five sections). Tighten it to Lucide at 1.75 stroke, 16/20px. Phones get a bottom tab bar: Home, Tools, Command, Search. |
| Primary pill = foreground colour | The Reel Finisher primary stays **orange** (brand). Secondary pills sit on the surface tone; blue marks selection and focus. |
| Accent status lines | A short meta line under titles (not an eyebrow above them), so the house rule against eyebrows still holds. |
| 0.18s page and dialog motion, details height animation | The same timings and curve, with no scroll-choreography beyond what exists. Reduced motion respected. |

What Reel Finisher did not take in pass 1, though pass 2 now does (see section 10): the light theme and the warm cream palette. Still not taken: company-logo social proof (Reel Finisher has no such evidence), the sign-in model, and custom icon drawing (Lucide is the system).

## 10. Implementation findings (8 November 2026, pass 2)

The user superseded section 9's "keep Reel Finisher's palette" decision. Reel Finisher now uses the verified LLM Dojo palette directly, in both dark (default) and light themes. The following findings came out of applying it:

- **Dark elevation is inverted.** The reference's dark header and canvas use `surface-2` (`#1c1c1f`), and panels use the darker `surface` (`#131315`). Using a near-black frame made panels disappear, so the frame was set to `#1c1c1f`, matching the reference.
- **Icon weight.** The reference's 1.6 stroke on a 20px grid corresponds to about 1.9 on Lucide's 24px grid. That is the value applied.
- **Theme attribute.** The reference toggles `data-theme` on `<html>`. Reel Finisher uses `data-site-theme`, because the embedded OpenReel editor already uses `data-theme`.
- **Field contrast.** The reference's field borders use `--border` (`#27272b`), which is below 3:1 against the surface. Fields keep that border at rest and gain `--edge-strong` (`#62626b`) on hover, with the amber ring on focus.
- **Metadata size.** 12px mono metadata follows the reference. The Taste inspector flags it as small text; it is kept because the brief specifies it.

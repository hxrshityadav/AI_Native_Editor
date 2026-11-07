# Incumbent public design — independent assessment A

Method: isolated design review by `/root/design_before`, completed before reading detector output. Reviewed PRODUCT.md, docs/redesign-audit.md, the Impeccable and Taste Skill critique references, homepage/shared shell source, and every supplied before screenshot. No detector findings or report.json were read. No browser interaction or processing-state verification was performed in this assessment. Studio, Studio Legacy and Lab are excluded.

## Specificity verdict

The interface is coherent but interchangeable. A near-black canvas, green icon chips, rounded utility cards and a persistent catalog sidebar say “generic tools application.” Covering the small yellow RF wordmark removes almost all recognizable product identity. The genuinely useful subject—finishing a local file and inspecting its measured result—is described in text but never made visible. No media, before/after result, waveform or working demonstration appears in the supplied homepage captures.

## Taste Skill round 0

Seen in one second: a long tool list, with a headline stranded near the bottom on desktop.

Idea (one sentence): a private browser toolbox, expressed as a catalog rather than as an actual finishing experience.

Live thing: search and navigation are available; the homepage does not expose processing or a result to inspect.

Layout words by section: hero=unequal split / start=long list / AI=card grid / video=card grid / audio=card grid / photos=card grid / footer=small text row.

Scores: design 4.5 · usability 6.0 · creativity 3.0 · content 7.0 → overall 4.9.

Caps applied: category-interchangeable concept caps creativity at 6; no real pictures caps design at 6.5; desktop blank ground taller than half a screen caps design at 6.5; three-line mobile headline and visible decorative borders cap overall at 6.5. These caps do not raise the lower scores. Motion and inspector failures were not assessed.

Top three problems, most visible first:

1. `desktop-fold.jpg`: the headline begins around y=600 while the right-hand list begins near y=56. Most of the central first screen is empty. Centering the introductory column against the height of the complete catalog makes the visitor wait for the proposition and clips the actions at the fold. Replace the exhaustive hero list with a compact set of choices and a substantial working media area; align the introduction with the top of that composition.
2. `mobile-page-01.jpg` and `tablet-page-01.jpg`: the “Start with a tool” list consumes multiple screen lengths before category discovery, then the same offerings appear again as cards. Show a few primary media choices and a direct directory/search destination; make the complete catalog belong to the directory.
3. `desktop-page-01.jpg`, `desktop-page-02.jpg`, `mobile-page-01.jpg`: the sections differ only by labels. Green icon chips, outlines and dark rounded rectangles repeat without showing what users can make. Introduce a real source/result demonstration, clear medium-led discovery and a compact readable index; preserve the useful capability descriptions without packaging every line as another identical card.

## Design health — Nielsen heuristics

Scores are 0–4. These describe the captured discovery surface, not untested media tools.

| # | Heuristic | Score | Evidence / limitation |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Home has an active sidebar treatment; no processing state is shown. |
| 2 | Match with the real world | 3 | Familiar task labels; secondary descriptions introduce WebCodecs, RNNoise, DSP and SpeechT5 before the visitor needs implementation detail. |
| 3 | User control and freedom | 3 | Direct tool and Studio links, plus a directory destination; interaction recovery was not exercised. |
| 4 | Consistency and standards | 3 | Repeated link/card patterns are predictable, though “Compress Video” and “Video Compressor” vary between discovery contexts. |
| 5 | Error prevention | n/a | No file-input or configuration state is supplied. |
| 6 | Recognition rather than recall | 2 | Text labels help, but the ungrouped opening catalog mixes media and requires scanning many sibling choices. |
| 7 | Flexibility and efficiency | 2 | Desktop search is visible; the homepage duplicates the full directory and the phone requires prolonged scrolling to category sections. |
| 8 | Aesthetic and minimalist design | 1 | Empty desktop opening region and exhaustive duplicate lists spend attention without adding useful evidence. |
| 9 | Error recovery | n/a | No errors or recovery flow are supplied. |
| 10 | Help and documentation | 3 | Descriptive capability limits, formats, privacy and notices are present, but useful caveats are dispersed through cards. |
| Total | | **20/32** | **Usable foundation; substantial discovery and composition problems.** |

## What works

- `mobile-fold.jpg`: the promise is understandable, both primary destinations are explicit, and action targets have comfortable visible size. The phone opening reads more clearly than the desktop opening.
- Card descriptions make honest distinctions such as stereo DSP versus neural separation, optional local models and selectable PDF text. These support trust and must survive editing.
- `tablet-fold.jpg`: consistent outer margins, a readable title, and restrained color provide a sound basic structure. The same quiet surface treatment can support stronger media and typographic hierarchy.

## Priority issues

1. **P1 — Repair desktop first-screen composition.** The large central hole and low title make the page look unfinished and hide the most useful action. Replace the hero's all-tools column with a bounded useful experience, top-align the proposition, and show an action entirely above the desktop fold. Suggested commands: `$impeccable layout`, `$impeccable shape`.
2. **P1 — Remove the duplicate catalog from the opening flow.** The long “Start with a tool” stack precedes another complete catalog on phone and tablet. Offer medium/task entry points with immediate search or directory access, then use selected meaningful discovery on the homepage. Suggested commands: `$impeccable distill`, `$impeccable adapt`.
3. **P1 — Give the product a visible subject and recognizable visual language.** No actual media or result appears anywhere in the homepage sheets. Compose a real working local-file fragment around source/result, measured bytes or another truthful output; use deliberate self-hosted typography and restrained brand accents. Do not invent performance claims or proof. Suggested commands: `$impeccable shape`, `$impeccable typeset`.
4. **P2 — Replace uniform containers with an information hierarchy.** Four consecutive category card grids flatten importance. Use medium-led sections, compact task indexes and richer treatment only where real media or interaction earns it. Keep capability caveats available at decision time. Suggested commands: `$impeccable layout`, `$impeccable clarify`.
5. **P2 — Rebalance reading density and secondary text.** There is ample blank opening space on desktop while explanatory and legal text becomes small and grey lower down. Increase secondary-text readability, reduce repeated preambles, and avoid small format chips as the only visible output evidence. Actual contrast and zoom behavior require separate measurement. Suggested commands: `$impeccable typeset`, `$impeccable polish`.

## Cognitive load and emotional journey

Checklist failures: single focus, chunking, hierarchy, one decision at a time, minimal choices and progressive disclosure. Related items are visually grouped, and there is no demonstrated cross-screen memory burden. The opening list presents far more than four sibling options; categories below then expose six or ten similar cards apiece. This is high extraneous load for a visitor with one file and one desired outcome.

The local/no-account/no-watermark assurances create an encouraging start, especially on mobile. Confidence then flattens into repetitive navigation without a product moment. The ending is merely the final utility card and policy links. A useful demonstration could provide a real peak: select a file, understand a change, see a measured result. That is stronger evidence than extra reassurance badges.

## Persona red flags

- **Jordan, first-time visitor:** the headline promises photo and video, but the first recommended item is PDF to Audio and the next is Lecture to Notes. The list mixes purposes without explaining a sensible first choice. Tool names such as Vocal Remover versus Remove Music need clear distinctions close to selection.
- **Casey, distracted mobile visitor:** after the two clear hero actions, a multi-screen flat list postpones grouped browsing. The visible Menu button is comfortable, but its contents and keyboard behavior were not tested. No overflow is apparent in the supplied captures.
- **Alex, returning creator:** the persistent desktop catalog and search can make a known tool quick to find. The center of the homepage nevertheless repeats this navigation twice rather than providing a task, recent context or useful product demonstration.

## Smaller observations and limits

Yellow is confined to the small logo while green repeats across almost every utility; the accent expresses category sameness more than a clear action hierarchy. Mobile typography and spacing hold together without obvious lateral clipping. The footer remains appropriately practical. The Next.js development indicator and “Compiling” badges visible in several sheets are capture artifacts, not evidence of a product processing-status defect.

All eight supplied images were inspected: desktop-fold.jpg, desktop-page-01.jpg, desktop-page-02.jpg, mobile-fold.jpg, mobile-page-01.jpg, mobile-page-02.jpg, tablet-fold.jpg and tablet-page-01.jpg. These capture the homepage only; no claim of screenshot-based tool-workspace, error-state, keyboard, contrast or actual-device verification is made.

Questions skipped: the user has already authorized the redesign; this independent baseline feeds the parent assessment and implementation rather than reopening the brief.

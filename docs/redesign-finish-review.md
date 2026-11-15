# Redesign finish review

## 1. Disposition: FIX

The approved Finishing Bench direction is implemented coherently and does not need a rebuild. One material responsive issue needs a targeted correction before accepting the finish: the sticky speech action bar overlaps the stacked controls on mobile. Recapture the corrected speech workspace; retain the approved direction. This is visual implementation acceptance, not production release certification.

## 2. Capture validity

Reviewed the actual existing production PNGs with `view_image`, without opening a browser: `--1440.png`, `--390.png`, `home-result-webp.png`, `home-result-png.png`, `-tools-image-compressor-1440.png`, `-tools-image-compressor-390.png`, `-tools-text-to-speech-1440.png`, `-tools-text-to-speech-390.png`, `-tools-pdf-to-audio-1440.png`, `-tools-pdf-to-audio-390.png`, `-tools-noise-remover-390.png`, `-tools-shorts-maker-1440.png`, `-tools-390.png`, and `-privacy-1440.png`, all under `output/redesign`. Also inspected `.impeccable/mocks/option-a-finishing-bench.png`.

These are useful full-page captures with legible real content and resolved assets. No loading skeleton, missing image, blank reveal band, or route error is visible. The tools catalog image was scaled by the image viewer from 390x6254 to 374x6000; this does not affect the structural observations. Sticky-position artifacts in full-page captures must be judged against their actual viewport behavior; the speech overlap is supported by the underlying sticky CSS and is actionable, rather than a missing source control.

`output/redesign-browser-final.log` records 81/81 checks: 33 public routes render, one heading and no horizontal overflow at six widths, no browser exceptions or automatic model/editor downloads, valid downloaded and decoded WebP/JPEG/PNG outputs, measured results, lossless quality disabled, stale-result invalidation, retry recovery and cancellation recovery. This review relies on that recorded browser evidence and did not independently rerun it. The source detector exited 0 with 53 advisory findings; that is mechanical source evidence, not visual approval. No successful Impeccable phase toolchain run is claimed: the engine arrived late and the framework evidence remains degraded/documented.

## 3. Comp and design fidelity

The dominant landscape and adjacent controls preserve Option A's central working-media composition. Charcoal layers, amber next actions, restrained navigation, a compact display face and readable system body text carry across the inspected public tools and reading pages. The actual RF mark, measured byte counts and explicit generated-sample label appropriately replace fictitious concept details. The unloaded homepage does not pretend a result exists.

The production homepage is quieter below the bench than the mock: selected tools are readable editorial links rather than media-heavy cards. This remains consistent with the pinned surface brief's requirement for category discovery and selected working tools, and avoids inventing demonstrations for unrelated engines. Mobile has a clear two-line headline, visible destinations, a proper portrait composition and stacked bench controls. No direction change is justified.

ROUND 1

Seen in one second: the landscape working bench.

Idea (one sentence): a private browser workbench where the visitor can convert real media and inspect the measured output.

Live thing: an actual conversion with a draggable image comparison and downloadable output.

Layout words by section: hero=statement / bench=split workspace / discovery=index / privacy=split explanation.

Scores: design 8.0 · usability 7.0 · creativity 7.5 · content 8.0 → overall 7.6.

Caps applied: usability remains at 7 because of the mobile speech overlap. The generic four-photo/motion criteria are superseded by the pinned product direction, which explicitly rejects extra decorative media. Informative step numbers describe a real sequence. These scores judge the inspected public finish, not all processing workflows.

## 4. Prioritized material findings with evidence

1. **P1 — Keep the speech action after its settings in the stacked layout.** In `output/redesign/-tools-text-to-speech-390.png`, Generate speech appears immediately below the textarea, the Voice field is absent from view, and the capability note resumes at “Up to 500 characters” below the action. The consent checkbox is also below the action, followed by substantial empty panel space. The desktop capture correctly shows Voice, the complete caveat, consent, then Generate speech. Read-only source inspection confirms `LocalSpeech.tsx` still renders those controls in that order; `ToolSurface.module.css` leaves `.sideFoot` sticky with `bottom: 0` when `.surface` becomes a single column at 1100px. The sticky footer overlaps the beginning of `.sideBody`. Disable or otherwise contain that sticky behavior in stacked workspaces so the complete settings and consent precede the action without being covered. Verify keyboard reachability and visibility of Voice and consent at 390, 768 and 1024, then replace the mobile capture. Apply the shared fix carefully because other loaded tool workspaces use the same surface.

No additional blocking visual finding is evidenced by the inspected captures. The larger PNG result correctly says “482.6% larger”; its green status treatment is a minor tonal ambiguity, not grounds to reopen the finish.

## 5. Acceptance and limitations

Accept the direction, page hierarchy, public visual system, homepage real-result treatment and inspected tool entry states. Accept the finish after correcting and recapturing the stacked speech controls. Preserve the existing engines, semantics, cancellation and cleanup behavior.

Only the homepage ready/result screenshots and initial standalone tool states were visually inspected. Uploaded-file editing, full speech generation, PDF extracted-text and generated-audio states, loaded noise cleanup, Shorts suggestions/handoff, standalone error/busy/result states, drawer/focus states and real-device behavior were not visually inspected in this review. The recorded homepage checks establish its actual output/retry/cancel behavior, not those other engines. Studio, Studio Legacy and Lab are excluded. Existing production deployment, device and media-quality gates remain separate; PRODUCT.md's NO-GO release certification is unchanged.

### Final verdict pass — targeted corrections

**Disposition: SHIP for the inspected public visual finish.** This supersedes the initial FIX disposition only within this review's scope.

Inspected all four updated production captures with `view_image`: `output/redesign/speech-stacked-390.png`, `speech-stacked-768.png`, `speech-stacked-1024.png`, and `home-result-png.png`. This was a targeted review of the listed corrections, not a new audit of unrelated states.

- **Sticky speech overlap: RESOLVED.** At 390, 768 and 1024, Voice is fully visible; the complete capability note and model-download consent appear before Generate speech. The footer no longer covers those settings, and the former empty lower panel is removed. The recorded browser suite now passes 84/84, including elementFromPoint checks that Voice is uncovered and consent precedes Generate at all three widths. I inspected these captures rather than rerunning the browser suite.
- **Larger PNG status treatment: RESOLVED.** The updated result clearly displays “482.0% larger” in amber warning color, with measured source/output sizes and the lossless-disabled quality slider still visible. It no longer gives a green savings cue for the larger output.

The original mobile usability cap is lifted. Updated scoped scores: design 8.0 · usability 8.0 · creativity 7.5 · content 8.0 → overall 7.9. No material finding remains from this finish review. The final source detector is reported as 38 advisories and zero primary findings; this does not replace visual review or establish an Impeccable phase-toolchain pass.

Acceptance remains limited to the original inspected public captures and these targeted corrected captures. The previously listed uninspected loaded-tool, error, busy, generated-audio, focus/drawer and real-device states remain uninspected here. Existing E2E/model suites were still running at the time of this verdict and are not claimed as passed. Studio-family exclusions and separate deployment/device/media-quality release gates remain unchanged; this is not full production certification.

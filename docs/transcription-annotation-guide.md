# Annotation guide: Roman Hinglish evaluation

Use `tests/fixtures/transcription/dataset.json` as the **structural** example. Its
tone and constructed words/times are not natural speech or acoustic ground truth.
Create a separate natural dataset under ignored `output/`. Never mix synthetic
fixtures into a real-world accuracy table or commit private speech/reference text.

1. **Permission and identity.** Assign opaque recording and speaker IDs. Record
   local-use consent or a public dataset's exact source/license. Local consent does
   not grant redistribution. Do not include real names/contact details in speaker
   metadata. Accent is voluntary; unknown speaker conditions remain unknown.
2. **Files.** Keep a manifest and its dedicated audio folder together. `audio.path`
   is relative, uses `/`, contains no URL, `..`, absolute path or drive prefix.
   Record the SHA-256 of exact original bytes, plus decoded duration in seconds.
   CLI validation rejects symlink escape, missing files and mismatched bytes.
   Browser playback/inference also verifies the fingerprint. Maximum 128 MiB/file
   and ten-minute processing limit; use short recordings initially.
3. **Verbatim reference.** Write the words actually spoken in Roman script, keeping
   Hindi-English switches, names, repetitions and grammar. Do not translate, improve
   grammar or fix recognition by dictionary substitution. Preserve punctuation in
   the reference text and, preferably, each word's separate `punctuation` field.
4. **Word labels.** Each word has `text` and manually assigned `language` (`hi`,
   `en`, `other`). Borrowed/ambiguous terms need a documented consistent annotation
   policy and adjudication, not a language inferred from model spelling. Word text
   must cover the full reference in order. Multiword names/technical mentions use
   `isProperNoun`/`isTechnicalTerm` and one `entityId`/`termId` per contiguous
   occurrence. A repeated mention gets a new occurrence ID. Technical vocabulary
   is open-ended; nothing limits it to the example terms.
5. **Switches.** A boundary is before the first word whose label changes from the
   preceding word. `isCodeSwitchBoundary` is optional; if supplied, it must agree
   with the labels. Both hi→en and en→hi are evaluated. Never mark a switch from a
   prediction; that would miss a model that got the entire language wrong.
6. **Timing.** Annotate word onset/end on the original recording in seconds using
   an audio editor. Start at audible onset, stop at the end of the word, preserve
   pauses, and document your convention for adjacent/overlapping speech. This
   initial schema requires single-speaker, nonoverlapping reference word times;
   split overlapping speakers into separately reviewed recordings. Both endpoints
   are required together. Bounds must be positive-duration, ordered and inside
   audio duration. Missing timestamps stay omitted; do not distribute phrase time.
7. **Review.** Draft references may be imported for diagnostics but are not ground
   truth. A second qualified reviewer should check words, language labels, names,
   technical terms and switches. Record opaque reviewer ID and ISO review date.
   Set `reference.review.status="reviewed"` only after actual review. Set
   `timingReviewed=true` only after all word bounds are manually checked. Keep
   editor/version, annotator notes, disagreements and adjudication alongside the
   private dataset. No software validator can certify that this human review happened.
8. **Splits.** Assign train/development/test by speaker before experimentation. The
   schema rejects the same speaker across splits. Unknown IDs cannot establish
   real speaker independence. Never tune normalization, vocabulary or a model on
   the held-out test set. Compare candidates on the same version and recording set.

Target roughly 100+ **reviewed natural** recordings across different consenting
speakers, Hindi-heavy/English-heavy conversation, creator and technical speech,
fast/slow delivery, voluntary accent categories, clean/noisy environments and
different microphones. These are collection targets, not assets already available.
Short clips make annotation review manageable; add long-form stress tests separately.

Minimal review metadata:

```json
{"status":"reviewed","reviewer":"reviewer-02","reviewedAt":"2026-11-17T12:00:00Z","timingReviewed":true}
```

Only use those values when they describe an actual review. To start without word
annotations, use `words: []`, `status: "draft"`, `timingReviewed: false`. Overall
provisional WER/CER can still be measured; language, boundary and timing accuracy
remain unavailable and release gates remain INSUFFICIENT DATA.

CLI import:

```text
npm run asr:validate -- output/my-private-dataset/dataset.json
npm run asr:benchmark -- output/my-private-dataset/dataset.json --url http://localhost:3000 --models tiny,base,hinglish-swift --consent-model-downloads
```

The CLI requires a running `npm run dev`. It never uploads media. Exports contain
private reference/hypothesis text and local path identifiers; store them securely.

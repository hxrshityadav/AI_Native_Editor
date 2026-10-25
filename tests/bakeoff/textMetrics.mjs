// Transcript accuracy for the Hinglish bake-off (T-12). Pure functions.
//
// Roman Hinglish has no standard spelling ("acha", "accha", "achchha"), so two scores are reported:
// strict WER on lowercased words without punctuation, and lenient CER, which also collapses repeated
// letters and ignores spaces. A provider that writes "acchha" for "accha" loses a word in WER, not in CER.

/** Lowercase, Unicode-normalized words, punctuation removed (letters, marks and digits kept). */
export function words(text) {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Spelling-tolerant form: repeated letters collapsed ("accha" → "acha"), no spaces. */
export function lenientChars(text) {
  return [...words(text).join("").replace(/(\p{L})\1+/gu, "$1")];
}

/** Levenshtein distance between two arrays. */
export function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Word error rate of `hypothesis` against `reference` (0 is perfect; can exceed 1). */
export function wer(reference, hypothesis) {
  const ref = words(reference);
  return ref.length ? editDistance(ref, words(hypothesis)) / ref.length : null;
}

/** Spelling-tolerant character error rate. */
export function lenientCer(reference, hypothesis) {
  const ref = lenientChars(reference);
  return ref.length ? editDistance(ref, lenientChars(hypothesis)) / ref.length : null;
}

const DEVANAGARI = /[ऀ-ॿ]/;

/** Share of words still in Devanagari: should be 0 for Hinglish captions. */
export function devanagariShare(wordList) {
  return wordList.length ? wordList.filter((w) => DEVANAGARI.test(w)).length / wordList.length : 0;
}

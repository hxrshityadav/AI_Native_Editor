import { assertEnglishSpeech } from "./text";
export const DOCUMENT_TEXT_LIMIT = 5000;
export const DOCUMENT_SEGMENT_LIMIT = 100;
/** Every non-whitespace character is retained, with bounded input and model-sized segments. */
export function documentChunks(text: string): string[] {
  if (typeof text !== "string" || !text.trim() || text.length > DOCUMENT_TEXT_LIMIT) throw new Error("Select or edit 1–5,000 characters for each audio job. Process a long document in separate selections.");
  assertEnglishSpeech(text);
  let remaining = text.trim(); const chunks: string[] = [];
  while (remaining.length) {
    let end = Math.min(DOCUMENT_SEGMENT_LIMIT, remaining.length);
    const sentenceEnd = remaining.slice(0, end + 1).search(/[.!?](?=\s|$)/u);
    if (sentenceEnd >= 0 && sentenceEnd < end) end = sentenceEnd + 1;
    else if (end < remaining.length) {
      const boundary = Math.max(remaining.lastIndexOf(" ", end), remaining.lastIndexOf("\n", end));
      if (boundary > 0) end = boundary;
    }
    // Do not split UTF-16 surrogate pairs at a model boundary.
    if (end < remaining.length && /[\uD800-\uDBFF]/.test(remaining[end - 1])) end--;
    const chunk = remaining.slice(0, end).trim().replace(/\s+/g, " ");
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(end).trimStart();
  }
  return chunks;
}

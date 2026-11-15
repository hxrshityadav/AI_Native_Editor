/*
 * Script-constrained decoding for Whisper. Small multilingual Whisper models often write Hindi in Latin or Urdu script
 * even with the Hindi language token (measured on FLEURS hi_in, 2026-11-15). Banning every vocabulary token that would
 * emit letters of another script makes the decoder choose Devanagari (or, for Roman Hinglish, plain ASCII) spellings.
 * Tokens are judged by their raw UTF-8 bytes, so partial-character byte tokens are handled correctly.
 */
export type TargetScript = "devanagari" | "latin";

/** GPT-2 byte-level BPE: the printable unicode character standing for each byte. */
function unicodeToBytes(): Map<string, number> {
  const bytes: number[] = [];
  for (let b = 33; b <= 126; b++) bytes.push(b);
  for (let b = 161; b <= 172; b++) bytes.push(b);
  for (let b = 174; b <= 255; b++) bytes.push(b);
  const chars = [...bytes]; let n = 0;
  for (let b = 0; b < 256; b++) if (!bytes.includes(b)) { bytes.push(b); chars.push(256 + n++); }
  return new Map(bytes.map((b, i) => [String.fromCharCode(chars[i]), b]));
}

/** Whether a token's bytes can only produce text in the target script (plus digits, spaces and punctuation). */
export function tokenAllowed(bytes: Uint8Array, script: TargetScript): boolean {
  if (script === "latin") return bytes.every(b => b < 0x80) && !/[^\x20-\x7e]/.test(String.fromCharCode(...bytes).replace(/[\t\n\r]/g, " "));
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) { if ((b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a)) return false; continue; } // ASCII letters
    if (b >= 0x80 && b <= 0xbf) continue;                     // continuation byte: part of a character started elsewhere
    if (b >= 0xc0 && b <= 0xdf) return false;                 // 2-byte characters: Latin-1, Greek, Cyrillic, Hebrew, Arabic…
    if (b === 0xe0) { const next = bytes[i + 1]; if (next === undefined || next === 0xa4 || next === 0xa5) continue; return false; } // U+0900–097F is E0 A4/A5
    if (b === 0xe2) continue;                                  // general punctuation (…, –, ’) and currency
    return false;                                              // other 3- and 4-byte scripts, emoji
  }
  return true;
}

/** Token ids to ban for a target script. `tokens[i]` is the byte-level BPE string of id i; ids ≥ `firstSpecial` are kept. */
export function bannedTokens(tokens: string[], firstSpecial: number, script: TargetScript): number[] {
  const map = unicodeToBytes(), banned: number[] = [];
  for (let id = 0; id < Math.min(tokens.length, firstSpecial); id++) {
    const text = tokens[id]; if (text === undefined) continue;
    const bytes = Uint8Array.from([...text].map(c => map.get(c) ?? 0x3f));
    if (!tokenAllowed(bytes, script)) banned.push(id);
  }
  return banned;
}

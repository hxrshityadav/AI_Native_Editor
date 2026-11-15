import { describe, expect, it } from "vitest";
import { applySuggestions, findSuggestions, parseVocabulary, soundKey } from "@/lib/subtitles/vocabulary";
import type { Caption } from "@/lib/subtitles/captions";

// Real Hindi2Hinglish Swift output for the owner's reel (2026-11-15), split into captions.
const REEL = ["Hantic gravity se plot ka access jaane vaala hai and jaminaegi problem yah hai.", "Bina kisi aur flow and test kar sikhe.", "Iske baad yah proper work flow banaega, test kar sikhega, verify karega and saath hi subagence bhi run karega."];
const captions = (lines: string[]): Caption[] => lines.map((text, i) => ({ id: `c${i}`, start: i * 3, end: i * 3 + 3, text }));
const TERMS = parseVocabulary("Antigravity, Claude, Gemini\nsubagents, workflow, test case, Installation");

describe("vocabulary", () => {
  it("parses commas and lines, keeps casing, drops duplicates and tiny entries", () => {
    expect(parseVocabulary("Claude, claude\n  Gemini ,ok, test   case")).toEqual(["Claude", "Gemini", "test case"]);
  });
  it("folds common Hinglish mishearings into one sound key", () => { expect(soundKey("Khiladi")).toBe(soundKey("kiladi")); expect(soundKey("phone")).toBe(soundKey("fone")); expect(soundKey("Woh")).toBe(soundKey("voh")); expect(soundKey("Claude")).not.toBe(soundKey("plot")); });
  it("finds the near-misses on the real reel", () => {
    const found = findSuggestions(captions(REEL), TERMS).map(s => `${s.original} → ${s.term}`);
    expect(found).toEqual(expect.arrayContaining(["Hantic gravity → Antigravity", "subagence → subagents", "work flow → workflow"]));
  });
  it("does not touch everyday Hindi or unrelated words", () => {
    const found = findSuggestions(captions(REEL), TERMS);
    expect(found.some(s => /^(se|ka|hai|yah|aur|and)$/i.test(s.original))).toBe(false);
    expect(found.some(s => s.original === "plot")).toBe(false); // honest limit: "plot" is not a near-miss of "Claude"
    expect(findSuggestions(captions(["Aaj hum baat karenge ki kaam kaise hota hai"]), TERMS)).toEqual([]);
  });
  it("applies accepted suggestions, keeping punctuation and real word timings", () => {
    const caps: Caption[] = [{ id: "a", start: 0, end: 2, text: "Hantic gravity se, subagence.", words: [{ text: "Hantic", start: 0, end: 0.4 }, { text: "gravity", start: 0.4, end: 0.9 }, { text: "se,", start: 0.9, end: 1.1 }, { text: "subagence.", start: 1.2, end: 1.9 }] }];
    const out = applySuggestions(caps, findSuggestions(caps, TERMS))[0];
    expect(out.text).toBe("Antigravity se, subagents.");
    expect(out.words).toEqual([{ text: "Antigravity", start: 0, end: 0.9 }, { text: "se,", start: 0.9, end: 1.1 }, { text: "subagents.", start: 1.2, end: 1.9 }]);
  });
  it("leaves captions unchanged when nothing is accepted", () => { const c = captions(REEL); expect(applySuggestions(c, [])).toEqual(c); });
});

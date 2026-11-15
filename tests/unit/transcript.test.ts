import { describe, expect, it } from "vitest";
import { dropLoops, groupWords } from "@/lib/subtitles/transcript";

const words = (text: string) => text.split(" ").map((t, i) => ({ text: t, start: i * 0.3, end: i * 0.3 + 0.25 }));
describe("decoding-loop guard", () => {
  it("cuts a repeated four-word phrase (real failure on a Hinglish reel)", () => {
    const { words: out, removed } = dropLoops(words("problem yah hai. This is a problem. This is a problem. This is a problem. This is a problem. This is a problem."));
    expect(out.map(w => w.text).join(" ")).toBe("problem yah hai. This is a problem."); expect(removed).toBe(16);
  });
  it("keeps natural short repeats", () => { expect(dropLoops(words("bahut bahut shukriya")).removed).toBe(0); });
  it("cuts single-word loops", () => { expect(dropLoops(words("sky sky sky sky sky sky")).words).toHaveLength(1); });
});
describe("caption grouping from real word times", () => {
  it("breaks at sentence ends, pauses and the word limit", () => {
    const segs = groupWords([{ text: "Aaj", start: 0, end: 0.3 }, { text: "hum", start: 0.35, end: 0.6 }, { text: "seekhenge.", start: 0.65, end: 1 }, { text: "Phir", start: 2, end: 2.3 }], { maxWords: 7, maxSeconds: 3.5, pause: 0.6 });
    expect(segs.map(s => s.text)).toEqual(["Aaj hum seekhenge.", "Phir"]); expect(segs[0]).toMatchObject({ start: 0, end: 1 });
  });
});

import { expect, it } from "vitest";
import { creatorSpec, detectMoments } from "../../src/lib/localtools/moments";
const base = { version: 1 as const, duration: 60, start: 1, end: 5, shape: "9:16" as const, x: .5, y: .5, quality: "small" as const, cues: [] };
it("preserves ordered source intervals while separating moments at long pauses", () => {
  const cues = [{ start: 1, end: 3, text: "Here is the first point." }, { start: 3.1, end: 6, text: "It ends here." }, { start: 10, end: 14, text: "This is another useful moment." }];
  const moments = detectMoments(cues, 20, 8);
  expect(moments.map(x => [x.start, x.end]).sort((a,b)=>a[0]-b[0])).toEqual([[1,6],[10,14]]);
  expect(moments.every(x => x.end > x.start && x.end - x.start <= 8 && x.coverage > .9)).toBe(true);
});
it("rejects invalid/empty/outside ranges, overlapping captions and video longer than 600 seconds", () => {
  for (const value of [{...base,end:1},{...base,end:61},{...base,start:-1},{...base,duration:601},{...base,cues:[{start:3,end:4,text:"one"},{start:2,end:5,text:"two"}]}]) expect(creatorSpec.safeParse(value).success).toBe(false);
  expect(creatorSpec.safeParse({...base,start:5.01,end:65.01,duration:100}).success).toBe(true);
  expect(detectMoments([], 20, 30)).toEqual([]);
});
it("does not fabricate moments from empty/overlong or one-word speech segments", () => {
  expect(detectMoments([{start:0,end:20,text:"Hello."}],30,5)).toEqual([]);
  expect(()=>detectMoments([{start:0,end:1,text:""}],30,5)).toThrow();
});

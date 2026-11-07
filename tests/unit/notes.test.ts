import { expect, it } from "vitest";
import { lectureNotes, noteTime } from "../../src/lib/localtools/notes";
it("preserves available sub-second timestamps in notes exports",()=>{expect(noteTime(1.125)).toBe("00:01.125");expect(lectureNotes([{start:.125,end:1.375,text:"A precise source quotation."}],2).text).toContain("[00:00.125–00:01.375]");});
const cues = [{ start: 0, end: 5, text: "Photosynthesis converts sunlight to energy." }, { start: 6, end: 10, text: "Photosynthesis uses chlorophyll." }, { start: 30, end: 35, text: "Review this next topic." }];
it("preserves source quotes, timestamps and gap sections in actual TXT/Markdown", () => {
  const notes = lectureNotes(cues, 40);
  expect(notes.sections.map(s => [s.start, s.end])).toEqual([[0, 10], [30, 35]]);
  expect(notes.points.every(p => cues.some(c => c.text === p.text))).toBe(true);
  expect(notes.text).toContain("[00:30–00:35] Review this next topic.");
  expect(notes.cards[0]).toEqual({ start: 0, question: "_____ converts sunlight to energy.", answer: "Photosynthesis" });
});
it("rejects invalid/overlapping/outside/empty transcripts and preserves Indic content", () => {
  for (const invalid of [[], [{start:2,end:1,text:"bad"}], [{start:0,end:50,text:"bad"}], [cues[1],cues[0]]]) expect(() => lectureNotes(invalid,40)).toThrow();
  expect(() => lectureNotes(cues,601)).toThrow();
  expect(lectureNotes([{start:0,end:2,text:"हिंदी में सीखें।"}],3).text).toContain("हिंदी में सीखें।");
});
it("escapes Markdown instructions and deduplicates key points without dropping transcript", () => {
  const notes = lectureNotes([{start:0,end:1,text:"[image](https://example.com)"},{start:1,end:2,text:"[image](https://example.com)"}],2);
  expect(notes.points).toHaveLength(1); expect(notes.sections[0].cues).toHaveLength(2);
  expect(notes.markdown).not.toContain("[image](https://");
});

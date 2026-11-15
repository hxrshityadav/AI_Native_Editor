import { expect, it } from "vitest";
import { documentChunks } from "../../src/lib/localtools/documentText";
import { validatePdf } from "../../src/lib/localtools/pdf";
import { joinSpeech } from "../../src/lib/localtools/text";
it("joins real PCM with bounded gaps and rejects invalid/overlong output", () => {
  const audio=joinSpeech([new Float32Array([.25,.5]),new Float32Array([-.25])],1);
  expect(audio.length).toBe(1603); expect(audio[0]).toBe(.25); expect(audio[1602]).toBe(-.25); expect(audio.slice(2,1602).every(n=>n===0)).toBe(true);
  expect(()=>joinSpeech([new Float32Array(16001)],1)).toThrow(); expect(()=>joinSpeech([new Float32Array([NaN])],1)).toThrow(); expect(()=>joinSpeech([],1)).toThrow();
});
it("chunks document text without silently losing words or splitting surrogate pairs", () => {
  const text = ("A reviewed English sentence. ".repeat(25) + "😀".repeat(300)).trim();
  const chunks = documentChunks(text);
  expect(chunks.length).toBeGreaterThan(2); expect(chunks.every(c => c.length <= 100)).toBe(true);
  expect(chunks.join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
  expect(chunks.every(c => !/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(c))).toBe(true);
});
it("rejects empty/over-limit document speech without truncation", () => {
  expect(() => documentChunks(" ")).toThrow(); expect(() => documentChunks("a".repeat(5001))).toThrow(/5,000/);
  expect(documentChunks("a".repeat(5000))).toHaveLength(50);
});
it("keeps short sentences separate and normalizes PDF line breaks for speech", () => {
  expect(documentChunks("One sentence. A second\nclear sentence! Last one?" )).toEqual(["One sentence.","A second clear sentence!","Last one?"]);
});
it("validates PDF MIME, actual header, emptiness and file byte ceiling", async () => {
  await expect(validatePdf(new File(["%PDF-1.7\nvalid header"], "source.pdf", {type:"application/pdf"}))).resolves.toBeUndefined();
  for (const file of [new File([],"empty.pdf"),new File(["not PDF"],"fake.pdf",{type:"application/pdf"}),new File(["%PDF-1.7"],"image.jpg",{type:"image/jpeg"}),new File([new Uint8Array(10*1048576+1)],"large.pdf")]) await expect(validatePdf(file)).rejects.toThrow();
});

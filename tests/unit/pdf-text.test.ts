import { expect,it } from "vitest";
import { pdfPageText } from "../../src/lib/localtools/pdf";
import { speechText,validateCues } from "../../src/lib/localtools/text";
import { documentChunks } from "../../src/lib/localtools/documentText";
it("discloses unmapped PDF glyphs instead of silently treating sanitized text as complete",()=>{
 expect(pdfPageText([{str:"नम\u0000े"},{str:" "},{str:"bad\uFFFD"}])).toEqual({text:"नमे bad\uFFFD",unmapped:true});
});
it("rejects unsupported synthesis scripts before model loading while retaining Latin names",()=>{
 expect(()=>speechText("नमस्ते दुनिया")).toThrow(/English text only/);
 expect(()=>documentChunks("भारत का नाम")).toThrow(/English text only/);
 expect(()=>validateCues([{text:"Привет",start:0,end:1}],2)).toThrow(/English text only/);
 expect(speechText("José has 23 books.")).toBe("José has 23 books.");
});
it("preserves embedded Hindi, tables and line breaks without claiming OCR",()=>{
 expect(pdfPageText([{str:"भारत का नाम",hasEOL:true},{str:"Name"},{str:" "},{str:"23"},{}])).toEqual({text:"भारत का नाम\nName 23",unmapped:false});
});
it("does not invent spaces between adjacent shaped glyph or font runs",()=>{
 expect(pdfPageText([{str:"भा"},{str:"रत"},{str:" "},{str:"का"},{str:" "},{str:"ना"},{str:"म"}]).text).toBe("भारत का नाम");
 expect(pdfPageText([{str:"hel"},{str:"lo"},{str:" "},{str:"world"}]).text).toBe("hello world");
});

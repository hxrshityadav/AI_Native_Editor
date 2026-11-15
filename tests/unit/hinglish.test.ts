import { describe, expect, it } from "vitest";
import { enforceRoman, errorRates, hasDevanagari, normalizeHinglish, restoreEnglish, romanNormalise, toRoman } from "@/lib/subtitles/hinglish";

describe("Roman Hinglish", () => {
  it("writes everyday Hindi the way Hinglish captions spell it", () => {
    expect(toRoman("आज हम देखेंगे कि एआई टूल्स कैसे काम करते हैं।")).toBe("aaj hum dekhenge ki AI tools kaise kaam karte hain.");
  });
  it("deletes silent schwas and keeps Latin words and numbers", () => {
    expect(toRoman("समझ")).toBe("samajh"); expect(toRoman("कमरा")).toBe("kamra"); expect(toRoman("YouTube पर १० वीडियो")).toBe("YouTube par 10 video");
  });
  it("handles nukta consonants", () => { expect(toRoman("ज़िंदगी")).toBe("zindagi"); expect(toRoman("फ़िल्म")).toBe("film"); });
});

describe("Devanagari with English words", () => {
  it("restores only lexicon English words, leaving Hindi untouched", () => {
    expect(restoreEnglish("आज हम सीखेंगे कि मशीन लर्निंग कैसे काम करती है।")).toBe("आज हम सीखेंगे कि machine learning कैसे काम करती है।");
    expect(restoreEnglish("नमस्ते दोस्तों")).toBe("नमस्ते दोस्तों");
  });
});

describe("error rates", () => {
  it("measures WER and CER", () => {
    expect(errorRates("the cat sat", "the cat sat")).toMatchObject({ wer: 0, cer: 0 });
    expect(errorRates("the cat sat", "the bat sat").wer).toBeCloseTo(1 / 3, 5);
    expect(errorRates("नमस्ते दुनिया", "नमस्ते").wer).toBe(0.5);
  });
  it("tolerates casual Roman spelling variants when asked", () => {
    expect(errorRates("aaj hum dekhenge", "aj hum dekhenge", romanNormalise).wer).toBe(0);
  });
});

describe("Roman-only Hinglish", () => {
  it("transliterates only Devanagari words and leaves Roman words untouched", () => {
    const { text, converted } = enforceRoman("Toh guys aaj main बताऊंगा ki Java mein arrays kaise work karte hain");
    expect(converted).toBe(1); expect(hasDevanagari(text)).toBe(false); expect(text.startsWith("Toh guys aaj main ")).toBe(true); expect(text.endsWith(" ki Java mein arrays kaise work karte hain")).toBe(true);
  });
  it("never leaves a Devanagari character, whatever the input", () => {
    for (const sample of ["आज हम बात करेंगे कि आर्टिफिशियल इंटेलिजेंस कैसे काम करता है।", "API कॉल", "॥ १२३ ॐ"]) expect(hasDevanagari(enforceRoman(sample).text)).toBe(false);
  });
  it("normalisation only fixes spacing, sentence capitals and the Devanagari full stop", () => {
    expect(normalizeHinglish("agar tum coding seekh rahe ho ,toh consistency bahut important hai।basically jab hum API call karte hain")).toBe("Agar tum coding seekh rahe ho, toh consistency bahut important hai. Basically jab hum API call karte hain");
    const words = "aaj hum baat karenge ki artificial intelligence kaise kaam karta hai";
    expect(normalizeHinglish(words).toLowerCase()).toBe(words); // no word is replaced
  });
});

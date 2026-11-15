/*
 * Hinglish script handling for captions. Deterministic and local: no model, no network.
 * - toRoman: Devanagari -> casual Roman Hinglish ("आज हम देखेंगे" -> "aaj hum dekhenge"), with schwa deletion and a
 *   lexicon of common spellings. Latin words pass through unchanged.
 * - restoreEnglish: common English words that speech recognition wrote in Devanagari go back to Latin
 *   ("मशीन लर्निंग" -> "machine learning"). Only words in the lexicon change; everything else stays as recognised.
 * Both work word by word, so word timings are preserved.
 */

const CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
  "ष": "sh", "स": "s", "ह": "h", "ळ": "l",
};
const NUKTA: Record<string, string> = { "क": "q", "ख": "kh", "ग": "g", "ज": "z", "ड": "r", "ढ": "rh", "फ": "f", "य": "y" };
const VOWELS: Record<string, string> = { "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऋ": "ri", "ऑ": "o", "ॲ": "e" };
const MATRAS: Record<string, string> = { "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ृ": "ri", "ॉ": "o", "ॅ": "e" };
const DIGITS = "०१२३४५६७८९";

/** Everyday words whose casual Roman spelling does not follow letter-by-letter rules. */
const COMMON: Record<string, string> = {
  "है": "hai", "हैं": "hain", "में": "mein", "मैं": "main", "नहीं": "nahi", "यह": "yeh", "वह": "woh", "ये": "ye", "वो": "wo",
  "क्या": "kya", "कैसे": "kaise", "कैसा": "kaisa", "कि": "ki", "की": "ki", "का": "ka", "के": "ke", "को": "ko", "से": "se", "और": "aur",
  "भी": "bhi", "तो": "toh", "हम": "hum", "आप": "aap", "आज": "aaj", "कल": "kal", "अब": "ab", "जब": "jab", "सब": "sab", "कुछ": "kuch",
  "एक": "ek", "दो": "do", "तीन": "teen", "बहुत": "bahut", "था": "tha", "थी": "thi", "थे": "the", "हो": "ho", "हूं": "hoon", "हूँ": "hoon",
  "रहा": "raha", "रही": "rahi", "रहे": "rahe", "गया": "gaya", "गई": "gayi", "गए": "gaye", "कर": "kar", "करना": "karna", "करते": "karte",
  "करती": "karti", "करता": "karta", "मेरा": "mera", "मेरी": "meri", "मेरे": "mere", "तुम": "tum", "आपको": "aapko", "हमें": "hume", "इस": "is",
  "उस": "us", "इसको": "isko", "उसको": "usko", "यहां": "yahan", "यहाँ": "yahan", "वहां": "wahan", "वहाँ": "wahan", "लिए": "liye", "साथ": "saath",
  "बात": "baat", "काम": "kaam", "नाम": "naam", "देखेंगे": "dekhenge", "सीखेंगे": "seekhenge", "जरूर": "zaroor", "ज़रूर": "zaroor", "अच्छा": "achha",
  "ठीक": "theek", "चलो": "chalo", "दोस्तों": "doston", "दोस्तो": "dosto", "पहले": "pehle", "फिर": "phir", "क्यों": "kyon", "कौन": "kaun", "कहां": "kahan",
};

/** English words that Hindi speech recognition commonly writes in Devanagari, keyed without nukta. */
const ENGLISH: Record<string, string> = {
  "एआई": "AI", "मशीन": "machine", "लर्निंग": "learning", "टूल": "tool", "टूल्स": "tools", "वीडियो": "video", "वीडियोज": "videos", "यूज": "use",
  "ऐप": "app", "एप": "app", "फोन": "phone", "कंप्यूटर": "computer", "इंटरनेट": "internet", "सॉफ्टवेयर": "software", "डेटा": "data", "डाटा": "data",
  "ऑनलाइन": "online", "एडिटिंग": "editing", "एडिट": "edit", "कैप्शन": "caption", "कैप्शंस": "captions", "सबटाइटल": "subtitle", "सबटाइटल्स": "subtitles",
  "अपलोड": "upload", "डाउनलोड": "download", "लिंक": "link", "चैनल": "channel", "सब्सक्राइब": "subscribe", "लाइक": "like", "कमेंट": "comment",
  "शेयर": "share", "यूट्यूब": "YouTube", "इंस्टाग्राम": "Instagram", "रील": "reel", "रील्स": "reels", "एक्सपोर्ट": "export", "फाइल": "file",
  "स्क्रीन": "screen", "कोड": "code", "कोडिंग": "coding", "प्रोग्रामिंग": "programming", "टेक्नोलॉजी": "technology", "मॉडल": "model", "ट्रेनिंग": "training",
  "डिजाइन": "design", "बिजनेस": "business", "मार्केटिंग": "marketing", "कंटेंट": "content", "क्रिएटर": "creator", "प्रोडक्ट": "product",
  "फीचर": "feature", "फीचर्स": "features", "अपडेट": "update", "ऑप्शन": "option", "सेटिंग्स": "settings", "बटन": "button", "क्लिक": "click",
  "ओके": "OK", "हेलो": "hello", "हैलो": "hello", "थैंक": "thank", "थैंक्स": "thanks", "गाइज": "guys", "स्टेप": "step", "स्टेप्स": "steps",
  "प्रोसेस": "process", "सिस्टम": "system", "नेटवर्क": "network", "ईमेल": "email", "पासवर्ड": "password", "वेबसाइट": "website", "ब्राउजर": "browser",
  "लैपटॉप": "laptop", "मोबाइल": "mobile", "कैमरा": "camera", "ऑडियो": "audio", "म्यूजिक": "music", "सॉन्ग": "song", "टाइम": "time", "प्लान": "plan",
  "टीम": "team", "मीटिंग": "meeting", "प्रॉब्लम": "problem", "सॉल्यूशन": "solution", "आइडिया": "idea", "टिप्स": "tips", "ट्रिक्स": "tricks",
  "यूजफुल": "useful", "स्टार्ट": "start", "एंड": "end", "पार्ट": "part", "टॉपिक": "topic", "लेवल": "level", "बेसिक": "basic", "एडवांस": "advance",
  "चैटजीपीटी": "ChatGPT", "गूगल": "Google", "ऑफिस": "office", "प्रोजेक्ट": "project", "रिपोर्ट": "report", "सर्च": "search", "पेज": "page",
};

const isDevanagari = (text: string) => /\p{Script=Devanagari}/u.test(text);
const split = (word: string) => { const m = /^([\p{P}\p{S}]*)(.*?)([\p{P}\p{S}]*)$/u.exec(word)!; return [m[1], m[2], m[3]] as const; };
const stripNukta = (text: string) => text.replace(/़/g, "");

/** Letter-by-letter transliteration with right-to-left schwa deletion (V C a C V -> drop the a). */
function transliterate(word: string): string {
  const chars = [...word], units: { text: string; schwa: boolean; vowel: boolean }[] = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i], next = chars[i + 1];
    if (CONSONANTS[c]) {
      const nukta = next === "़"; if (nukta) i++;
      const base = nukta && NUKTA[c] ? NUKTA[c] : CONSONANTS[c], after = chars[i + 1];
      if (after === "्") { units.push({ text: base, schwa: false, vowel: false }); i++; }
      else if (after && MATRAS[after]) { units.push({ text: base + MATRAS[after], schwa: false, vowel: true }); i++; }
      else units.push({ text: base + "a", schwa: true, vowel: true });
    } else if (VOWELS[c]) units.push({ text: VOWELS[c], schwa: false, vowel: true });
    else if (c === "ं" || c === "ँ") units.push({ text: "n", schwa: false, vowel: false });
    else if (c === "ः") units.push({ text: "h", schwa: false, vowel: false });
    else if (DIGITS.includes(c)) units.push({ text: String(DIGITS.indexOf(c)), schwa: false, vowel: false });
    else if (c === "।" || c === "॥") units.push({ text: ".", schwa: false, vowel: false });
    else units.push({ text: c, schwa: false, vowel: false });
  }
  // Word-final schwa is silent; a medial schwa between a vowel-bearing syllable and a following full syllable is too.
  const last = units.findLastIndex(unit => unit.vowel);
  if (last > 0 && units[last].schwa) units[last].text = units[last].text.slice(0, -1);
  for (let i = units.length - 2; i > 0; i--) if (units[i].schwa && units[i - 1].vowel && units[i + 1]?.vowel && !units[i + 1].schwa) { units[i].text = units[i].text.slice(0, -1); units[i].vowel = false; }
  let out = units.map(unit => unit.text).join("");
  out = out.replace(/ee$/, "i").replace(/aa(n?)$/, "a$1").replace(/v(?=[aeiou])/g, m => m);
  return out;
}

/** One word to Roman Hinglish: English lexicon first, then common spellings, then transliteration. */
export function wordToRoman(word: string): string {
  const [lead, core, tail] = split(word);
  if (!isDevanagari(core)) return word;
  const key = stripNukta(core);
  const roman = ENGLISH[key] ?? COMMON[core] ?? COMMON[key] ?? transliterate(core);
  return lead + roman + tail.replace(/[।॥]/g, ".");
}
export const toRoman = (text: string) => text.split(/(\s+)/).map(part => /\s/.test(part) ? part : wordToRoman(part)).join("");

/** Restores lexicon English words to Latin inside Devanagari text, keeping everything else as recognised. */
export function wordRestoreEnglish(word: string): string {
  const [lead, core, tail] = split(word), english = ENGLISH[stripNukta(core)];
  return english ? lead + english + tail : word;
}
export const restoreEnglish = (text: string) => text.split(/(\s+)/).map(part => /\s/.test(part) ? part : wordRestoreEnglish(part)).join("");

/** Word error rate and character error rate (Levenshtein), on whitespace tokens and characters. */
export function errorRates(reference: string, hypothesis: string, normalise: (text: string) => string = basicNormalise) {
  const r = normalise(reference), h = normalise(hypothesis);
  const distance = <T,>(a: T[], b: T[]) => { let prev = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { const row = [i]; for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = row; } return prev[b.length]; };
  const rw = r.split(" ").filter(Boolean), hw = h.split(" ").filter(Boolean), rc = [...r.replace(/ /g, "")], hc = [...h.replace(/ /g, "")];
  return { wer: rw.length ? distance(rw, hw) / rw.length : 0, cer: rc.length ? distance(rc, hc) / rc.length : 0, words: rw.length };
}
export const basicNormalise = (text: string) => text.toLowerCase().normalize("NFC").replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/g, " ").trim();
/** Spelling-tolerant comparison for casual Roman Hinglish (aa/a, ee/i, oo/u, w/v, doubled letters). */
export const romanNormalise = (text: string) => basicNormalise(text).replace(/aa/g, "a").replace(/ee/g, "i").replace(/oo/g, "u").replace(/w/g, "v").replace(/(.)\1+/g, "$1");

/* ---------- Roman-only Hinglish ---------- */

export const hasDevanagari = (text: string) => /[ऀ-ॿ]/.test(text);

/**
 * Hinglish is always Roman. If the model emits any Devanagari word, that word alone is transliterated to Roman
 * (English lexicon first, then the transliterator). Roman words are never touched. Returns how many words changed.
 */
export function enforceRoman(text: string): { text: string; converted: number } {
  let converted = 0;
  const out = text.split(/(\s+)/).map(part => { if (/\s/.test(part) || !hasDevanagari(part)) return part; converted++; return wordToRoman(part); }).join("");
  // Final sweep: signs and punctuation the transliterator keeps (॥, ॐ, stray marks) never survive in Roman Hinglish.
  const swept = out.replace(/ॐ/g, "om").replace(/[।॥]+/g, ".").replace(/[ऀ-ॿ]+/g, match => { const roman = toRoman(match); return hasDevanagari(roman) ? "" : roman; });
  return { text: swept.replace(/\s+/g, " ").trim() === out.replace(/\s+/g, " ").trim() ? out : swept, converted };
}

/**
 * Conservative Hinglish tidy-up: whitespace, spacing around punctuation, the Devanagari full stop as ".", and a capital
 * letter at the start of each sentence. Words and their spellings are never changed, so meaning cannot drift.
 */
export function normalizeHinglish(text: string): string {
  let out = text.replace(/[।॥]/g, ".").replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").replace(/([,.!?;:])(?=[A-Za-z])/g, "$1 ").trim();
  out = out.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead, letter) => lead + letter.toUpperCase());
  return out;
}

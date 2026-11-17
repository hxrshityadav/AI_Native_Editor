import type { NormalizationProfile } from "./types";
export const SCORER_VERSION="1.0.0";
/** No transliteration, dictionary, spelling replacement, grammar correction or script deletion. */
export function normalize(text:string,profile:NormalizationProfile):string {
  let value=text.normalize("NFC");
  if(profile!=="strict")value=value.toLowerCase().split(/\s+/u).map(word=>word.replace(/^\p{P}+|\p{P}+$/gu,"")).filter(Boolean).join(" ");
  return value.replace(/\s+/gu," ").trim();
}
export const tokens=(text:string,profile:NormalizationProfile)=>normalize(text,profile).split(" ").filter(Boolean);
export const isRoman=(text:string)=>![...text].some(char=>/\p{L}/u.test(char)&&! /\p{Script=Latin}/u.test(char));

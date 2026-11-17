import { align, characterErrors, countEdits } from "./alignment";
import { normalize, tokens } from "./normalization";
import { timingMetrics } from "./timestamp-metrics";
import type { Counts, Edit, Language, NormalizationProfile, Prediction, Recording, Score, VocabularyMetric, WordAnnotation } from "./types";
const subset=(edits:Edit[],indices:Set<number>)=>countEdits(edits.filter(e=>indices.has(e.anchor)),indices.size);
export function languageMetrics(words:WordAnnotation[],edits:Edit[]):Record<Language,Counts>{return Object.fromEntries((["hi","en","other"] as const).map(language=>[language,subset(edits,new Set(words.flatMap((w,i)=>w.language===language?[i]:[])))])) as Record<Language,Counts>;}
export function boundaryMetrics(words:WordAnnotation[],edits:Edit[],window=2){
  if(!Number.isInteger(window)||window<1||window>20)throw new Error("Boundary context must be 1–20 reference words on each side");
  const transitions=words.flatMap((w,i)=>i>0&&w.language!==words[i-1].language?[{at:i,direction:`${words[i-1].language}-to-${w.language}`,indices:Array.from({length:Math.min(words.length,i+window)-Math.max(0,i-window)},(_,j)=>Math.max(0,i-window)+j)}]:[]);
  // Each reference anchor occurs once in an aggregate union, including overlapping windows.
  const indices=(direction?:string)=>new Set(transitions.filter(t=>!direction||t.direction===direction).flatMap(t=>t.indices));
  return {all:subset(edits,indices()),hiToEn:subset(edits,indices("hi-to-en")),enToHi:subset(edits,indices("en-to-hi")),transitions};
}
export function vocabularyMetric(words:WordAnnotation[],edits:Edit[],kind:"proper"|"technical",vocabulary:string[][]=[]):VocabularyMetric {
  const groups=new Map<string,number[]>();
  words.forEach((w,i)=>{if(kind==="proper"?w.isProperNoun:w.isTechnicalTerm){const key=(kind==="proper"?w.entityId:w.termId)??`word-${i}`;groups.set(key,[...(groups.get(key)??[]),i]);}});
  if(kind==="technical")for(const term of vocabulary){const target=term.map(w=>normalize(w,"punctuation-insensitive"));for(let i=0;i<=words.length-target.length;i++)if(target.length&&target.every((w,j)=>normalize(words[i+j].text,"punctuation-insensitive")===w)){const ids=target.map((_,j)=>i+j);if(![...groups.values()].some(v=>v.join()===ids.join()))groups.set(`vocabulary-${i}-${target.length}`,ids);}}
  const correctIndices=new Set(edits.filter(e=>e.operation==="correct").map(e=>e.referenceIndex));
  const items=[...groups].map(([id,referenceIndices])=>({id,referenceIndices,correct:referenceIndices.every(i=>correctIndices.has(i))&&referenceIndices.map(i=>edits.find(e=>e.referenceIndex===i)!.hypothesisIndex!).every((value,i,array)=>i===0||value===array[i-1]+1)})),correct=items.filter(item=>item.correct).length;
  return {evaluated:items.length,correct,accuracy:items.length?correct/items.length:null,items};
}
export function score(recording:Recording,prediction:Prediction,profile:NormalizationProfile="roman-hinglish",window=2,vocabulary:string[][]=[]):Score {
  const words=recording.reference.words,reference=words.length?words.map(w=>normalize(w.text+(w.punctuation??""),profile)):tokens(recording.reference.text,profile),hypothesis=tokens(prediction.rawText,profile),edits=align(reference,hypothesis);
  const sentences:number[][]=[];let sentence:number[]=[];reference.forEach((_,i)=>{sentence.push(i);const original=words[i]?words[i].text+(words[i].punctuation??""):recording.reference.text.trim().split(/\s+/u)[i];if(/[.!?]$/u.test(original??"")||i===reference.length-1){sentences.push(sentence);sentence=[];}});
  const correct=sentences.filter(indices=>!edits.some(e=>indices.includes(e.anchor)&&e.operation!=="correct")).length;
  return {overall:countEdits(edits,reference.length,hypothesis.length),edits,cer:characterErrors(normalize(recording.reference.text,profile),normalize(prediction.rawText,profile)),languages:words.length?languageMetrics(words,edits):null,boundaries:boundaryMetrics(words,edits,window),properNouns:vocabularyMetric(words,edits,"proper"),technicalTerms:vocabularyMetric(words,edits,"technical",vocabulary),timing:timingMetrics(recording,prediction,edits,profile),sentences:{evaluated:sentences.length,correct,accuracy:sentences.length?correct/sentences.length:null}};
}

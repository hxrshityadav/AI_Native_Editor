import { align } from "./alignment";
import { normalize, tokens } from "./normalization";
import type { Edit, NormalizationProfile, Prediction, PredictionWord, Recording, TimingMetrics } from "./types";
export const quantile=(values:number[],p:number)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),at=(sorted.length-1)*p,low=Math.floor(at);return sorted[low]+(sorted[Math.ceil(at)]-sorted[low])*(at-low);};
export function validateTimes(words:PredictionWord[],duration:number){
  const valid=words.map(w=>typeof w.start==="number"&&typeof w.end==="number"&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.start>=0&&w.end>w.start&&w.end<=duration);
  let overlaps=0,gaps=0,previous=-1;
  words.forEach((w,i)=>{if(!valid[i])return;if(previous>=0){const last=words[previous];if(w.start!<last.end!){overlaps++;valid[i]=false;valid[previous]=false;}else if(w.start!>last.end!)gaps++;}if(previous<0||w.end!>=words[previous].end!)previous=i;});
  return {valid,invalid:valid.filter(v=>!v).length,overlaps,gaps};
}
export function timingMetrics(recording:Recording,prediction:Prediction,edits:Edit[],profile:NormalizationProfile):TimingMetrics {
  const ref=recording.reference,output=prediction.alignment;
  const words=output?.words??prediction.words,phrases=output?.phrases??prediction.phrases,checked=validateTimes(words,recording.duration),pc=validateTimes(phrases,recording.duration);
  const base:TimingMetrics={coverage:null,missingOrInvalid:null,referenceTimedWords:0,validAlignedWords:0,startErrors:[],endErrors:[],boundaryErrors:[],mae:null,median:null,p90:null,phraseCoverage:null,invalidWords:checked.invalid,ambiguousWords:0,overlaps:checked.overlaps+pc.overlaps,gaps:checked.gaps,method:output?.method??(words.length?"native-word":"native-phrase"),reason:null};
  if(!ref.review.timingReviewed||ref.review.status!=="reviewed"){base.reason="Reference timing has not been manually reviewed";return base;}
  if(output&&(normalize(output.transcript,"strict")!==normalize(prediction.rawText,"strict")||(output.method==="forced"&&!output.provenance))){base.reason="Alignment transcript/provenance does not match this model output";return base;}
  base.referenceTimedWords=ref.words.length;
  const hyp=tokens(prediction.rawText,profile),mapped=words.flatMap((w,index)=>tokens(w.text,profile).map(text=>({text,index}))),textMatches=mapped.length===hyp.length&&mapped.every((w,i)=>w.text===hyp[i])&&words.every(w=>tokens(w.text,profile).length<=1);
  const usableEdits=textMatches?edits:[];
  const occurrences=(values:string[])=>{const counts=new Map<string,number>();values.forEach(value=>counts.set(value,(counts.get(value)??0)+1));return counts;},referenceCounts=occurrences(ref.words.map(w=>normalize(w.text,"punctuation-insensitive"))),hypothesisCounts=occurrences(hyp.map(w=>normalize(w,"punctuation-insensitive")));
  const ambiguous=(text:string)=>{const token=normalize(text,"punctuation-insensitive"),a=referenceCounts.get(token)??0,b=hypothesisCounts.get(token)??0;return a!==b&&Math.max(a,b)>1;};
  base.ambiguousWords=ref.words.filter(w=>ambiguous(w.text)).length;
  for(const e of usableEdits){if(e.operation!=="correct"||e.referenceIndex===null||e.hypothesisIndex===null)continue;const rw=ref.words[e.referenceIndex],index=mapped[e.hypothesisIndex]?.index,w=words[index];if(rw?.start===undefined||rw.end===undefined||ambiguous(rw.text)||!w||!checked.valid[index])continue;const startError=Math.abs(w.start!-rw.start),endError=Math.abs(w.end!-rw.end);base.startErrors.push(startError);base.endErrors.push(endError);base.boundaryErrors.push({referenceIndex:e.referenceIndex,hypothesisIndex:e.hypothesisIndex,startError,endError});base.validAlignedWords++;}
  const errors=[...base.startErrors,...base.endErrors];base.coverage=ref.words.length?base.validAlignedWords/ref.words.length:null;base.missingOrInvalid=base.coverage===null?null:1-base.coverage;base.mae=errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:null;base.median=quantile(errors,.5);base.p90=quantile(errors,.9);
  // Phrase coverage is temporal overlap of manually timed words with native phrase intervals; never invent word times.
  base.phraseCoverage=ref.words.length?ref.words.reduce((sum,w)=>sum+phrases.reduce((part,p,i)=>part+(pc.valid[i]?Math.max(0,Math.min(w.end!,p.end!)-Math.max(w.start!,p.start!)):0),0),0)/ref.words.reduce((sum,w)=>sum+w.end!-w.start!,0):null;
  if(!words.length)base.reason="Word timing unavailable; phrase timing is not word alignment";else if(!textMatches)base.reason="Timing words do not cover this model transcript";
  else if(base.ambiguousWords)base.reason="Repeated-word counts differ; ambiguous occurrences are excluded from timing accuracy";
  return base;
}
/** Evaluate independently supplied alignment text, rather than assigning model words by their position. */
export const alignTimingText=(reference:string[],hypothesis:string[])=>align(reference,hypothesis);

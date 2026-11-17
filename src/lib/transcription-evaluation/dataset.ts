import { z } from "zod";
import { isRoman, normalize } from "./normalization";
const id=z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);
const word=z.object({text:z.string().min(1).max(120).refine(t=>! /\s/u.test(t)&&isRoman(t),"Use one Roman-script word"),punctuation:z.string().max(12).regex(/^[\p{P}]*$/u).optional(),language:z.enum(["hi","en","other"]),start:z.number().finite().nonnegative().optional(),end:z.number().finite().positive().optional(),isProperNoun:z.boolean().optional(),isTechnicalTerm:z.boolean().optional(),isCodeSwitchBoundary:z.boolean().optional(),entityId:id.optional(),termId:id.optional()}).strict();
const recording=z.object({
  id,speakerId:id,audio:z.object({path:z.string().min(1).max(500).refine(p=>!p.includes("\\")&&!p.includes(":")&&!p.startsWith("/")&&!p.split("/").some(s=>s===".."||s==="."||!s),"Use a relative local path"),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),duration:z.number().positive().max(600),split:z.enum(["train","development","test"]),
  conditions:z.object({environment:z.string().min(1).max(120),accent:z.string().max(120).optional(),speed:z.enum(["slow","normal","fast","unknown"]),noise:z.string().min(1).max(120)}).strict(),
  provenance:z.object({kind:z.enum(["natural","synthetic"]),permission:z.enum(["consented","public-license","synthetic"]),source:z.string().min(1).max(500),license:z.string().max(200).optional()}).strict(),
  reference:z.object({text:z.string().min(1).max(100000).refine(isRoman,"Reference must remain Roman script"),words:z.array(word).max(6000),review:z.object({status:z.enum(["draft","reviewed"]),reviewer:id.optional(),reviewedAt:z.iso.datetime().optional(),timingReviewed:z.boolean()}).strict()}).strict(),
}).strict();
export const datasetSchema=z.object({schemaVersion:z.literal(1),id,version:z.string().min(1).max(80),kind:z.enum(["natural","synthetic"]),recordings:z.array(recording).min(1).max(1000)}).strict().superRefine((dataset,ctx)=>{
  const ids=new Set<string>(),speakers=new Map<string,string>();
  dataset.recordings.forEach((r,index)=>{
    const issue=(message:string)=>ctx.addIssue({code:"custom",path:["recordings",index],message});
    if(ids.has(r.id))issue("Duplicate recording ID");ids.add(r.id);
    if(speakers.has(r.speakerId)&&speakers.get(r.speakerId)!==r.split)issue("A speaker cannot cross development/test splits");speakers.set(r.speakerId,r.split);
    if(r.provenance.kind!==dataset.kind)issue("Synthetic and natural recordings must be separate datasets");
    if((dataset.kind==="synthetic")!==(r.provenance.permission==="synthetic"))issue("Permission must match recording provenance");
    if(r.provenance.permission==="public-license"&&!r.provenance.license)issue("Public recordings require a license");
    const ref=r.reference;
    if(ref.review.status==="reviewed"&&(!ref.review.reviewer||!ref.review.reviewedAt))issue("Reviewed references require reviewer and date");
    if(ref.review.timingReviewed&&ref.review.status!=="reviewed")issue("Timing cannot be verified on a draft reference");
    if(ref.words.length&&normalize(ref.text,"punctuation-insensitive")!==normalize(ref.words.map(w=>w.text).join(" "),"punctuation-insensitive"))issue("Words must cover the reference transcript exactly");
    let previous=0;
    ref.words.forEach((w,i)=>{
      if((w.start===undefined)!==(w.end===undefined))issue("Word times need both endpoints");
      if(ref.review.timingReviewed&&w.start===undefined)issue("Reviewed timing needs every word annotated");
      if(w.start!==undefined&&w.end!==undefined){if(w.start<previous||w.end<=w.start||w.end>r.duration)issue("Reference times must be ordered, nonoverlapping and bounded");previous=w.end;}
      const switchHere=i>0&&ref.words[i-1].language!==w.language;
      if(w.isCodeSwitchBoundary!==undefined&&w.isCodeSwitchBoundary!==switchHere)issue("Boundary flag must agree with reference language transition");
      if(w.entityId&&!w.isProperNoun)issue("Entity groups require proper-noun tags");if(w.termId&&!w.isTechnicalTerm)issue("Term groups require technical-term tags");
    });
    if(ref.review.timingReviewed&&!ref.words.length)issue("Timing review requires word annotations");
    for(const key of ["entityId","termId"] as const){const last=new Map<string,number>();ref.words.forEach((w,i)=>{const group=w[key];if(group){if(last.has(group)&&last.get(group)!==i-1)issue("Entity/term IDs identify one contiguous occurrence; use a new ID for repeated mentions");last.set(group,i);}});}
  });
});
export function parseDataset(value:unknown){return datasetSchema.parse(value);}

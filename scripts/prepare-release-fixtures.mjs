// QA-only public recordings. Not included in the application or sent for remote inference.
import { createHash } from "node:crypto";
import { mkdirSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
const out=resolve("output/release-certification");mkdirSync(out,{recursive:true});
const source="https://datasets-server.huggingface.co/rows?dataset=hf-internal-testing%2Flibrispeech_asr_dummy&config=clean&split=validation&offset=0&length=2";
const response=await fetch(source,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`Dataset ${response.status}`);
const {rows}=await response.json(),records=[];
for(const {row}of rows){
 if(!["1272-128104-0000","1272-128104-0001"].includes(row.id))throw new Error("Unexpected QA recording; review dataset before changing fixtures");
 const response=await fetch(row.audio[0].src,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`Recording ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());writeFileSync(resolve(out,row.id+".flac"),bytes);
 records.push({id:row.id,text:row.text,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});
}
writeFileSync(resolve(out,"recordings.json"),JSON.stringify(records,null,2));
writeFileSync(resolve(out,"RECORDINGS-LICENSE.txt"),"LibriSpeech ASR corpus, Vassil Panayotov, Guoguo Chen, Daniel Povey and Sanjeev Khudanpur. CC BY 4.0. https://www.openslr.org/12 ; license https://creativecommons.org/licenses/by/4.0/ . Two unmodified recordings from the hf-internal-testing/librispeech_asr_dummy clean validation subset. QA scripts make format conversions, repetition and synthetic-noise mixes; these are marked in their filenames. These artifacts are not production assets. Source API: "+source+"\n");
console.log("Prepared two public CC BY 4.0 recordings for local QA.");

import { SCORER_VERSION } from "./normalization";
import { score } from "./scoring";
import { evaluationFailure } from "./failures";
import type { ASRModelAdapter } from "./models";
import type { BenchmarkConfig, BenchmarkReport, Dataset, RunResult, Score, Recording, Prediction } from "./types";
export const DEFAULT_CONFIG:BenchmarkConfig={language:"hi",profile:"roman-hinglish",boundaryWindow:2,preprocessing:"production-readPcm-16k-mono-v1",pipelineVersion:"unresolved"};
export function canonical(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,v])=>`${JSON.stringify(key)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value)??"null";
}
export async function digest(value:Blob|string){
  if(value instanceof Blob&&value.size>128*1048576)throw new Error("Evaluation fingerprinting supports audio up to 128 MiB. Convert to a smaller local WAV first.");
  const bytes=typeof value==="string"?new TextEncoder().encode(value):await value.arrayBuffer();
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(n=>n.toString(16).padStart(2,"0")).join("");
}
export async function cacheKey(dataset:Dataset,audioHash:string,model:ASRModelAdapter["spec"],config:BenchmarkConfig,recordingId:string){return digest(canonical({dataset,recordingId,audioHash,model,config,scorer:SCORER_VERSION}));}
type Options={dataset:Dataset;files:Map<string,File>;adapters:ASRModelAdapter[];config:BenchmarkConfig;signal:AbortSignal;cache?:Map<string,RunResult>;recordingIds?:string[];onProgress?:(completed:number,total:number,status:string)=>void;scorePrediction?:(recording:Recording,prediction:Prediction,config:BenchmarkConfig,signal:AbortSignal)=>Promise<{strict:Score;normalized:Score}>};
export async function runBenchmark(options:Options):Promise<BenchmarkReport>{
  const {dataset,files,adapters,config,signal}=options,recordings=dataset.recordings.filter(r=>!options.recordingIds||options.recordingIds.includes(r.id));
  if(!recordings.length||!adapters.length)throw new Error("Select at least one recording and model");
  if(config.pipelineVersion==="unresolved")throw new Error("Resolve the worker fingerprint before benchmarking");
  const report:BenchmarkReport={schemaVersion:1,scorerVersion:SCORER_VERSION,evidence:"model-run",id:crypto.randomUUID(),createdAt:new Date().toISOString(),dataset,config,results:[]};let completed=0;
  const total=recordings.length*adapters.length;
  try{for(const adapter of adapters){
    try{for(const recording of recordings){
      if(signal.aborted)return report;
      const result:RunResult={cacheKey:"",recordingId:recording.id,model:adapter.spec,status:"failed",cached:false};
      try{
        const file=files.get(recording.audio.path);if(!file)throw new Error("A matching local audio file is missing. Reselect the dataset folder");
        const hash=await digest(file);signal.throwIfAborted();if(hash!==recording.audio.sha256)throw new Error("Audio fingerprint mismatch. Select the original annotated file");
        result.cacheKey=await cacheKey(dataset,hash,adapter.spec,config,recording.id);
        const cached=options.cache?.get(result.cacheKey);
        if(cached?.status==="completed"&&cached.prediction){Object.assign(result,cached,{cached:true});}
        else{
          await adapter.load(signal);const prediction=await adapter.transcribe(file,config,signal,status=>options.onProgress?.(completed,total,status));signal.throwIfAborted();
          // Decode duration is enforced by the existing worker. Dataset timing annotations remain in original seconds.
          if(Math.abs(prediction.audioDuration-recording.duration)>.1)throw new Error("Audio duration differs from annotation. Review the dataset");
          result.prediction=prediction;const scores=options.scorePrediction?await options.scorePrediction(recording,prediction,config,signal):{strict:score(recording,prediction,"strict",config.boundaryWindow,config.vocabulary),normalized:score(recording,prediction,config.profile,config.boundaryWindow,config.vocabulary)};signal.throwIfAborted();Object.assign(result,scores);result.status="completed";
          options.cache?.set(result.cacheKey,result);
        }
      }catch(error){result.status=signal.aborted?"cancelled":"failed";Object.assign(result,evaluationFailure(error,signal.aborted));}
      report.results.push(result);completed++;options.onProgress?.(completed,total,result.status);
      if(signal.aborted)return report;
    }}finally{await adapter.dispose();}
  }}finally{for(const adapter of adapters)await adapter.dispose();}
  return report;
}


import { LOCAL_MODEL_REVISIONS } from "../localtools/modelAssets";
import { runSpeech, type Transcript } from "../localtools/speechClient";
import type { ModelSpec, Prediction, BenchmarkConfig } from "./types";
export const MODELS:ModelSpec[]=[
  {id:"tiny",name:"Whisper Tiny timestamped",repository:"onnx-community/whisper-tiny_timestamped",precision:"q4",downloadBytes:null,downloadSizeNote:"About 95 MiB weights; runtime/configs extra",licenseReview:"reviewed"},
  {id:"base",name:"Whisper Base timestamped",repository:"onnx-community/whisper-base_timestamped",precision:"q4",downloadBytes:null,downloadSizeNote:"About 140 MiB weights; runtime/configs extra",licenseReview:"reviewed"},
  {id:"hinglish-swift",name:"Hindi2Hinglish Swift",repository:"Hirecentive-D3l/Whisper-Hindi2Hinglish-Swift-ONNX",precision:"q8",downloadBytes:102482181,downloadSizeNote:"102,482,181 weight bytes; runtime/configs extra",licenseReview:"pending"},
].map(model=>({...model,revision:LOCAL_MODEL_REVISIONS[model.repository]})) as ModelSpec[];
export interface ASRModelAdapter {
  spec:ModelSpec;load(signal:AbortSignal):Promise<void>;
  transcribe(file:File,config:BenchmarkConfig,signal:AbortSignal,status:(message:string)=>void):Promise<Prediction>;
  dispose():Promise<void>;
}
export function browserAdapter(spec:ModelSpec,consent:boolean):ASRModelAdapter {
  let active:AbortController|undefined;
  return {spec,
    async load(signal){signal.throwIfAborted();if(!consent)throw new Error("Explicit model-download consent is required");if(typeof Worker==="undefined"||typeof WebAssembly==="undefined")throw new Error("Local models require browser workers and WebAssembly");},
    async transcribe(file,config,signal,status){
      active=new AbortController();const controller=active,abort=()=>controller.abort();signal.addEventListener("abort",abort,{once:true});if(signal.aborted)abort();
      const started=performance.now();
      try{
        // Reuse the sole production preprocessing/inference path. Loading is part of this worker request.
        const result=await runSpeech<Transcript>({kind:"transcribe",file,language:config.language,translate:false,longRecording:true,captionModel:spec.id},controller.signal,status);
        return {text:result.text,audioDuration:result.duration,rawText:result.rawText??result.text,words:result.words??[],phrases:result.cues,inferenceSeconds:result.seconds??null,elapsedSeconds:(performance.now()-started)/1000,peakMemoryBytes:null};
      }finally{signal.removeEventListener("abort",abort);active=undefined;}
    },
    async dispose(){active?.abort();active=undefined;},
  };
}

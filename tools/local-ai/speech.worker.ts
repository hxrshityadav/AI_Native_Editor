import { env, pipeline, Tensor } from "./transformers.min.js";
import { readPcm } from "../../src/lib/localtools/audio";
import { wav } from "../../src/lib/localtools/dsp";
import { fitSpeech, speechText, joinSpeech, validateCues, type Cue } from "../../src/lib/localtools/text";
import type { SpeechRequest } from "../../src/lib/localtools/speechClient";
import { documentChunks } from "../../src/lib/localtools/documentText";
import { LOCAL_MODEL_VERSION } from "../../src/lib/localtools/modelAssets";
import { dropLoops } from "../../src/lib/subtitles/transcript";
import { measuredWords } from "../../src/lib/subtitles/timing";
import { publicModelCache, speakerVector } from "../../src/lib/localtools/modelCache";
const scope=self as unknown as {onmessage:(event:MessageEvent<SpeechRequest>)=>void;postMessage:(message:unknown)=>void;location:Location};
const modelCache=publicModelCache(scope.location.origin);
env.allowLocalModels=false;env.allowRemoteModels=true;env.remoteHost=`${scope.location.origin}/local-models/${LOCAL_MODEL_VERSION}/`;env.remotePathTemplate="{model}/resolve/{revision}/";env.useBrowserCache=false;env.useCustomCache=true;env.customCache=modelCache;
env.backends.onnx.wasm.wasmPaths={wasm:`${scope.location.origin}/local-ai/ort-wasm-simd-threaded.jsep.wasm`,mjs:`${scope.location.origin}/local-ai/ort-wasm-simd-threaded.jsep.mjs`};env.backends.onnx.wasm.numThreads=1;
const nativeFetch=globalThis.fetch.bind(globalThis);globalThis.fetch=(resource,options)=>{const url=new URL(resource instanceof Request?resource.url:String(resource),scope.location.origin);if(url.origin!==scope.location.origin||!["GET","HEAD"].includes(options?.method??(resource instanceof Request?resource.method:"GET")))return Promise.reject(new Error("External processing is disabled."));return nativeFetch(resource,options);};
const phase=(value:string)=>scope.postMessage({type:"phase",value});
function modelProgress(event:Record<string,unknown>){if(typeof event.loaded==="number"&&typeof event.total==="number"&&event.total>0)phase(`Loading ${String(event.file??"model")}: ${(event.loaded/1048576).toFixed(1)} / ${(event.total/1048576).toFixed(1)} MiB`);else if(event.status==="initiate")phase("Loading optional local model assets (network or browser cache)");}
type Asr={processor:(audio:Float32Array)=>Promise<{input_features:unknown}>;model:((inputs:Record<string,unknown>)=>Promise<{logits:{data:Float32Array;dims:number[]}}>)&{generation_config:{decoder_start_token_id:number;lang_to_id:Record<string,number>}}};
/** Whisper language identification: softmax over the language tokens after <|startoftranscript|>. */
async function identifyLanguage(asr:unknown,audio:Float32Array){const {processor,model}=asr as Asr;const {input_features}=await processor(audio.subarray(0,16000*30));const config=model.generation_config;
  const out=await model({input_features,decoder_input_ids:new Tensor("int64",BigInt64Array.from([BigInt(config.decoder_start_token_id)]),[1,1])});
  const vocab=out.logits.dims.at(-1)!,offset=out.logits.data.length-vocab,entries=Object.entries(config.lang_to_id).map(([token,id])=>[token.slice(2,-2),out.logits.data[offset+id]] as [string,number]);
  const max=Math.max(...entries.map(([,v])=>v)),sum=entries.reduce((total,[,v])=>total+Math.exp(v-max),0),ranked=entries.map(([code,v])=>[code,Math.exp(v-max)/sum] as [string,number]).sort((a,b)=>b[1]-a[1]);
  return {code:ranked[0][0],probability:ranked[0][1],top:ranked.slice(0,3)};}
type VoiceOutput={audio:Float32Array;sampling_rate:number};
async function voice(){phase("Loading English speech model (first use downloads model assets)");const synthesizer=await pipeline("text-to-speech","Xenova/speecht5_tts",{device:"wasm",dtype:{encoder_model:"q8",decoder_model_merged:"fp32"},progress_callback:modelProgress});const speaker_embeddings=await speakerVector(scope.location.origin,modelCache);return async(text:string)=>{if(!text.trim()||text.length>500)throw new Error("Use 1–500 characters per speech segment.");const parts=documentChunks(text),audio:Float32Array[]=[];for(let i=0;i<parts.length;i++){if(parts.length>1)phase(`Generating English speech part ${i+1} of ${parts.length}`);const result=await synthesizer(parts[i],{speaker_embeddings}) as VoiceOutput;if(result.sampling_rate!==16000||!result.audio?.length||result.audio.length>16000*60||result.audio.some(value=>!Number.isFinite(value)))throw new Error("The speech model produced invalid or over-one-minute audio. Shorten the text.");audio.push(result.audio);}return joinSpeech(audio,60);};}
scope.onmessage=async({data})=>{try{
  if(data.kind==="synthesize"){const text=speechText(data.text),synthesize=await voice();phase("Generating English speech locally");const audio=await synthesize(text);scope.postMessage({type:"done",result:{blob:wav([audio],16000),duration:audio.length/16000}});return;}
  if(data.kind==="document"){const chunks=documentChunks(data.text),synthesize=await voice(),segments:Float32Array[]=[];let length=0;for(let i=0;i<chunks.length;i++){phase(`Generating document segment ${i+1} of ${chunks.length}`);const audio=await synthesize(chunks[i]);length+=audio.length+(i?1600:0);if(length>16000*600)throw new Error("Generated audio exceeds ten minutes. Select less text and retry.");segments.push(audio);scope.postMessage({type:"progress",value:(i+1)/chunks.length});}const audio=joinSpeech(segments,600);scope.postMessage({type:"done",result:{blob:wav([audio],16000),duration:audio.length/16000,segments:segments.length}});return;}
  if(data.kind==="dub"){const cues=validateCues(data.cues,data.duration);if(!cues.length)throw new Error("Add reviewed English segments before dubbing.");const synthesize=await voice(),speech:Float32Array[]=[];for(let i=0;i<cues.length;i++){phase(`Generating speech segment ${i+1} of ${cues.length}`);const samples=await synthesize(cues[i].text);if(samples.length>(cues[i].end-cues[i].start)*16000*1.5)throw new Error(`Segment ${i+1} is too long. Shorten its text and retry.`);speech.push(samples);scope.postMessage({type:"progress",value:(i+1)/cues.length});}const audio=fitSpeech(new Float32Array(Math.round(data.duration*16000)),16000,cues,speech);scope.postMessage({type:"done",result:{blob:wav([audio],16000),duration:data.duration}});return;}
  const {channels,info}=await readPcm(data.file,phase,data.longRecording?600:120,true),audio=channels[0];
  const CAPTION_MODELS:Record<string,{id:string;dtype:string}>={tiny:{id:"onnx-community/whisper-tiny_timestamped",dtype:"q4"},base:{id:"onnx-community/whisper-base_timestamped",dtype:"q4"},"hinglish-swift":{id:"Hirecentive-D3l/Whisper-Hindi2Hinglish-Swift-ONNX",dtype:"q8"}};
  const caption=data.captionModel,chosen=caption?CAPTION_MODELS[caption]:undefined,model=chosen?.id??"onnx-community/whisper-tiny";
  phase(caption?`Loading ${model.split("/")[1]} (first use downloads the model once)`:"Loading Whisper Tiny (first use downloads about 100 MB)");
  const transcribe=await pipeline("automatic-speech-recognition",model,{device:"wasm",dtype:caption?(chosen?.dtype??"q4"):"q4",progress_callback:modelProgress});
  // Transformers.js 3.8 has no Whisper language identification: without a language it silently forces English, which
  // turns Hindi speech into English text. "auto" therefore runs real identification first: one decoder step after
  // <|startoftranscript|>, read as probabilities over the language tokens, on the first 30 seconds.
  let language=data.language,detected:{code:string;probability:number;top:[string,number][]}|undefined;
  if(language==="auto"){phase("Identifying the spoken language");detected=await identifyLanguage(transcribe,audio);language=detected.code;}
  const started=performance.now();phase(data.translate?"Translating speech to English locally":"Recognizing speech locally");
  const words=!!caption;
  type Out={text:string;chunks?:{text:string;timestamp:[number|null,number|null]}[]};
  const options={language,task:data.translate?"translate":"transcribe",chunk_length_s:30,stride_length_s:5};
  let wordTiming=words,result:Out;
  // Some fine-tuned exports lack the cross-attention outputs word timing needs; they fall back to phrase timing.
  try{result=await transcribe(audio,{...options,return_timestamps:words?"word":true}) as Out;}
  catch(error){if(!words||!/attention|alignment/i.test(String(error)))throw error;wordTiming=false;phase("This model has no word timing; using phrase timing");result=await transcribe(audio,{...options,return_timestamps:true}) as Out;}
  if(wordTiming&&!measuredWords(result.chunks??[],info.duration,result.text)){
    wordTiming=false;phase("Incomplete word timestamps; retrying with phrase timing. Word highlighting is unavailable.");
    result=await transcribe(audio,{...options,return_timestamps:true}) as Out;
  }
  const seconds=(performance.now()-started)/1000,rawText=result.text?.trim()??"";
  const cues:Cue[]=[],wordList=wordTiming?measuredWords(result.chunks??[],info.duration,result.text)!:[];
  if(!wordTiming)for(const chunk of result.chunks??[]){
    const [start,end]=chunk.timestamp,text=chunk.text.trim();
    if(text&&typeof start==="number"&&typeof end==="number"&&Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end>start&&end<=info.duration)cues.push({text,start,end});
  }
  const looped=wordTiming?dropLoops(wordList):{words:wordList,removed:0};
  if(!rawText)throw new Error("No timed speech was recognized. Try clearer speech, choose its language explicitly, or write captions by hand.");
  scope.postMessage({type:"done",result:{cues,duration:info.duration,language,detected,words:wordTiming?looped.words:undefined,wordTiming,loopsRemoved:looped.removed,rawText,text:wordTiming?looped.words.map(word=>word.text).join(" "):result.text.trim(),model,seconds}});
}catch(error){scope.postMessage({type:"error",message:error instanceof Error?error.message:"Local speech processing failed. Retry with a shorter recording."});}};

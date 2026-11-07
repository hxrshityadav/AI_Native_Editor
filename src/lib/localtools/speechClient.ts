import type { Cue } from "./text";
export type SpeechRequest={kind:"transcribe";file:File;language:string;translate:boolean;longRecording?:boolean}|{kind:"synthesize";text:string}|{kind:"document";text:string}|{kind:"dub";duration:number;cues:Cue[]};
export type Transcript={text:string;cues:Cue[];duration:number};
export type SpeechAudio={blob:Blob;duration:number;segments?:number};
export function runSpeech<T extends Transcript|SpeechAudio>(request:SpeechRequest,signal:AbortSignal,status:(message:string)=>void,progress:(fraction:number)=>void=()=>{}):Promise<T>{
  if(signal.aborted)return Promise.reject(new DOMException("Cancelled","AbortError"));
  return new Promise((resolve,reject)=>{let worker:Worker;try{worker=new Worker("/local-ai/speech.worker.js",{type:"module"});}catch{reject(new Error("Local speech needs browser workers and WebAssembly. Try a supported desktop browser."));return;}
    let settled=false,timer:ReturnType<typeof setTimeout>;const clean=()=>{settled=true;clearTimeout(timer);worker.terminate();signal.removeEventListener("abort",abort);},abort=()=>{clean();reject(new DOMException("Cancelled","AbortError"));},arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{clean();reject(new Error("The local model stopped responding. Try a shorter recording on a desktop browser."));},600000);};signal.addEventListener("abort",abort,{once:true});arm();worker.onmessage=({data})=>{if(settled)return;arm();if(data.type==="phase")status(data.value);else if(data.type==="progress")progress(data.value);else{clean();if(data.type==="done")resolve(data.result);else reject(new Error(data.message));}};worker.onerror=event=>{event.preventDefault();if(!settled){clean();reject(new Error("The speech worker failed. Reload or retry on a desktop browser with more memory."));}};try{worker.postMessage(request);}catch{clean();reject(new Error("Could not pass the file to the local model. Reselect it."));}
  });
}

import { readPcm } from "./audio";
import { denoise, stereoStems, wav } from "./dsp";
import { makeStory, replaceSoundtrack, type StoryOptions } from "./video";
import { lectureNotes, type LectureNotes } from "./notes";
import type { Cue } from "./text";
export type LocalRequest = { kind:"noise"|"stems"|"music";file:File;noiseSeconds?:number;strength?:number;neural?:boolean;preserveVideo?:boolean } | {kind:"story";options:StoryOptions} | {kind:"mux";file:File;audio:Blob} | {kind:"notes";cues:Cue[];duration:number};
export type LocalResult = {blob:Blob;extension:string;secondary?:Blob;notes?:LectureNotes};
const scope=self as unknown as {onmessage:(event:MessageEvent<LocalRequest>)=>void;postMessage:(message:unknown)=>void};
scope.onmessage=async({data})=>{const progress=(value:number)=>scope.postMessage({type:"progress",value}),status=(value:string)=>scope.postMessage({type:"phase",value});try{
  let result:LocalResult;
  if(data.kind==="notes"){status("Organizing reviewed transcript locally");const notes=lectureNotes(data.cues,data.duration);result={blob:new Blob([notes.markdown],{type:"text/markdown;charset=utf-8"}),secondary:new Blob([notes.text],{type:"text/plain;charset=utf-8"}),extension:"md",notes};}
  else if(data.kind==="story"){status("Rendering video locally");result=await makeStory(data.options,progress);}
  else if(data.kind==="mux"){status("Replacing the soundtrack");result=await replaceSoundtrack(data.file,data.audio,progress);}
  else {if(data.neural)throw new Error("The neural worker was not selected. Reload and retry.");const {channels,sampleRate}=await readPcm(data.file,status);if(data.kind==="noise"){status("Reducing steady noise");const cleaned=channels.map((channel,i)=>denoise(channel,sampleRate,data.noiseSeconds??.5,data.strength??1.5,value=>progress((i+value)/channels.length)));result=data.preserveVideo?await replaceSoundtrack(data.file,wav(cleaned,sampleRate),progress):{blob:wav(cleaned,sampleRate),extension:"wav"};}
    else {status("Extracting stereo centre and sides");const stems=stereoStems(channels);if(data.kind==="music")result=await replaceSoundtrack(data.file,wav(stems.centre,sampleRate),progress);else result={blob:wav(stems.sides,sampleRate),secondary:wav(stems.centre,sampleRate),extension:"wav"};}}
  scope.postMessage({type:"done",result});
}catch(error){scope.postMessage({type:"error",message:error instanceof Error?error.message:"Processing failed. Try another file or browser."});}};

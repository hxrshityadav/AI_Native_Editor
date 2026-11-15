import { expect, it, vi } from "vitest";
import { denoise, resampleMono, stereoStems, wav } from "../../src/lib/localtools/dsp";
import { fitSpeech, speechText, subtitles, validateCues } from "../../src/lib/localtools/text";
import { localModelAsset } from "../../src/lib/localtools/modelAssets";
import { translateCues } from "../../src/lib/localtools/translate";
import { GET as modelAssetGet } from "../../src/app/local-models/[...asset]/route";

it("validates speech before loading optional model assets",()=>{
  expect(speechText(" Hello ")).toBe("Hello");
  expect(()=>speechText(" ")).toThrow(/1–500/);
  expect(()=>speechText("a".repeat(501))).toThrow(/1–500/);
  expect(speechText("a".repeat(500))).toHaveLength(500);
});

it("writes measured, interleaved PCM WAV headers and clips samples",async()=>{
  const output=wav([new Float32Array([-2,.5]),new Float32Array([2,-.5])],16000),view=new DataView(await output.arrayBuffer());
  expect(output.type).toBe("audio/wav");expect(output.size).toBe(52);expect(view.getUint16(22,true)).toBe(2);expect(view.getUint32(24,true)).toBe(16000);expect(view.getInt16(44,true)).toBe(-32768);expect(view.getInt16(46,true)).toBe(32767);expect(()=>wav([],16000)).toThrow();
});
it("downmixes and resamples using all source samples",()=>{
  expect([...resampleMono([new Float32Array([1,0,1,0]),new Float32Array([0,1,0,1])],32000)]).toEqual([.5,.5]);
});
it("centre/side separation cancels only centred content and rejects mono or dual mono",()=>{
  const centre=Float32Array.from({length:16000},(_,i)=>.2*Math.sin(2*Math.PI*440*i/16000)),side=Float32Array.from(centre,(_,i)=>.1*Math.sin(2*Math.PI*880*i/16000));
  const left=Float32Array.from(centre,(value,i)=>value+side[i]),right=Float32Array.from(centre,(value,i)=>value-side[i]);
  const result=stereoStems([left,right]);expect(Math.max(...result.centre[0].map((value,i)=>Math.abs(value-centre[i])))).toBeLessThan(1e-7);expect(Math.max(...result.sides[0].map((value,i)=>Math.abs(value-side[i])))).toBeLessThan(1e-7);
  expect(()=>stereoStems([left])).toThrow(/stereo/);expect(()=>stereoStems([left,left])).toThrow(/identical/);
});
it("spectral subtraction reduces known stationary noise while retaining voiced content",()=>{
  const rate=16000,length=rate*2;let seed=17;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return(seed/4294967296-.5)*.08;};
  const input=Float32Array.from({length},(_,i)=>random()+(i>rate*.5?.3*Math.sin(2*Math.PI*440*i/rate):0));const progress:number[]=[];const output=denoise(input,rate,.4,1.5,value=>progress.push(value));
  const energy=(samples:Float32Array,start:number,end:number)=>samples.slice(start,end).reduce((sum,value)=>sum+value*value,0)/(end-start);
  expect(energy(output,2048,6000)).toBeLessThan(energy(input,2048,6000)*.6);expect(energy(output,18000,26000)).toBeGreaterThan(.02);expect(output.length).toBe(input.length);expect(progress.at(-1)).toBe(1);expect(()=>denoise(input,rate,4,1)).toThrow();
});
it("validates cue boundaries and emits real SRT/VTT timestamps",()=>{
  const cues=validateCues([{text:" Hello --> world ",start:.125,end:1.75}],2);
  expect(subtitles(cues,"srt")).toContain("00:00:00,125 --> 00:00:01,750\nHello → world");expect(subtitles(cues,"vtt")).toMatch(/^WEBVTT/);expect(()=>validateCues([{text:"x",start:1,end:3}],2)).toThrow();expect(()=>validateCues([{text:"",start:0,end:1}],2)).toThrow();
});
it("fits dubbed speech to segment starts without overwriting adjacent silence",()=>{
  const cues=[{text:"Hello",start:1,end:2}],output=fitSpeech(new Float32Array(48000),16000,cues,[new Float32Array(16000).fill(.5)]);
  expect(output.slice(0,16000).every(value=>value===0)).toBe(true);expect(output[17000]).toBe(.5);expect(output.slice(32000).every(value=>value===0)).toBe(true);expect(()=>fitSpeech(output,16000,cues,[new Float32Array(30000)])).toThrow(/Shorten/);
});
it("model delivery allows fixed assets only and rejects arbitrary hosts or paths",()=>{
  expect(localModelAsset(["Xenova","speecht5_tts","resolve","main","onnx","encoder_model_quantized.onnx"])).toMatch(/^https:\/\/huggingface.co\/Xenova/);
  for(const path of [["https:","evil.example"],["Xenova","arbitrary","resolve","main","config.json"],["Xenova","speecht5_tts","resolve","main","..","secret"],["speaker.bin","extra"]])expect(localModelAsset(path)).toBeUndefined();
});
it("translation never falls back to a cloud provider when the local API is missing",async()=>{
  vi.stubGlobal("Translator",undefined);try{await expect(translateCues([{text:"Hello",start:0,end:1}],"fr",new AbortController().signal,()=>{})).rejects.toThrow(/No cloud fallback/);}finally{vi.unstubAllGlobals();}
});
it("public model delivery retries a transient failure without accepting media or arbitrary models",async()=>{
  const fetchAsset=vi.fn().mockResolvedValueOnce(new Response("busy",{status:503})).mockResolvedValueOnce(new Response('{"ok":true}',{headers:{"Content-Type":"application/json"}}));
  vi.stubGlobal("fetch",fetchAsset);
  try{const response=await modelAssetGet(new Request("https://reel.example/local-models/config"),{params:Promise.resolve({asset:["onnx-community","whisper-tiny","resolve","main","config.json"]})});expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true});expect(fetchAsset).toHaveBeenCalledTimes(2);expect(fetchAsset.mock.calls[0][0]).toBe("https://huggingface.co/onnx-community/whisper-tiny/resolve/ff4177021cc41f7db950912b73ea4fdf7d01d8e7/config.json");
    const unknown=await modelAssetGet(new Request("https://reel.example/local-models/private"),{params:Promise.resolve({asset:["private"]})});expect(unknown.status).toBe(404);expect(fetchAsset).toHaveBeenCalledTimes(2);
  }finally{vi.unstubAllGlobals();}
});

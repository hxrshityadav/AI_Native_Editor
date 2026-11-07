import type { Cue } from "./text";
type NativeTranslator={translate:(text:string,options:{signal:AbortSignal})=>Promise<string>;destroy:()=>void};
type TranslatorApi={create:(options:{sourceLanguage:string;targetLanguage:string;signal:AbortSignal;monitor:(monitor:{addEventListener:(name:string,callback:(event:{loaded:number})=>void)=>void})=>void})=>Promise<NativeTranslator>};
export async function translateCues(cues:Cue[],target:string,signal:AbortSignal,status:(message:string)=>void):Promise<Cue[]>{
  const api=(globalThis as unknown as {Translator?:TranslatorApi}).Translator;
  if(!api)throw new Error("This browser has no on-device Translator API. Use a supported desktop Chrome/Edge, or keep the local English translation. No cloud fallback is used.");
  if(!["hi","es","fr","de","pt","it","ja","zh"].includes(target))throw new Error("Choose a supported target language.");
  // Called by a separate user click so downloading a browser language pack retains user activation.
  const translator=await api.create({sourceLanguage:"en",targetLanguage:target,signal,monitor:monitor=>monitor.addEventListener("downloadprogress",event=>status(`Downloading local translation pack: ${Math.round(event.loaded*100)}%`))});
  try{const result:Cue[]=[];for(let i=0;i<cues.length;i++){if(signal.aborted)throw new DOMException("Cancelled","AbortError");status(`Translating segment ${i+1} of ${cues.length} locally`);result.push({...cues[i],text:await translator.translate(cues[i].text,{signal})});}return result;}finally{translator.destroy();}
}

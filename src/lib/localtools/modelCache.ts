import { LOCAL_MODEL_VERSION } from "./modelAssets";
export const LOCAL_MODEL_CACHE=`reel-finisher-models-${LOCAL_MODEL_VERSION}`;
export const SPEAKER_SHA256="7384027325428d6eda21f47213572541443f5864044295a2e5c07fbaaf372bb3";
const MODEL_BYTES: Record<string, number> = {
  "Xenova/speecht5_tts/resolve/main/onnx/encoder_model_quantized.onnx": 88402301,
  "Xenova/speecht5_tts/resolve/main/onnx/decoder_model_merged.onnx": 244486683,
  "Xenova/speecht5_hifigan/resolve/main/onnx/model.onnx": 55432026,
  "onnx-community/whisper-tiny/resolve/main/onnx/encoder_model_q4.onnx": 9020667,
  "onnx-community/whisper-tiny/resolve/main/onnx/decoder_model_merged_q4.onnx": 86713702,
};

/** Public model assets only: isolated from Studio/project caches and never cleared implicitly. */
export function publicModelCache(origin: string) {
  const storage=globalThis.caches?.open(LOCAL_MODEL_CACHE).catch(()=>undefined);
  const key=(input:RequestInfo|URL)=>{
    const url=new URL(input instanceof Request?input.url:String(input),origin);
    return url.origin===origin&&url.pathname.startsWith(`/local-models/${LOCAL_MODEL_VERSION}/`)?url.href:undefined;
  };
  return {
    async match(input:RequestInfo|URL){
      const url=key(input);
      try {
        if(!url)return undefined;
        const cache=await storage,response=await cache?.match(url);
        const expected=MODEL_BYTES[new URL(url).pathname.split(`/local-models/${LOCAL_MODEL_VERSION}/`)[1]];
        // Blob size detects truncation without creating a second JS ArrayBuffer of large weights.
        if(response&&expected){
          const blob=await response.blob();
          if(blob.size!==expected){await cache?.delete(url);return undefined;}
          return new Response(blob,{status:response.status,headers:response.headers});
        }
        return response;
      }catch{return undefined;}
    },
    async put(input:RequestInfo|URL,response:Response){const url=key(input);try{if(url)await(await storage)?.put(url,response);}catch{/* Quota/private-mode failures must not prevent an online job. */}},
    async delete(input:RequestInfo|URL){const url=key(input);try{if(url)await(await storage)?.delete(url);}catch{}},
  };
}
export async function speakerVector(origin:string,cache:ReturnType<typeof publicModelCache>):Promise<Float32Array>{
  if(!globalThis.crypto?.subtle)throw new Error("Speech model integrity checks need HTTPS or localhost.");
  const url=`${origin}/local-models/${LOCAL_MODEL_VERSION}/speaker.bin`;
  for(let attempt=0;attempt<2;attempt++){
    const cached=attempt===0?await cache.match(url):undefined;
    const response=cached??await fetch(url);
    if(!response.ok)throw new Error("The generic voice asset could not load. Reconnect and retry.");
    const bytes=await response.arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),n=>n.toString(16).padStart(2,"0")).join("");
    if(bytes.byteLength===2048&&hash===SPEAKER_SHA256){if(!cached)await cache.put(url,new Response(bytes,{headers:{"Content-Type":"application/octet-stream"}}));return new Float32Array(bytes);}
    await cache.delete(url);
    if(!cached)break;
  }
  throw new Error("The generic voice asset failed its integrity check. Reconnect and retry; no speech was generated.");
}

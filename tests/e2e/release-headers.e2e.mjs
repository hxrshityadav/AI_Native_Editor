import { mkdirSync,writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT,startServer,stopServer,createChecks } from "./helpers.mjs";
const OUT=join(ROOT,"output/release-certification"),BASE="http://localhost:3189",server=await startServer(3189,{env:{REEL_ENABLE_CLOUD:""}}),results=[];
mkdirSync(OUT,{recursive:true});const {check,finish}=createChecks();
try{
 const paths=["/","/studio","/local-ai/speech.worker.js","/local-ai/ort-wasm-simd-threaded.jsep.wasm","/local-ai/rnnoise-0.2.1.wasm","/pdfjs/6.5.438/pdf.min.mjs","/local-models/v1/Xenova/speecht5_tts/resolve/main/onnx/decoder_model_merged.onnx","/editor-models/onnx-community/whisper-tiny/resolve/main/config.json"];
 for(const path of paths){const response=await fetch(BASE+path,{method:"HEAD",signal:AbortSignal.timeout(35000)});const headers=Object.fromEntries(response.headers);results.push({path,status:response.status,headers});check("local headers: "+path+" responds successfully",response.ok);
  if(path.endsWith(".wasm"))check("local MIME: "+path,headers["content-type"]==="application/wasm");
  if(/\.(mjs|js)$/.test(path))check("local MIME: "+path,/^(?:text|application)\/javascript/.test(headers["content-type"]??""));
  if(path.endsWith("decoder_model_merged.onnx"))check("local decoder HEAD: measured length and immutable/noindex",Number(headers["content-length"])===244486683&&headers["content-type"]==="application/octet-stream"&&headers["cache-control"]?.includes("immutable")&&headers["x-robots-tag"]?.includes("noindex"));
  if(path==="/")check("local homepage: no global isolation",!headers["cross-origin-opener-policy"]&&!headers["cross-origin-embedder-policy"]);
  if(path==="/studio")check("local Studio: isolation retained",headers["cross-origin-opener-policy"]==="same-origin"&&headers["cross-origin-embedder-policy"]==="require-corp");
 }
 const native=await fetch(BASE+"/editor-models/onnx-community/whisper-tiny/resolve/main/config.json",{signal:AbortSignal.timeout(35000)});
 check("local Studio model GET: actual JSON streams through the runtime adapter",native.ok&&(await native.json()).model_type==="whisper");
 const denied=await fetch(BASE+"/local-models/v1/unapproved-model",{method:"HEAD"});check("local model errors: unknown assets are no-store",denied.status===404&&denied.headers.get("cache-control")==="no-store");
}finally{writeFileSync(join(OUT,"headers-local.json"),JSON.stringify(results,null,2));await stopServer(server);}finish();

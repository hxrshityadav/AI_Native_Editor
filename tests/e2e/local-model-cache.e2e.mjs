import { chromium, firefox } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, probe, streams, decodeErrors, startServer, stopServer, createChecks } from "./helpers.mjs";
const OUT=join(ROOT,"output/local-ai-cache"),PORT=3184,BASE=`http://localhost:${PORT}`,CACHE="reel-finisher-models-v1";
mkdirSync(OUT,{recursive:true});const {check,finish}=createChecks();
const server=await startServer(PORT,{env:{REEL_ENABLE_CLOUD:""}}),browser=process.env.LOCAL_CACHE_BROWSER==="firefox"?await firefox.launch({executablePath:join(ROOT,"output/firefox-test/firefox/firefox.exe")}):await chromium.launch({channel:process.env.LOCAL_CACHE_BROWSER||"chrome"});
try{
 const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),requests=[];context.on("request",r=>requests.push({url:r.url(),method:r.method()}));
 await page.goto(BASE+"/tools/text-to-speech");check("cache: speech page does not load a model/runtime before consent",requests.every(r=>!r.url.includes("/local-ai/")&&!r.url.includes("/local-models/")&&!r.url.includes("/pdfjs/")));
 const decoderPath="/local-models/v1/Xenova/speecht5_tts/resolve/main/onnx/decoder_model_merged.onnx";
 const interrupted=await page.evaluate(async path=>Promise.all([1,2].map(async()=>{
  const controller=new AbortController(),response=await fetch(path,{signal:controller.signal,cache:"no-store"}),reader=response.body.getReader();
  const chunk=await reader.read();controller.abort();await reader.cancel().catch(()=>{});
  return response.ok&&chunk.value?.length>0;
 })),decoderPath);
 check("delivery: two concurrent decoder streams deliver bytes and permit client interruption (localhost only)",interrupted.every(Boolean));
 await page.evaluate(async()=>{
  const old=await caches.open("transformers-cache");await old.put(`${location.origin}/local-models/Xenova/speecht5_tts/resolve/main/onnx/encoder_model_quantized.onnx`,new Response("unversioned sentinel"));
  const unrelated=await caches.open("openreel-cache-sentinel");await unrelated.put(`${location.origin}/editor/sentinel`,new Response("keep Studio data"));
  await new Promise((resolve,reject)=>{const r=indexedDB.open("creator-cache-sentinel",1);r.onupgradeneeded=()=>r.result.createObjectStore("records");r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction("records","readwrite");t.objectStore("records").put("keep project","original");t.oncomplete=()=>{db.close();resolve();};};});
 });
 async function ready(label){await Promise.race([page.getByRole("link",{name:label,exact:true}).waitFor({timeout:900000}),page.getByRole("alert").filter({hasText:/\w/}).waitFor({timeout:900000}).then(async()=>{throw new Error(await page.getByRole("alert").filter({hasText:/\w/}).innerText());})]);}
 async function download(label,name){await ready(label);const pending=page.waitForEvent("download");await page.getByRole("link",{name:label,exact:true}).click();const path=join(OUT,`${process.env.LOCAL_CACHE_BROWSER||"chrome"}-${name}`);await(await pending).saveAs(path);return path;}
 async function synthesize(text,name){await page.getByLabel("Text to read",{exact:true}).fill(text);await page.getByLabel("Allow speech model download",{exact:true}).check();await page.getByRole("button",{name:"Generate speech",exact:true}).click();return download("Download WAV",name);}
 const startedCold=Date.now(),wav=await synthesize("Hello from Reel Finisher. Keep your work on this device.","cold.wav");
 writeFileSync(join(OUT,`browser-${process.env.LOCAL_CACHE_BROWSER||"chrome"}.json`),JSON.stringify({version:browser.version(),coldSpeechMs:Date.now()-startedCold,environment:await page.evaluate(()=>({ua:navigator.userAgent,wasm:typeof WebAssembly!=="undefined",webgpu:!!navigator.gpu,crossOriginIsolated}))},null,2));
 check("cache: cold real speech produces a valid PCM WAV",streams(probe(wav),"audio")[0].codec_name==="pcm_s16le"&&Number(probe(wav).format.duration)>0&&!decodeErrors(wav));
 async function hashes(files){return page.evaluate(async({name,files})=>{const cache=await caches.open(name),keys=await cache.keys(),result=[];for(const file of files){const key=keys.find(k=>new URL(k.url).pathname.endsWith(file));if(!key)throw new Error(`Missing cached model ${file}`);const bytes=await(await cache.match(key)).arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),n=>n.toString(16).padStart(2,"0")).join("");result.push({file,bytes:bytes.byteLength,hash});}return result;},{name:CACHE,files});}
 const speechHashes=await hashes(["/onnx/encoder_model_quantized.onnx","/onnx/decoder_model_merged.onnx","/onnx/model.onnx","/speaker.bin"]);
 const expected=[[88402301,"407375255d220d8ddf81e9a06d4100f80f870f8446e77d4f20951d2a4c08a156"],[244486683,"c055656c559c5d17055a87d5c7ec544326b8852d372f171ce27c52945d836465"],[55432026,"26408d9b8b3e83e66a3ef614a5621b84cacdcabd81b3a6a2fa984eb788566e6c"],[2048,"7384027325428d6eda21f47213572541443f5864044295a2e5c07fbaaf372bb3"]];
 check("cache: actual downloaded speech bytes and SHA-256 match reviewed artifacts",speechHashes.every((item,i)=>item.bytes===expected[i][0]&&item.hash===expected[i][1]));
 await page.evaluate(async({name,path})=>{const cache=await caches.open(name);await cache.put(location.origin+path,new Response("truncated weight",{headers:{"Content-Length":"244486683"}}));},{name:CACHE,path:decoderPath});
 const repaired=await synthesize("A repaired download keeps the original project safe.","repaired.wav");
 const repairedHash=(await hashes(["/onnx/decoder_model_merged.onnx"]))[0];
 check("cache: a truncated decoder is repaired on retry without clearing model or project stores",repairedHash.bytes===expected[1][0]&&repairedHash.hash===expected[1][1]&&!decodeErrors(repaired));
 async function transcribe(name){await page.getByLabel("Choose recording",{exact:true}).setInputFiles(wav);await page.getByLabel("Speech language").selectOption("en");await page.getByLabel("Allow local model download").check();await page.getByRole("button",{name:"Transcribe locally",exact:true}).click();return download("Download TXT",name);}
 await page.goto(BASE+"/tools/transcribe-to-text");const transcript=await transcribe("cold.txt");check("cache: real Whisper recognizes corrected standalone synthesis",/work[\s\S]*device/i.test(readFileSync(transcript,"utf8")));
 const whisperHashes=await hashes(["/onnx/encoder_model_q4.onnx","/onnx/decoder_model_merged_q4.onnx"]);
 writeFileSync(join(OUT,`hashes-${process.env.LOCAL_CACHE_BROWSER||"chrome"}.json`),JSON.stringify({cache:CACHE,artifacts:[...speechHashes,...whisperHashes]},null,2));
 check("cache: actual Whisper bytes and hashes match the pinned revision",whisperHashes[0].bytes===9020667&&whisperHashes[0].hash==="45a55cedf1ff46606520f5938ed40c94bd4f6b38beb2a646eed8636225342488"&&whisperHashes[1].bytes===86713702&&whisperHashes[1].hash==="a7573efde84f7d018d59e50e7f860c03e26623d68e23eb6037b76135367e72eb");
 let blocked=0;await context.route("**/local-models/**",route=>{blocked++;return route.abort();});await page.reload();const warm=await transcribe("cached.txt");check("cache: reload and a fresh ASR worker succeed with model network blocked",/work[\s\S]*device/i.test(readFileSync(warm,"utf8")));
 await page.goto(BASE+"/tools/text-to-speech");const cachedWav=await synthesize("Keep your work on this device.","cached.wav");check("cache: a fresh TTS worker reuses verified assets with model network blocked",Number(probe(cachedWav).format.duration)>0&&!decodeErrors(cachedWav));
 check("cache: required cached models do not attempt a redownload",blocked===0,`${blocked} blocked model requests`);
 const preserved=await page.evaluate(async name=>{const own=await caches.open(name),old=await caches.open("transformers-cache"),studio=await caches.open("openreel-cache-sentinel");const project=await new Promise((resolve,reject)=>{const r=indexedDB.open("creator-cache-sentinel");r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction("records").objectStore("records").get("original");q.onsuccess=()=>{db.close();resolve(q.result);};};});return {keys:(await own.keys()).map(k=>k.url),old:await(await old.match(`${location.origin}/local-models/Xenova/speecht5_tts/resolve/main/onnx/encoder_model_quantized.onnx`)).text(),studio:await(await studio.match(`${location.origin}/editor/sentinel`)).text(),project};},CACHE);
 check("cache: only versioned public model URLs enter the new cache",preserved.keys.length>=6&&preserved.keys.every(key=>key.startsWith(BASE+"/local-models/v1/")));
 check("cache: old model caches, Studio cache and project storage are preserved",preserved.old==="unversioned sentinel"&&preserved.studio==="keep Studio data"&&preserved.project==="keep project");
 check("cache: all browser HTTP requests are same-origin GET/HEAD",requests.filter(r=>/^https?:/.test(r.url)).every(r=>r.url.startsWith(BASE)&&["GET","HEAD"].includes(r.method)));
 const [home,pdf,noise,model]=await Promise.all(["/","/pdfjs/6.5.438/pdf.min.mjs","/local-ai/rnnoise-0.2.1.wasm","/local-models/v1/Xenova/speecht5_tts/resolve/main/config.json"].map(path=>fetch(BASE+path,{method:"HEAD"})));
 check("headers: pinned public assets are immutable and noindex",[pdf,noise,model].every(response=>response.ok&&response.headers.get("Cache-Control")?.includes("immutable")&&response.headers.get("X-Robots-Tag")?.includes("noindex")));
 check("headers: public homepage gains no cross-origin isolation requirement",!home.headers.has("Cross-Origin-Opener-Policy")&&!home.headers.has("Cross-Origin-Embedder-Policy"));
 await context.close();
}finally{await browser.close();await stopServer(server);}finish();

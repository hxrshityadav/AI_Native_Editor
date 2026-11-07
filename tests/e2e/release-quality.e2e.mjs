// Opt-in release measurements; generated noises are controlled proxies, not field recordings.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, ff, probe, decodeErrors, startServer, stopServer } from "./helpers.mjs";
const OUT=join(ROOT,"output/release-certification"),PORT=3186,BASE=`http://localhost:${PORT}`;
mkdirSync(OUT,{recursive:true});
const recordings=JSON.parse(readFileSync(join(OUT,"recordings.json"),"utf8"));
const server=await startServer(PORT,{env:{REEL_ENABLE_CLOUD:""}}),browser=await chromium.launch({channel:"chrome"});
const report={scope:"Local production build, desktop Chrome. No physical-device or perceptual certification.",jobs:[],requests:[],errors:[]};
function wordErrors(reference,hypothesis){
 const words=s=>s.toLowerCase().replace(/[^a-z0-9' ]/g," ").split(/\s+/).filter(Boolean),a=words(reference),b=words(hypothesis);
 const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+Number(a[i-1]!==b[j-1]));
 let i=a.length,j=b.length,substitutions=0,deletions=0,insertions=0;
 while(i||j){if(i&&j&&d[i][j]===d[i-1][j-1]+Number(a[i-1]!==b[j-1])){substitutions+=Number(a[i-1]!==b[j-1]);i--;j--;}else if(i&&d[i][j]===d[i-1][j]+1){deletions++;i--;}else{insertions++;j--;}}
 return{referenceWords:a.length,substitutions,deletions,insertions,wer:(substitutions+deletions+insertions)/Math.max(1,a.length)};
}
if(wordErrors("one two three","one four three").substitutions!==1||wordErrors("one two","one").deletions!==1||wordErrors("one","one two").insertions!==1)throw new Error("WER self-check failed");
try{
 const context=await browser.newContext(),page=await context.newPage(),cdp=await browser.newBrowserCDPSession();
 context.on("request",r=>report.requests.push({url:r.url(),method:r.method()}));
 await page.goto(BASE+"/tools/text-to-speech");
 await page.evaluate(()=>{const input=document.createElement("input");input.type="file";input.id="release-fixture";input.hidden=true;document.body.appendChild(input);});
 const capabilities=await page.evaluate(()=>({ua:navigator.userAgent,webgpu:!!navigator.gpu,webcodecs:typeof VideoEncoder!=="undefined",wasm:typeof WebAssembly!=="undefined",crossOriginIsolated}));report.capabilities=capabilities;
 async function run(label,message,{file,worker="speech",cancelMs,cancelAfterPhase,background=false,expectedError}={}){
  const started=Date.now();let peak=0,samples=0,busy=false;
  const monitor=setInterval(async()=>console.log(label,"pending",Date.now()-started,"ms",await page.evaluate(()=>window.__releasePhase??"").catch(()=>"page unavailable")),30000);
  const memory=setInterval(async()=>{if(busy)return;busy=true;try{const {processInfo}=await cdp.send("SystemInfo.getProcessInfo");const ids=processInfo.map(p=>p.id).filter(Number.isInteger);if(ids.length){const value=Number(execFileSync("powershell.exe",["-NoProfile","-Command",`(Get-Process -Id ${ids.join(",")} -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum`],{encoding:"utf8",timeout:5000}).trim());peak=Math.max(peak,value);samples++;}}catch{}finally{busy=false;}},2000);
  let other,visibility;
  try{
   if(background){other=await context.newPage();await other.goto(BASE+"/tools");await other.bringToFront();visibility=await page.evaluate(()=>document.visibilityState);}
   if(file)await page.locator("#release-fixture").setInputFiles(file);
   const result=await page.evaluate(async({message,hasFile,worker,cancelMs,cancelAfterPhase})=>{
    if(hasFile)message.file=document.getElementById("release-fixture").files[0];
    return new Promise((resolve,reject)=>{
     const w=new Worker(`/local-ai/${worker}.worker.js`,{type:"module"});let timer,cancel;
     const clean=()=>{clearTimeout(timer);clearTimeout(cancel);w.terminate();};
     timer=setTimeout(()=>{clean();reject(new Error("Release job timed out"));},900000);
     const cancelJob=()=>{clean();resolve({cancelled:true,cancelledAfterPhase:cancelAfterPhase??"worker startup"});};
     if(cancelMs&&!cancelAfterPhase)cancel=setTimeout(cancelJob,cancelMs);
     w.onerror=()=>{clean();reject(new Error("Release worker failed"));};
     w.onmessage=async({data})=>{if(data.type==="phase"){window.__releasePhase=data.value;if(cancelMs&&data.value===cancelAfterPhase)cancel=setTimeout(cancelJob,cancelMs);}if(data.type==="error"){clean();reject(new Error(data.message));}else if(data.type==="done"){
      clean();const {blob,...rest}=data.result;
      const audio=blob?await new Promise((res,rej)=>{const reader=new FileReader();reader.onload=()=>res(String(reader.result).split(",")[1]);reader.onerror=rej;reader.readAsDataURL(blob);}):undefined;
      resolve({...rest,audio,mime:blob?.type});
     }};w.postMessage(message);
    });
   },{message,worker,hasFile:!!file,cancelMs,cancelAfterPhase});
   let path;
   if(result.audio){path=join(OUT,label+".wav");writeFileSync(path,Buffer.from(result.audio,"base64"));delete result.audio;if(decodeErrors(path))throw new Error("Invalid generated audio");result.measuredSeconds=Number(probe(path).format.duration);}
   const entry={label,ms:Date.now()-started,sampledAggregateRssBytes:samples?peak:null,memorySamples:samples,backgroundVisibility:visibility,...result};report.jobs.push(entry);if(expectedError)report.errors.push({label,error:"Expected rejection was absent"});if(cancelMs&&!result.cancelled)report.errors.push({label,error:"Expected cancellation did not occur"});console.log(label,entry.ms,"ms",entry.measuredSeconds??"",result.cancelled?"cancelled":"");return{...entry,path};
  }catch(error){if(expectedError&&String(error).includes(expectedError))report.jobs.push({label,expectedRejection:String(error),ms:Date.now()-started});else report.errors.push({label,error:String(error)});console.error(label,String(error));return{error:String(error)};}finally{clearInterval(memory);clearInterval(monitor);await other?.close();writeFileSync(join(OUT,"quality.json"),JSON.stringify(report,null,2));}
 }
 const passages=[
  ["english","The sky is blue. We keep our work on this device, and read each sentence carefully."],
  ["names","My name is Priya Sharma. Dr. Wilson meets Aisha and Miguel in London."],
  ["numbers","There are twenty three students. The total is one hundred and five dollars, due on November fourth."],
  ["abbreviations","Dr. Smith uses the CPU and USB drive. The meeting starts at 3 p.m. on Monday."],
  ["joins","Wait! Are you ready? Yes, I am ready. After the first sentence, take a short breath; then continue calmly."],
  ["long","When you finish reviewing the document, save a copy of the original, check the names and numbers carefully, and listen to the complete recording before sharing it with your class."],
  ["hinglish-unsupported","Namaste dosto, aaj hum video editing seekhenge. Please apna project save karna."],
  ["hindi-unsupported","नमस्ते दोस्तों। आज हम वीडियो संपादन सीखेंगे।"]
 ];
 for(const [label,text]of passages){
  const audio=await run(label,{kind:"synthesize",text},{background:label==="joins",expectedError:label==="hindi-unsupported"?"English text only":undefined});
  if(audio.path&&!label.includes("unsupported")){
   const transcript=await run(label+"-roundtrip",{kind:"transcribe",language:"en",translate:false,longRecording:true},{file:audio.path});
   if(transcript.text)report.jobs.at(-1).asrProxy=wordErrors(text,transcript.text);
  }
 }
 await page.evaluate(async()=>{const cache=await caches.open("reel-finisher-models-v1");await cache.delete(location.origin+"/local-models/v1/speaker.bin");});
 await context.route("**/speech.worker.js",async route=>{const response=await route.fetch();await route.fulfill({response,body:'Cache.prototype.put=async()=>{throw new DOMException("Injected quota pressure","QuotaExceededError");};\n'+await response.text()});});
 await run("quota-write-failure",{kind:"synthesize",text:"A storage write failure still permits an online job."});
 const persisted=await page.evaluate(async()=>!!await(await caches.open("reel-finisher-models-v1")).match(location.origin+"/local-models/v1/speaker.bin"));
 if(persisted)report.errors.push({label:"quota-write-failure",error:"Quota injection did not prevent the voice cache write"});
 await context.unroute("**/speech.worker.js");
 await run("cancel-synthesis",{kind:"synthesize",text:passages[5][1]},{cancelMs:750,cancelAfterPhase:"Generating English speech locally"});
 await run("retry-after-cancel",{kind:"synthesize",text:"A fresh job can run after cancellation."});
 for(const recording of recordings){
  const wav=join(OUT,recording.id+".wav");ff("-i",join(OUT,recording.id+".flac"),"-ar","16000",wav);
  await run(recording.id+"-resynthesized",{kind:"synthesize",text:recording.text});
  const actual=await run(recording.id+"-transcript",{kind:"transcribe",language:"en",translate:false,longRecording:true},{file:wav});
  if(actual.text)report.jobs.at(-1).asrProxy=wordErrors(recording.text,actual.text);
 }
 const clean=join(OUT,recordings[0].id+".wav");
 const noiseClean=join(OUT,"noise-reference.wav");ff("-stream_loop","-1","-i",clean,"-t","60",noiseClean);
 let noiseRequests=0;await context.route("**/rnnoise-0.2.1.wasm",route=>{noiseRequests++;return noiseRequests===1?route.fulfill({body:"corrupt runtime",contentType:"application/wasm"}):route.continue();});
 for(const [label,noise]of [["fan","anoisesrc=color=brown:amplitude=0.12:sample_rate=16000:duration=60:seed=3"],["traffic","anoisesrc=color=pink:amplitude=0.1:sample_rate=16000:duration=60:seed=4"],["keyboard","anoisesrc=amplitude=0.15:sample_rate=16000:duration=60:seed=6,volume=if(lt(mod(t\\,0.5)\\,0.04)\\,1\\,0):eval=frame"],["room","anoisesrc=color=pink:amplitude=0.03:sample_rate=16000:duration=60:seed=5"],["hiss","anoisesrc=amplitude=0.03:sample_rate=16000:duration=60:seed=7"],["clean",null]]){
  const input=join(OUT,label+"-original.wav");if(noise)ff("-i",noiseClean,"-f","lavfi","-i",noise,"-filter_complex","amix=inputs=2:duration=first:normalize=0",input);else ff("-i",noiseClean,input);
  const output=await run(label+"-processed",{kind:"noise",neural:true},{file:input,worker:"noise"});
  if(output.path){
   const decode=path=>{const bytes=execFileSync("ffmpeg",["-v","error","-i",path,"-f","f32le","-"],{maxBuffer:10000000});return new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));};
   const original=decode(input),processed=decode(output.path),reference=decode(noiseClean),rms=s=>Math.sqrt(s.reduce((sum,x)=>sum+x*x,0)/s.length);
   let dot=0,a=0,b=0;for(let i=0;i<Math.min(reference.length,processed.length);i++){dot+=reference[i]*processed[i];a+=reference[i]**2;b+=processed[i]**2;}
   report.jobs.at(-1).audioMetrics={originalFrames:original.length,processedFrames:processed.length,rmsRatio:rms(processed)/rms(original),cleanCorrelation:dot/Math.sqrt(a*b),clippedSamples:processed.filter(x=>Math.abs(x)>=32767/32768).length};
   if(original.length!==processed.length||processed.some(x=>!Number.isFinite(x)))report.errors.push({label,error:"Sample count/nonfinite audio regression"});
  }
 }
 if(noiseRequests<2)report.errors.push({label:"RNNoise recovery",error:"Did not retry corrupt runtime"});
 await context.unroute("**/rnnoise-0.2.1.wasm");
 await context.route("**/rnnoise-0.2.1.wasm",route=>route.fulfill({body:"still corrupt",contentType:"application/wasm"}));
 await run("rnnoise-integrity-rejection",{kind:"noise",neural:true},{file:clean,worker:"noise",expectedError:"integrity check failed after retry"});
 await context.unroute("**/rnnoise-0.2.1.wasm");
 await run("dsp-fallback",{kind:"noise",neural:false},{file:clean,worker:"media"});
 const ten=join(OUT,"ten-minutes.wav");ff("-stream_loop","-1","-i",clean,"-i",join(OUT,recordings[1].id+".wav"),"-filter_complex","[0:a]atrim=0:590,asetpts=PTS-STARTPTS[head];[1:a]apad=whole_dur=10,atrim=0:10,asetpts=PTS-STARTPTS[tail];[head][tail]concat=n=2:v=0:a=1","-t","600","-ar","16000",ten);
 const long=await run("ten-minutes-transcript",{kind:"transcribe",language:"en",translate:false,longRecording:true},{file:ten});
 if(!long.cues?.length||long.duration!==600||long.cues.at(-1).end<590||long.cues.at(-1).end>600||long.cues.some((cue,i)=>cue.start<0||cue.end<=cue.start||(i&&cue.start<long.cues[i-1].end)))report.errors.push({label:"ten-minutes-transcript",error:"Full-length ordered timestamp coverage failed"});
 if(!/manner|matter|interesting/i.test(long.cues?.filter(c=>c.end>=590).map(c=>c.text).join(" ")??""))report.errors.push({label:"ten-minutes-transcript",error:"Distinctive final passage was not recognized near 590 seconds"});
 await run("cancel-ten-minutes",{kind:"transcribe",language:"en",translate:false,longRecording:true},{file:ten,cancelMs:1000,cancelAfterPhase:"Recognizing speech locally"});
 await run("transcription-retry-after-cancel",{kind:"transcribe",language:"en",translate:false,longRecording:true},{file:clean});
 report.privacySameOriginReadOnly=report.requests.filter(r=>/^https?:/.test(r.url)).every(r=>r.url.startsWith(BASE)&&["GET","HEAD"].includes(r.method));
 await context.close();
}finally{writeFileSync(join(OUT,"quality.json"),JSON.stringify(report,null,2));await browser.close();await stopServer(server);}
if(report.errors.length||!report.privacySameOriginReadOnly)process.exitCode=1;

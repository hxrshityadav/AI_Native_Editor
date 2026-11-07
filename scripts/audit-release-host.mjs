// Run against an explicitly supplied HTTPS deployment; never silently certify localhost.
import { createHash } from "node:crypto";
import { mkdirSync,writeFileSync } from "node:fs";
const input=process.argv[2];
if(!input){console.error("BLOCKED: supply the intended HTTPS deployment origin: node scripts/audit-release-host.mjs https://your-host");process.exit(2);}
const origin=new URL(input);
if(origin.protocol!=="https:"||origin.username||origin.password||origin.pathname!=="/"||origin.search||origin.hash)throw new Error("Supply only the intended public HTTPS origin");
const hostname=origin.hostname.toLowerCase().replace(/\.$/,"");
if(hostname==="localhost"||hostname.endsWith(".localhost")||/^(?:127(?:\.\d+){3}|0\.0\.0\.0|\[?::1?\]?)$/.test(hostname))throw new Error("Loopback cannot certify production hosting. Supply the actual deployed public HTTPS origin.");
const report={origin:origin.origin,started:new Date().toISOString(),checks:[],downloads:[]};
const check=(name,ok,detail)=>{report.checks.push({name,ok,detail});console.log(ok?"PASS":"FAIL",name);};
const model="/local-models/v1/Xenova/speecht5_tts/resolve/main/onnx/decoder_model_merged.onnx",expectedBytes=244486683,expectedHash="c055656c559c5d17055a87d5c7ec544326b8852d372f171ce27c52945d836465";
async function download(label,interrupt=false){
 const started=Date.now(),controller=new AbortController();const timer=setTimeout(()=>controller.abort(),900000);
 try{
  const response=await fetch(new URL(model,origin),{signal:controller.signal}),hash=createHash("sha256");let bytes=0;
  for await(const chunk of response.body){bytes+=chunk.length;hash.update(chunk);if(interrupt&&bytes>=65536){controller.abort();break;}}
  const result={label,status:response.status,bytes,ms:Date.now()-started,headers:Object.fromEntries(response.headers),sha256:interrupt?undefined:hash.digest("hex"),interrupted:interrupt};report.downloads.push(result);
  check(label,response.ok&&(interrupt?bytes>0:bytes===expectedBytes&&result.sha256===expectedHash));
 }finally{clearTimeout(timer);}
}
try{
 for(const path of ["/","/tools/pdf-to-audio","/tools/text-to-speech","/robots.txt","/sitemap.xml","/studio","/studio-legacy","/lab"]){
  const r=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(30000)}),body=await r.text();check(path+" reachable",r.ok,{status:r.status,headers:Object.fromEntries(r.headers)});
  if(path==="/"||path.startsWith("/tools/")){const canonical=body.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];check(path+" canonical",canonical===new URL(path,origin).href,{canonical});}
  if(["/studio","/studio-legacy","/lab"].includes(path))check(path+" noindex",/name="robots"[^>]*content="[^"]*noindex/i.test(body)||r.headers.get("x-robots-tag")?.includes("noindex"));
  if(path==="/sitemap.xml")check("sitemap public URLs",body.includes(origin.origin)&&!/<loc>[^<]*\/(?:studio|lab|editor)(?:[\/<])/i.test(body));
  if(path==="/robots.txt")check("robots sitemap",body.includes(`Sitemap: ${origin.origin}/sitemap.xml`));
 }
 const head=await fetch(new URL(model,origin),{method:"HEAD",signal:AbortSignal.timeout(30000)});check("decoder HEAD",head.ok&&Number(head.headers.get("content-length"))===expectedBytes,{headers:Object.fromEntries(head.headers)});
 await download("first observed download");await download("interrupted",true);await download("retry after interruption");
 await Promise.all([download("concurrent A"),download("concurrent B")]);
 // Browser cache/reload needs Playwright against this same host; HTTP tests cannot establish it.
}catch(error){check("deployment audit completed",false,String(error));}
finally{mkdirSync("output/release-certification",{recursive:true});writeFileSync("output/release-certification/host.json",JSON.stringify(report,null,2));}
if(report.checks.some(c=>!c.ok))process.exitCode=1;

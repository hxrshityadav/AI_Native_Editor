// Loopback lab observations, not field CWV or physical low-memory certification.
import { chromium } from "playwright";
import { writeFileSync,mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT,startServer,stopServer } from "./helpers.mjs";
const OUT=join(ROOT,"output/redesign");mkdirSync(OUT,{recursive:true});
const server=await startServer(3194,{env:{REEL_ENABLE_CLOUD:""}}),browser=await chromium.launch({channel:"chrome"}),results=[];
try{
 for(let round=1;round<=3;round++)for(const rate of [1,4])for(const path of ["/","/tools/text-to-speech","/tools/pdf-to-audio"]){
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),session=await context.newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate",{rate});await page.addInitScript(()=>{window.__releaseLcp=null;new PerformanceObserver(list=>{window.__releaseLcp=list.getEntries().at(-1)?.startTime??null;}).observe({type:"largest-contentful-paint",buffered:true});});
  await page.goto("http://localhost:3194"+path);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1500);
  const measurements=await page.evaluate(()=>{const navigation=performance.getEntriesByType("navigation")[0],resources=performance.getEntriesByType("resource");return {ttfbMs:navigation.responseStart-navigation.requestStart,fcpMs:performance.getEntriesByName("first-contentful-paint")[0]?.startTime??null,lcpObservedMs:window.__releaseLcp,domContentLoadedMs:navigation.domContentLoadedEventEnd,transferredBytes:resources.reduce((sum,r)=>sum+r.transferSize,0)+navigation.transferSize,resourceCount:resources.length,modelRequests:resources.filter(r=>r.name.includes("/local-models/")).length};});
  results.push({round,path,cpuThrottle:rate,...measurements});console.log(JSON.stringify(results.at(-1)));await context.close();
 }
}finally{writeFileSync(join(OUT,"performance.json"),JSON.stringify({scope:"Loopback desktop Chrome, fixed 1280x900 viewport, 1x/4x CPU. Shared disk/OS caches may be warm. No physical RAM constraint. LCP observation ends 1.5 seconds after fonts ready; not a finalized field metric.",results},null,2));await browser.close();await stopServer(server);}
if(results.some(r=>r.modelRequests||!Number.isFinite(r.fcpMs)))process.exitCode=1;



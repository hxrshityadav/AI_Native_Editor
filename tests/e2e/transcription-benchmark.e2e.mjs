// Controlled worker fixtures test infrastructure only. Real ASR runs use npm run asr:benchmark.
import { chromium } from "playwright";
import { readFileSync,writeFileSync,mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT,startServer,stopServer,createChecks } from "./helpers.mjs";
const OUT=join(ROOT,"output/transcription-evaluation/e2e");mkdirSync(OUT,{recursive:true});
const {check,finish}=createChecks(),productionPort=Number(process.env.REEL_E2E_PORT||3231),devPort=3230;
const production=await startServer(productionPort),shared=process.env.REEL_E2E_PORT;let dev,browser;
try{
  check("security: benchmark is HTTP 404 in production",(await fetch(`http://localhost:${productionPort}/dev/transcription-benchmark`)).status===404);
  const robots=await(await fetch(`http://localhost:${productionPort}/robots.txt`)).text(),sitemap=await(await fetch(`http://localhost:${productionPort}/sitemap.xml`)).text();
  check("security: internal route excluded from robots and sitemap",robots.includes("Disallow: /dev/")&&!sitemap.includes("transcription-benchmark"));
  delete process.env.REEL_E2E_PORT;
  try{dev=await startServer(devPort,{dev:true,env:{REEL_ENABLE_CLOUD:""}});}finally{if(shared)process.env.REEL_E2E_PORT=shared;}
  browser=await chromium.launch({channel:"chrome"});const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:900}}),page=await context.newPage(),requests=[];context.on("request",r=>requests.push({url:r.url(),method:r.method()}));
  const base=`http://localhost:${devPort}`,datasetPath=join(ROOT,"tests/fixtures/transcription/dataset.json"),audioPath=join(ROOT,"tests/fixtures/transcription/algorithm-tone.wav");
  await page.goto(base+"/dev/transcription-benchmark");await page.locator('[data-evaluation-ready="true"]').waitFor();
  check("empty state: no invented results and run requires consent",await page.getByText("No dataset loaded.",{exact:false}).isVisible()&&await page.getByRole("button",{name:"Run selected models",exact:true}).isDisabled());
  check("privacy: no models before consent",requests.every(r=>!r.url.includes("/local-models/")&&!r.url.includes("/local-ai/")));
  let slow=false,workerRequests=0;
  await page.route("**/local-ai/speech.worker.js",route=>{if(route.request().resourceType()==="script")workerRequests++;return route.fulfill({contentType:"application/javascript",body:`self.onmessage=()=>{self.postMessage({type:"phase",value:"Controlled fixture worker running"});setTimeout(()=>self.postMessage({type:"done",result:{text:"aaj React extra chalega.",rawText:"aaj React extra chalega.",duration:4,wordTiming:false,cues:[]}}),${slow?15000:0});};`});});
  await page.getByLabel("Import dataset JSON",{exact:true}).setInputFiles(datasetPath);await page.getByRole("status").filter({hasText:/Dataset imported/}).waitFor();
  await page.getByLabel("Select audio files",{exact:true}).setInputFiles(audioPath);await page.getByLabel("Evaluation recording",{exact:true}).waitFor();
  check("local playback: fingerprinted media decodes",await page.getByLabel("Evaluation recording",{exact:true}).evaluate(async el=>{if(el.readyState<1)await new Promise((resolve,reject)=>{el.onloadedmetadata=resolve;el.onerror=reject;});return Math.abs(el.duration-4)<.01;}));
  await page.getByLabel("Evaluate Whisper Base timestamped",{exact:true}).check();await page.getByLabel("Evaluate Hindi2Hinglish Swift",{exact:true}).check();await page.getByLabel("Allow evaluation model downloads",{exact:true}).check();
  async function run(){await page.getByRole("button",{name:"Run selected models",exact:true}).click();await page.getByRole("status").filter({hasText:/Benchmark finished/}).waitFor({timeout:120000});}
  async function download(label,name){const event=page.waitForEvent("download");await page.getByRole("link",{name:label,exact:true}).click();const path=join(OUT,name);await(await event).saveAs(path);return path;}
  await run();const reportPath=await download("Export JSON","controlled-fixture.json"),report=JSON.parse(readFileSync(reportPath,"utf8"));
  check("runner: all three adapters finish sequential controlled-fixture jobs",report.results.length===3&&report.results.every(r=>r.status==="completed"));
  check("actual JSON: known error counts, raw text and revisions survive",report.results.every(r=>r.normalized.overall.wer===.25&&r.normalized.languages.en.wer===.5&&r.model.revision.length===40&&r.prediction.rawText==="aaj React extra chalega."));
  check("metrics: unreviewed timing unavailable and synthetic gates cannot pass",report.results.every(r=>r.normalized.timing.coverage===null)&&await page.getByText("INSUFFICIENT DATA",{exact:true}).count()>=6);
  const csv=readFileSync(await download("Export CSV","controlled-fixture.csv"),"utf8");check("actual CSV: consistent headings and measured fixture scores",csv.includes('"reference_review"')&&csv.includes('"0.25"')&&csv.split("\r\n").length===4);
  await page.getByLabel("Sort comparison",{exact:true}).selectOption("english");await page.getByLabel("Inspect model",{exact:true}).selectOption("base");
  check("inspector: aligned substitutions and language labels are exposed",await page.locator('[data-error="substitution"][data-language="en"]').count()===1);
  const before=workerRequests;await run();const cached=JSON.parse(readFileSync(await download("Export JSON","cached-fixture.json"),"utf8"));check("cache: exact dataset/audio/model/config reuses results without inference",cached.results.every(r=>r.cached)&&workerRequests===before);
  await page.getByRole("button",{name:"Save report in this browser",exact:true}).click();await page.getByRole("status").filter({hasText:/saved in the isolated/}).waitFor();
  await page.reload();check("privacy: reload does not restore private references implicitly",await page.getByText("No dataset loaded.",{exact:false}).isVisible());await page.getByText("Import or restore reports",{exact:true}).click();await page.getByRole("button",{name:"Load saved reports",exact:true}).click();await page.getByRole("status").filter({hasText:/reports loaded/}).waitFor();await page.getByLabel("Dataset report",{exact:true}).selectOption(cached.id);
  check("persistence: explicit restore retains scores but not audio",await page.getByTestId("reference-transcript").textContent()===report.dataset.recordings[0].reference.text&&await page.getByLabel("Evaluation recording",{exact:true}).count()===0);
  const variant=structuredClone(report);variant.id="algorithm-fixture-v2";variant.evidence="algorithm-fixture";variant.dataset.version="2.0.0";variant.dataset.recordings[0].reference.review={status:"reviewed",reviewer:"synthetic-fixture",reviewedAt:"2026-11-17T00:00:00Z",timingReviewed:true};const variantPath=join(OUT,"variant.json");writeFileSync(variantPath,JSON.stringify(variant));
  await page.getByLabel("Import report JSON",{exact:true}).setInputFiles(variantPath);await page.getByRole("status").filter({hasText:/scores recomputed/}).waitFor();await page.getByLabel("Select audio files",{exact:true}).setInputFiles(audioPath);await page.getByLabel("Evaluation recording",{exact:true}).waitFor();
  await page.getByRole("button",{name:/react.*correct.*en/i}).first().click();check("inspection: clicking a reviewed reference word seeks audio",await page.getByLabel("Evaluation recording",{exact:true}).evaluate(el=>Math.abs(el.currentTime-1)<.05));
  await page.getByText("Compare report versions",{exact:true}).click();await page.getByLabel("Previous report",{exact:true}).selectOption(cached.id);check("version comparison: previous and current values are rendered",await page.getByRole("columnheader",{name:"Previous WER",exact:true}).isVisible());
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(OUT,"dashboard-scored.png"),fullPage:false});
  await page.getByLabel("Allow evaluation model downloads",{exact:true}).check();slow=true;await page.getByRole("button",{name:"Run selected models",exact:true}).click();await page.getByRole("status").filter({hasText:/Controlled fixture worker running/}).waitFor();await page.getByRole("button",{name:"Cancel benchmark",exact:true}).click();await page.getByRole("status").filter({hasText:/Benchmark cancelled/}).first().waitFor();const cancelled=JSON.parse(readFileSync(await download("Export JSON","cancelled-fixture.json"),"utf8"));check("cancel: active worker stops; later models are not started",cancelled.results.length===1&&cancelled.results[0].status==="cancelled");
  for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));if(width<1100){check(`responsive: ${width}px controls fold above data`,await page.getByText("Dataset and benchmark controls",{exact:true}).evaluate(el=>!el.parentElement.open));}
    await page.screenshot({path:join(OUT,`dashboard-${width}.png`),fullPage:false});check(`responsive: ${width}px has no document overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.getByLabel("Import dataset JSON",{exact:true}).setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from('{}')});await page.getByRole("alert").filter({hasText:/\S/}).waitFor();check("validation: malformed datasets produce an error",true);
  check("privacy: application HTTP requests are same-origin GET/HEAD only",requests.filter(r=>/^https?:/.test(r.url)).every(r=>r.url.startsWith(base)&&["GET","HEAD"].includes(r.method)));
  check("fixture isolation: no real model downloads were substituted for accuracy evidence",requests.every(r=>!r.url.includes("/local-models/")));
  await context.close();
}catch(error){const page=browser?.contexts()[0]?.pages()[0];await page?.screenshot({path:join(OUT,"failure.png"),fullPage:true}).catch(()=>{});throw error;}finally{if(browser)await browser.close();if(dev)stopServer(dev);stopServer(production);}
finish();

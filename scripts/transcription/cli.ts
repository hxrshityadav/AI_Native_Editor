import { readFileSync,writeFileSync,realpathSync,statSync,mkdirSync } from "node:fs";
import { resolve,dirname,join,sep } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { parseDataset } from "../../src/lib/transcription-evaluation/dataset";
import { parseReport,modelSummaries,reportCsv } from "../../src/lib/transcription-evaluation/report";
const args=process.argv.slice(2),command=args[0],arg=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];},out=resolve("output/transcription-evaluation");mkdirSync(out,{recursive:true});
let stage="initialization";
async function main(){
  if(command==="compare"){
    const input=args.slice(1).filter(a=>!a.startsWith("--"));if(!input.length)throw new Error("Provide report JSON paths");
    const reports=input.map(path=>parseReport(JSON.parse(readFileSync(path,"utf8"))));
    writeFileSync(join(out,"comparison.json"),JSON.stringify(reports.map(report=>({reportId:report.id,dataset:report.dataset.id,version:report.dataset.version,createdAt:report.createdAt,summaries:modelSummaries(report)})),null,2));
    writeFileSync(join(out,"comparison.csv"),reports.map((r,i)=>i?reportCsv(r).split("\r\n").slice(1).join("\r\n"):reportCsv(r)).join("\r\n"));
    console.log(`Compared ${reports.length} reports; private outputs are under output/transcription-evaluation. Different populations are descriptive, not controlled improvements.`);return;
  }
  const manifest=args[1];if(!manifest)throw new Error("Provide a dataset manifest");
  stage="dataset-validation";const dataset=parseDataset(JSON.parse(readFileSync(manifest,"utf8"))),root=realpathSync(dirname(resolve(manifest)));
  for(const r of dataset.recordings){const path=realpathSync(join(root,r.audio.path));if(!path.startsWith(root+sep)||statSync(path).size>128*1048576)throw new Error("Dataset audio path or file size is unsafe");if(createHash("sha256").update(readFileSync(path)).digest("hex")!==r.audio.sha256)throw new Error("Dataset audio fingerprint mismatch");}
  if(command==="validate"){console.log(`Validated ${dataset.recordings.length} recordings; ${dataset.recordings.filter(r=>r.reference.review.status==="reviewed").length} declared reviewed. Synthetic data is not accuracy evidence.`);return;}
  if(command!=="run")throw new Error("Use validate, run or compare");
  if(!args.includes("--consent-model-downloads"))throw new Error("Running requires --consent-model-downloads");
  const url=new URL(arg("--url")??"http://localhost:3000");if(!["localhost","127.0.0.1","[::1]"].includes(url.hostname)||!["http:","https:"].includes(url.protocol))throw new Error("Only a local development dashboard may receive dataset selection");
  const selected=(arg("--models")??"tiny,base,hinglish-swift").split(",");if(!selected.length||selected.some(id=>!["tiny","base","hinglish-swift"].includes(id)))throw new Error("Select existing tiny, base, hinglish-swift models");
  const browser=await chromium.launch({channel:"chrome"});
  try{
    stage="dashboard-loading";const page=await browser.newPage({acceptDownloads:true});page.setDefaultTimeout(60000);await page.goto(new URL("/dev/transcription-benchmark",url).href);await page.getByRole("heading",{name:"Transcription diagnostics",exact:true}).waitFor();await page.locator('[data-evaluation-ready="true"]').waitFor();
    stage="dataset-import";await page.getByLabel("Import dataset JSON",{exact:true}).setInputFiles(resolve(manifest));await page.getByRole("status").filter({hasText:/Dataset imported/}).waitFor();
    stage="audio-folder-selection";await page.getByLabel("Select dataset folder",{exact:true}).setInputFiles(root);
    stage="model-selection";for(const [id,name] of [["tiny","Whisper Tiny timestamped"],["base","Whisper Base timestamped"],["hinglish-swift","Hindi2Hinglish Swift"]])await page.getByLabel(`Evaluate ${name}`,{exact:true}).setChecked(selected.includes(id));
    stage="consent";await page.getByLabel("Allow evaluation model downloads",{exact:true}).check();stage="benchmark-start";await page.getByRole("button",{name:"Run selected models",exact:true}).click();
    let last=-1;const progress=setInterval(()=>{void page.getByRole("status").allTextContents().then(messages=>{const match=messages.join(" ").match(/(\d+) \/ (\d+) jobs completed/);if(match&&Number(match[1])!==last){last=Number(match[1]);console.log(`Completed ${match[1]}/${match[2]} evaluation jobs`);}}).catch(()=>{});},2000);
    try{const timeout=Math.max(900000,dataset.recordings.length*selected.length*660000);await Promise.race([page.getByRole("status").filter({hasText:/Benchmark finished|Benchmark cancelled/}).waitFor({timeout}),page.getByRole("alert").filter({hasText:/\S/}).first().waitFor({timeout}).then(async()=>{const text=await page.getByRole("alert").filter({hasText:/\S/}).first().innerText();await page.getByRole("alert").filter({hasText:/\S/}).first().screenshot({path:join(out,"cli-diagnostic-alert.png")}).catch(()=>{});const code=/could not be decoded/.test(text)?"AUDIO_PREVIEW_DECODE":/SHA-256|fingerprint/.test(text)?"AUDIO_FINGERPRINT":/Build the local/.test(text)?"WORKER_ASSET":/Select at least/.test(text)?"EMPTY_SELECTION":/download/.test(text)?"DOWNLOAD_OR_CONSENT":/JSON|reference|dataset/i.test(text)?"DATASET_VALIDATION":"RUNTIME_OTHER";console.error(`Dashboard issue code: ${code}`);throw new Error("Dashboard reported a recoverable error. Inspect it locally; no transcript is logged");})]);}finally{clearInterval(progress);}
    stage="report-download";const pending=page.waitForEvent("download");await page.getByRole("link",{name:"Export JSON",exact:true}).click();const download=await pending,path=join(out,`run-${new Date().toISOString().replaceAll(":","-")}.json`);await download.saveAs(path);
    stage="report-validation";const report=parseReport(JSON.parse(readFileSync(path,"utf8")));writeFileSync(path,JSON.stringify(report,null,2));writeFileSync(path.replace(/\.json$/,".csv"),reportCsv(report));
    console.log(`Evaluated ${report.results.length} model/recording jobs. Private JSON/CSV saved under output/transcription-evaluation. No audio was uploaded.`);
    if(report.results.some(r=>r.status!=="completed"))process.exitCode=1;
  }finally{await browser.close();}
}
try{await main();}catch(error){const message=error instanceof Error?error.message:"";console.error(/requires --consent|Only a local|Select existing|Use validate|Provide a|fingerprint mismatch|file size is unsafe/.test(message)?message:`Evaluation failed during ${stage} (${error instanceof Error?error.name:"unknown"}). Check the local dashboard and retry; no audio/transcript is logged.`);process.exitCode=1;}

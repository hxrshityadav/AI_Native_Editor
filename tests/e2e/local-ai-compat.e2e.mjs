import { firefox } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, ff, probe, streams, decodeErrors, startServer, stopServer, createChecks } from "./helpers.mjs";

const OUT=join(ROOT,"output/local-ai-firefox"),PORT=3172,BASE=`http://localhost:${PORT}`;
mkdirSync(OUT,{recursive:true});const {check,finish}=createChecks();
const input=join(OUT,"noise.wav");ff("-f","lavfi","-i","anoisesrc=amplitude=0.05:sample_rate=48000:duration=3:seed=31",input);
const server=await startServer(PORT,{env:{REEL_ENABLE_CLOUD:""}});
const browser=await firefox.launch({executablePath:join(ROOT,"output/firefox-test/firefox/firefox.exe")});
try{
  const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),requests=[];
  context.on("request",r=>requests.push({url:r.url(),method:r.method()}));
  async function download(name,file){await page.getByRole("link",{name,exact:true}).waitFor({timeout:900000});const pending=page.waitForEvent("download");await page.getByRole("link",{name,exact:true}).click();const result=await pending,path=join(OUT,file);await result.saveAs(path);return path;}
  await page.goto(`${BASE}/tools/text-to-speech`);await page.getByLabel("Text to read",{exact:true}).fill("Hello from Reel Finisher.");
  check("Firefox: model generation requires consent",await page.getByRole("button",{name:"Generate speech",exact:true}).isDisabled());
  await page.getByLabel("Allow speech model download").check();const started=Date.now();await page.getByRole("button",{name:"Generate speech",exact:true}).click();
  const speech=await download("Download WAV","speech.wav");check("Firefox: real SpeechT5 generates downloadable PCM audio",streams(probe(speech),"audio")[0].codec_name==="pcm_s16le"&&Number(probe(speech).format.duration)>0&&!decodeErrors(speech),`${Date.now()-started} ms including model loading`);
  await page.goto(`${BASE}/tools/noise-remover`);await page.getByLabel("Choose recording",{exact:true}).setInputFiles(input);await page.getByLabel("Noise reduction mode").selectOption("neural");await page.getByLabel("Allow noise model download").check();await page.getByRole("button",{name:"Reduce noise",exact:true}).click();
  const cleaned=await download("Download audio","cleaned.wav");check("Firefox: real RNNoise retains 48 kHz mono duration",streams(probe(cleaned),"audio")[0].sample_rate==="48000"&&Math.abs(Number(probe(cleaned).format.duration)-3)<.001&&!decodeErrors(cleaned));
  check("Firefox: inference requests contain no uploaded media or transcript",requests.every(r=>["GET","HEAD"].includes(r.method)&&(r.url.startsWith(BASE)||/^(blob:|data:)/.test(r.url))));
}finally{await browser.close();await stopServer(server);}finish();

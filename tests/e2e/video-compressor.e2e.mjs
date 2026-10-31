import { chromium, firefox, devices } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startServer, stopServer, ff, probe, streams, decodeErrors, createChecks } from "./helpers.mjs";

const PORT = Number(process.env.VIDEO_TEST_PORT || 3153), BASE = `http://localhost:${PORT}`, OUT = join(ROOT, process.env.VIDEO_TEST_DIR || "output/launch-video");
mkdirSync(OUT, { recursive: true });
const { check, finish } = createChecks();
const source = join(OUT, "source.mp4"), silent = join(OUT,"silent.webm"), rotated = join(OUT,"rotated.mp4"), vfr = join(OUT,"vfr.mp4"), long = join(OUT,"too-long.mp4"), mov = join(OUT,"source.mov");
ff("-f","lavfi","-i","testsrc2=s=960x540:r=30:d=4", "-f","lavfi","-i","sine=frequency=880:sample_rate=48000:duration=4", "-vf","drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='between(t,1,1.1)+between(t,3,3.1)'", "-af","volume='if(between(t,1,1.1)+between(t,3,3.1),1,0)':eval=frame", "-c:v","libx264","-preset","fast","-crf","15","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k",source);
ff("-i",source,"-an","-c:v","libvpx-vp9","-b:v","800k",silent);
ff("-i",source,"-c","copy",mov);
ff("-display_rotation","90","-i",source,"-c","copy",rotated);
ff("-f","lavfi","-i","testsrc2=s=320x180:r=30:d=4","-vf","select='if(lt(t,2),not(mod(n,3)),1)'","-fps_mode","vfr","-c:v","libx264","-pix_fmt","yuv420p",vfr);
ff("-f","lavfi","-i","color=c=blue:s=16x16:r=1:d=601","-c:v","libx264","-pix_fmt","yuv420p",long);
writeFileSync(join(OUT,"corrupt.mp4"),Buffer.from("not a video"));
const server = await startServer(PORT, { env: { REEL_ENABLE_CLOUD: "" } });
const isFirefox = process.env.VIDEO_BROWSER === "firefox";
const browser = isFirefox ? await firefox.launch({ executablePath: join(ROOT,"output/firefox-test/firefox/firefox.exe") }) : await chromium.launch({ channel: process.env.VIDEO_CHANNEL || "chrome" });
console.log("BROWSER", browser.version());
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
const requests = []; context.on("request", req => { if (!/^(?:edge|chrome):\/\//.test(req.url())) requests.push({ url:req.url(), method:req.method() }); });
await context.addInitScript(() => {
  const create = URL.createObjectURL.bind(URL), revoke=URL.revokeObjectURL.bind(URL); window.videoUrls=new Set();
  URL.createObjectURL=blob=>{ const url=create(blob); window.videoUrls.add(url); return url; }; URL.revokeObjectURL=url=>{ window.videoUrls.delete(url); revoke(url); };
});
const page = await context.newPage(); let workerUrl;
page.on("worker", worker => { workerUrl=worker.url(); });
async function open() { await page.goto(BASE+"/tools/video-compressor"); await page.getByRole("heading",{name:"Video Compressor",exact:true}).waitFor(); }
async function upload(path) { await page.getByLabel("Choose video",{exact:true}).setInputFiles(path); await page.getByLabel("Original video details",{exact:true}).waitFor({timeout:30000}); }
async function compress(name) {
  const button = page.getByRole("button",{name:"Compress video",exact:true}); await button.waitFor();
  await page.waitForFunction(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent==="Compress video"); return b && !b.disabled;},{},{timeout:30000});
  await button.click();
  await page.waitForFunction(()=>{ const errors=[...document.querySelectorAll('[role="alert"]')]; if(errors.length) throw new Error(errors.map(e=>e.textContent).join(" ")); return !!document.querySelector('a[download]'); },undefined,{timeout:120000});
  const event=page.waitForEvent("download"); await page.getByRole("link",{name:"Download compressed video",exact:true}).click(); const downloaded=await event, path=join(OUT,name); await downloaded.saveAs(path); return {path, name:downloaded.suggestedFilename()};
}
async function encoderPatch(script) {
  await page.route(workerUrl, async route=>{ const response=await route.fetch(); const headers={...response.headers(),"cache-control":"no-store"}; delete headers["content-encoding"]; delete headers["content-length"]; await route.fulfill({ status:response.status(), headers, body:script+"\n"+await response.text() }); });
}
const videoInfo=path=>streams(probe(path),"video")[0];
const pcm=path=>{ const bytes=execFileSync("ffmpeg",["-v","error","-i",path,"-vn","-ac","1","-ar","16000","-f","f32le","-"],{maxBuffer:2000000}); return new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)); };
function firstSound(samples, start=0) { for(let i=Math.floor(start*16000);i<samples.length-160;i+=160){let sum=0;for(let j=0;j<160;j++)sum+=samples[i+j]**2;if(Math.sqrt(sum/160)>.03)return i/16000;}return Infinity; }
try {
  await open();
  const transfer=await page.evaluateHandle(encoded=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],"source.mp4",{type:"video/mp4"}));return dt;},readFileSync(source).toString("base64"));
  await page.getByRole("region",{name:"Video Compressor workspace",exact:true}).locator("div").first().dispatchEvent("drop",{dataTransfer:transfer});await transfer.dispose();
  await page.getByLabel("Original video details").waitFor();
  check("import: drop probes actual dimensions, duration, codecs and size", /960 × 540/.test(await page.getByLabel("Original video details").innerText()) && /AVC/.test(await page.getByLabel("Original video details").innerText()));
  const preview=page.getByLabel("Original video preview",{exact:true}); await preview.evaluate(async video=>{video.muted=true;await video.play();}); await page.waitForFunction(()=>document.querySelector('video[aria-label="Original video preview"]').currentTime>.1);await preview.evaluate(v=>v.pause());check("preview: actual input plays and pauses",true);
  await page.getByLabel("Output resolution").selectOption("480"); await page.getByLabel("Quality preset").selectOption("small"); await page.getByLabel("Video output format").selectOption("mp4");
  check("estimate: before processing it is explicitly not measured", (await page.getByLabel("Estimated output size").innerText()).includes("Actual output may differ"));
  if (isFirefox) {
    await page.waitForFunction(()=>!document.body.textContent.includes("Checking available output encoders") && (!([...document.querySelectorAll("button")].find(b=>b.textContent==="Compress video")?.disabled)||!!document.querySelector('[role="alert"]')));
    const mp4Blocked=await page.getByRole("button",{name:"Compress video",exact:true}).isDisabled();
    if(mp4Blocked){check("Firefox: unsupported AAC blocks MP4 instead of silently muting",(await page.getByRole("alert").allTextContents()).some(text=>text.includes("Audio cannot be preserved")));await page.getByLabel("Video output format").selectOption("webm");}
    const extension=mp4Blocked?"webm":"mp4", kept=await compress(`firefox-audio.${extension}`), actual=probe(kept.path);
    check("Firefox: supported output retains real audio and matching codecs",streams(actual,"video")[0].codec_name===(mp4Blocked?"vp9":"h264")&&streams(actual,"audio")[0]?.codec_name===(mp4Blocked?"opus":"aac")&&kept.name.endsWith(`.${extension}`));
    check("Firefox: downloaded picture/audio decode with duration preserved",decodeErrors(kept.path)===""&&Math.abs(Number(actual.format.duration)-4)<.15);
    check("Firefox: decoded audio onset remains aligned with source",Math.abs(firstSound(pcm(kept.path))-firstSound(pcm(source)))<.05);
    await page.screenshot({path:join(OUT,"desktop-result.png"),fullPage:true});
    const independent=await context.newPage();await independent.goto(BASE);await independent.evaluate(async({encoded,type})=>{const video=document.createElement("video");video.src=URL.createObjectURL(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type}));video.muted=true;document.body.replaceChildren(video);await video.play();await new Promise((resolve,reject)=>{video.onended=resolve;video.onerror=()=>reject(new Error("Output playback failed"));});URL.revokeObjectURL(video.src);},{encoded:readFileSync(kept.path).toString("base64"),type:`video/${extension}`});await independent.close();check("Firefox: downloaded output plays independently to its end",true);
    await page.getByLabel("Mute audio",{exact:true}).check();await page.getByLabel("Video output format").selectOption("mp4");const muted=await compress("firefox-muted.mp4");check("Firefox: explicit mute enables real H.264 MP4 without an audio track",videoInfo(muted.path).codec_name==="h264"&&streams(probe(muted.path),"audio").length===0&&decodeErrors(muted.path)==="");
    await upload(rotated);await page.getByLabel("Mute audio",{exact:true}).check();await page.getByLabel("Video output format").selectOption("mp4");await page.getByLabel("Output resolution").selectOption("360");const upright=await compress("firefox-upright.mp4");check("Firefox: rotation is baked into portrait output",videoInfo(upright.path).width===360&&videoInfo(upright.path).height===640&&decodeErrors(upright.path)==="");
    await upload(vfr);const normalized=await compress("firefox-vfr.mp4");check("Firefox: VFR source retains duration without upscaling",videoInfo(normalized.path).width===320&&Math.abs(Number(probe(normalized.path).format.duration)-4)<.15&&decodeErrors(normalized.path)==="");
  } else {
  const output=await compress("compressed.mp4"), details=probe(output.path), video=streams(details,"video")[0],audio=streams(details,"audio")[0];
  check("export: actual MP4/H.264/AAC container, MIME and extension agree",video.codec_name==="h264"&&audio?.codec_name==="aac"&&output.name.endsWith(".mp4")&&(await page.getByLabel("Measured video output").innerText()).includes("video/mp4")&&readFileSync(output.path).subarray(4,8).toString()==="ftyp");
  check("resolution: 480p fits within even pixel bounds and preserves picture aspect",video.width===852&&video.height===480&&Math.abs(video.width/video.height-16/9)<.003);
  check("export: every encoded frame and audio sample decodes",decodeErrors(output.path)==="");
  check("size: reduction and measured bytes correspond to the actual file",readFileSync(output.path).length<readFileSync(source).length&&Number((await page.getByLabel("Measured video output").innerText()).match(/([\d,\s]+) bytes/)?.[1].replace(/\D/g,""))===readFileSync(output.path).length);
  await page.screenshot({path:join(OUT,"desktop-result.png"),fullPage:true});
  check("sync: decoded A/V end times remain aligned",Math.abs(Number(video.duration)-Number(audio.duration))<.06&&Math.abs(Number(video.duration)-4)<.08);
  const sourceSound=firstSound(pcm(source)), resultSound=firstSound(pcm(output.path));
  const frames=execFileSync("ffmpeg",["-v","error","-i",output.path,"-vf","crop=32:32:0:0","-f","rawvideo","-pix_fmt","rgb24","-"],{maxBuffer:2000000});let white=Infinity;for(let f=0;f<frames.length/3072;f++){let sum=0;for(let i=f*3072;i<(f+1)*3072;i++)sum+=frames[i];if(sum/3072>240){white=f/Number(video.avg_frame_rate.split('/')[0])*Number(video.avg_frame_rate.split('/')[1]);break;}}
  check("sync: actual flash/beep content stays synchronized",Math.abs(resultSound-sourceSound)<.05&&Math.abs(resultSound-white)<.06,`audio ${resultSound.toFixed(3)}s / picture ${white.toFixed(3)}s`);
  const independent=await context.newPage();await independent.goto(BASE);await independent.evaluate(async encoded=>{const video=document.createElement("video");video.src=URL.createObjectURL(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:"video/mp4"}));video.muted=true;document.body.replaceChildren(video);await video.play();await new Promise((resolve,reject)=>{video.onended=resolve;video.onerror=()=>reject(new Error("Output playback failed"));});if(Math.abs(video.currentTime-4)>.1)throw new Error("Wrong playback duration");URL.revokeObjectURL(video.src);},readFileSync(output.path).toString("base64"));await independent.close();check("playback: independently downloaded output plays to its end",true);
  await page.getByLabel("Mute audio",{exact:true}).check();check("settings: mute invalidates the old download",await page.getByRole("link",{name:"Download compressed video"}).count()===0);
  const muted=await compress("muted.mp4");check("mute: explicit mute really removes the audio track",streams(probe(muted.path),"audio").length===0&&decodeErrors(muted.path)==="");
  await page.getByLabel("Target size",{exact:true}).fill("0.001");const unmet=await compress("unmet.mp4");check("target: impossible size is reported using measured output",readFileSync(unmet.path).length>1000&&await page.getByText(/requested target was not achieved/).isVisible());
  await page.getByLabel("Target size",{exact:true}).fill("");await page.getByLabel("Mute audio",{exact:true}).uncheck();await page.getByLabel("Video output format").selectOption("webm");const webm=await compress("compressed.webm");check("fallback: actual WebM/VP9/Opus export preserves audio and decodes",videoInfo(webm.path).codec_name==="vp9"&&streams(probe(webm.path),"audio")[0]?.codec_name==="opus"&&webm.name.endsWith(".webm")&&decodeErrors(webm.path)==="");
  await upload(rotated);await page.getByLabel("Video output format").selectOption("mp4");await page.getByLabel("Output resolution").selectOption("360");const portrait=await compress("upright.mp4");const portraitInfo=videoInfo(portrait.path);check("orientation: rotated source is baked upright with portrait aspect",portraitInfo.width===360&&portraitInfo.height===640&&!(portraitInfo.tags?.rotate)&&!(portraitInfo.side_data_list?.some(side=>side.rotation)));
  await upload(vfr);await page.getByLabel("Output resolution").selectOption("1080");const normalized=await compress("vfr-normalized.mp4");const normalizedInfo=videoInfo(normalized.path);check("VFR: output retains duration, avoids upscaling and normalizes frame cadence",normalizedInfo.width===320&&normalizedInfo.height===180&&Math.abs(Number(normalizedInfo.duration)-4)<.15&&decodeErrors(normalized.path)==="");
  await upload(silent);check("import: silent WebM is accepted without fabricated audio",(await page.getByLabel("Original video details").innerText()).includes("no audio"));
  await upload(mov);check("import: actual MOV container is recognized",(await page.getByLabel("Original video details").innerText()).includes("video/quicktime"));
  await page.getByRole("button",{name:"Process another file",exact:true}).click();await page.waitForFunction(()=>window.videoUrls.size===0);check("resources: process-another clears media URLs and downloads",await page.getByRole("link",{name:"Download compressed video"}).count()===0);
  for(const [name,mimeType,buffer,message]of[
    ["empty.mp4","video/mp4",Buffer.alloc(0),/non-empty/],
    ["corrupt.mp4","video/mp4",readFileSync(join(OUT,"corrupt.mp4")),/contents|could not be read/],
    ["mislabeled.webm","video/webm",readFileSync(source),/does not match/],
    ["audio.mp4","video/mp4",execFileSync("ffmpeg",["-v","error","-i",source,"-vn","-c:a","copy","-f","mp4","-movflags","frag_keyframe+empty_moov","pipe:1"]),/no video track/],
  ]){await page.getByLabel("Choose video").setInputFiles({name,mimeType,buffer});await page.getByRole("alert").filter({hasText:message}).waitFor();check(`validation: ${name} rejected with recovery`,await page.getByRole("link",{name:"Download compressed video"}).count()===0);}
  await page.getByLabel("Choose video").setInputFiles(long);await page.getByRole("alert").filter({hasText:/10 minutes/}).waitFor();check("duration: actual 601-second file is rejected",true);
  // Declared unsupported codec: the source remains valid MP4 but its avc1 sample entry is unknown.
  const unsupported=Buffer.from(readFileSync(source));const avc=unsupported.indexOf("avc1",64);if(avc<0)throw new Error("No codec sample entry fixture");unsupported.write("zzzz",avc,"ascii");await page.getByLabel("Choose video").setInputFiles({name:"unsupported.mp4",mimeType:"video/mp4",buffer:unsupported});await page.getByRole("alert").waitFor();check("codec: unsupported encoded picture is not accepted from extension alone",true);
  await upload(source);
  let release,entered;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  await page.waitForFunction(()=>!([...document.querySelectorAll("button")].find(b=>b.textContent==="Compress video")?.disabled));
  await page.route(workerUrl,async route=>{entered();await gate;await route.continue().catch(()=>{});});await page.getByRole("button",{name:"Compress video",exact:true}).click();let timer;try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Cancellation fixture did not start")),15000);})]);}finally{clearTimeout(timer);}await page.getByRole("button",{name:"Cancel operation",exact:true}).click();release();await page.unroute(workerUrl);await page.getByText(/Operation cancelled/).waitFor();check("cancellation: worker stops without a stale download",await page.getByRole("link",{name:"Download compressed video"}).count()===0);await compress("retry.mp4");check("retry: compression succeeds after cancellation",true);
  await page.getByLabel("Choose video").setInputFiles(source);await page.getByLabel("Choose video").setInputFiles(silent);await page.getByLabel("Original video details").getByText("video/webm",{exact:true}).waitFor();check("replacement: latest input wins without stale output",await page.getByRole("link",{name:"Download compressed video"}).count()===0);
  await encoderPatch("self.VideoEncoder=undefined;self.AudioEncoder=undefined;");await open();await upload(source);await page.getByRole("alert").filter({hasText:/encoder/}).waitFor();check("capability: absent encoders block export with a reason",await page.getByRole("button",{name:"Compress video",exact:true}).isDisabled());await page.unroute(workerUrl);
  await encoderPatch("self.AudioEncoder=undefined;");await open();await upload(source);await page.getByRole("alert").filter({hasText:/Audio cannot be preserved/}).waitFor();check("audio: unavailable encoder never silently mutes",await page.getByRole("button",{name:"Compress video",exact:true}).isDisabled());await page.getByLabel("Mute audio").check();await compress("explicit-mute.mp4");check("audio: explicit mute is a working recovery",true);await page.unroute(workerUrl);
  await encoderPatch("const NativeEncoder=self.VideoEncoder;self.VideoEncoder=class extends NativeEncoder{ count=0;encode(frame,options){if(++this.count>10)throw new DOMException('Encoder stopped','EncodingError');return super.encode(frame,options);}};");
  await open();await upload(source);await page.waitForFunction(()=>!([...document.querySelectorAll("button")].find(b=>b.textContent==="Compress video")?.disabled));await page.getByRole("button",{name:"Compress video",exact:true}).click();await page.getByRole("alert").filter({hasText:/lower resolution\/bitrate|worker failed/}).waitFor({timeout:120000});check("failure: encoder errors release the job without a false successful download",await page.getByRole("link",{name:"Download compressed video"}).count()===0);await page.unroute(workerUrl);
  }
  await page.screenshot({path:join(OUT,"desktop.png"),fullPage:true});
  const phoneOptions={...devices["Pixel 7"]};if(isFirefox)delete phoneOptions.isMobile;const phone=await browser.newPage(phoneOptions);await phone.goto(BASE+"/tools/video-compressor");await phone.getByLabel("Choose video").setInputFiles(source);await phone.getByLabel("Original video details").waitFor();check("mobile: controls fit the viewport",await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await phone.screenshot({path:join(OUT,"phone.png"),fullPage:true});await phone.close();
  await page.getByRole("link",{name:"All tools",exact:true}).first().click();await page.waitForFunction(()=>window.videoUrls.size===0);check("unmount: all media object URLs are released",true);
  const html=await(await fetch(BASE+"/tools/video-compressor")).text();check("SEO: title, instructions and FAQ are rendered server-side",html.includes("<title>Video Compressor · Reel Finisher</title>")&&html.includes("Frequently asked questions")&&html.includes("How to compress a video"));
  check("privacy: all processing requests are local GET/HEAD",requests.every(req=>["GET","HEAD"].includes(req.method)&&(req.url.startsWith(BASE)||/^(blob:|data:)/.test(req.url))));
  check("isolation: standalone tool never loads editor or model assets",requests.every(req=>!req.url.includes("/editor/")&&!req.url.includes("/editor-models/")));
}catch(error){await page.screenshot({path:join(OUT,"failure.png"),fullPage:true}).catch(()=>{});console.log("VISIBLE_ERRORS",await page.getByRole("alert").allTextContents().catch(()=>[]));throw error;}finally{await browser.close();await stopServer(server);}
finish();

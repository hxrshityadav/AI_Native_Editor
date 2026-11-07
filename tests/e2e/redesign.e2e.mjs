import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, startServer, stopServer, createChecks, probe } from './helpers.mjs';
const OUT=join(ROOT,'output/redesign'), PORT=3192, BASE=`http://localhost:${PORT}`;
mkdirSync(OUT,{recursive:true});
const {check,finish}=createChecks();
const server=await startServer(PORT,{env:{REEL_ENABLE_CLOUD:''}});
const browser=await chromium.launch({channel:'chrome'});
const widths=[1440,1280,1024,768,390,360];
const routes=['/','/tools','/privacy','/supported-formats',...readdirSync(join(ROOT,'src/app/tools'),{withFileTypes:true}).filter(e=>e.isDirectory()&&existsSync(join(ROOT,'src/app/tools',e.name,'page.tsx'))).map(e=>`/tools/${e.name}`)];
const evidence=[];
try {
 const page=await browser.newPage(); const requests=[],errors=[];
 page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 page.on('pageerror',e=>errors.push(e.message));
 for(const route of routes){
  await page.setViewportSize({width:1440,height:900});
  const response=await page.goto(BASE+route,{waitUntil:'networkidle'});
  check(`${route}: renders`,response.status()===200);
  const measurements=[];
  for(const width of widths){
   await page.setViewportSize({width,height:width<768?844:900});
   const m=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,h1:document.querySelectorAll('h1').length}));
   measurements.push(m);
   if(width===1440||width===390) await page.screenshot({path:join(OUT,`${route.replaceAll('/','-')||'home'}-${width}.png`),fullPage:true});
  }
  evidence.push({route,measurements});
  check(`${route}: one heading and no overflow at all six widths`,measurements.every(m=>m.h1===1&&m.overflow===0),JSON.stringify(measurements.filter(m=>m.overflow||m.h1!==1)));
 }
 check('all public routes: no browser exceptions',errors.length===0,errors.join(' | '));
 check('all public routes: no automatic model/editor downloads',requests.every(r=>!/(?:local-models|editor-models|local-ai|pdfjs|\/editor\/)/.test(r.url)));
 check('all public routes: same-origin GET/HEAD only',requests.every(r=>/^(blob:|data:)/.test(r.url)||(r.url.startsWith(BASE)&&['GET','HEAD'].includes(r.method))));
 await page.goto(BASE+'/tools/text-to-speech',{waitUntil:'networkidle'});
 for(const width of [390,768,1024]){
  await page.setViewportSize({width,height:844});const voice=page.getByLabel('Local speech voice');await voice.scrollIntoViewIfNeeded();
  const exposed=await voice.evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el===hit||el.contains(hit);});
  const consent=await page.getByLabel('Allow speech model download').boundingBox(),action=await page.getByRole('button',{name:'Generate speech',exact:true}).boundingBox();
  check(`speech @${width}: voice is not covered and consent precedes action`,exposed&&consent.y+consent.height<=action.y);
  await page.screenshot({path:join(OUT,`speech-stacked-${width}.png`),fullPage:true});
 }
 await page.setViewportSize({width:1440,height:900}); await page.goto(BASE,{waitUntil:'networkidle'});
 const speculative=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/\/(?:tools|studio)(?:\/|\?)/.test(r.name)&&r.name.includes('_rsc=')).map(r=>r.name));
 check('home: unvisited tool and Studio routes are not speculatively fetched',speculative.length===0,JSON.stringify(speculative));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  const artwork=page.locator('.workflow-grid img');
  for(const image of await artwork.all()){
   await image.scrollIntoViewIfNeeded();
   await image.evaluate(el=>el.decode());
  }
  const images=await artwork.evaluateAll(els=>els.map(el=>({loaded:el.complete&&el.naturalWidth>0,source:el.currentSrc})));
  check(`workflow artwork @${width}: all four illustrations decode with the correct composition`,images.length===4&&images.every(i=>i.loaded&&(width<768?i.source.includes('-compact.webp'):!i.source.includes('-compact.webp'))));
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:join(OUT,`stageshow-home-${width}.png`),fullPage:true});
 }
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  await page.goto(BASE+'/tools/image-compressor',{waitUntil:'networkidle'});
  const guide=page.getByRole('navigation',{name:'On this tool page'});
  await guide.getByRole('link',{name:'How to use',exact:true}).click();
  check(`workspace navigation @${width}: instructions clear the header`,await page.locator('#how-to').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=64&&r.top<innerHeight;}));
  await guide.getByRole('link',{name:'Workspace',exact:true}).click();
  check(`workspace navigation @${width}: returns to the real upload surface`,await page.locator('#workspace').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=64&&r.top<innerHeight;}));
 }
 await page.setViewportSize({width:1440,height:900});
 await page.goto(BASE,{waitUntil:'networkidle'});
 check('home: no invented output before processing',await page.getByLabel('Measured sample sizes').getByText('Run to measure').isVisible());
 for(const [format,ext,mime] of [['WebP','webp','image/webp'],['JPEG','jpg','image/jpeg'],['PNG (lossless)','png','image/png']]){
  await page.getByLabel('Sample output format',{exact:true}).selectOption({label:format});
  await page.getByRole('button',{name:'Compress sample',exact:true}).click();
  const downloadLink=page.getByRole('link',{name:'Download sample result'}); await downloadLink.waitFor({timeout:30000});
  const meta=await downloadLink.evaluate(async el=>{const b=await(await fetch(el.href)).blob();return {bytes:b.size,type:b.type};});
  const downloadPromise=page.waitForEvent('download'); await downloadLink.click(); const download=await downloadPromise;const path=join(OUT,`sample.${ext}`);await download.saveAs(path);
  const decoded=probe(path);const image=decoded.streams.find(s=>s.width);
  check(`sample ${format}: actual valid downloadable output`,meta.type===mime&&meta.bytes===readFileSync(path).length&&image.width===1536&&image.height===1024,JSON.stringify(meta));
  check(`sample ${format}: measured result and comparison`,await page.getByText(/% (smaller|larger)/).isVisible()&&await page.getByLabel(/Comparison position/).isVisible());
  await page.screenshot({path:join(OUT,`home-result-${ext}.png`),fullPage:true});
 }
 check('sample PNG: quality is disabled for lossless encoding',await page.getByLabel('Sample compression quality').isDisabled());
 await page.getByLabel('Sample output format',{exact:true}).selectOption({label:'WebP'});
 check('sample: changing format invalidates old download',await page.getByRole('link',{name:'Download sample result'}).count()===0);
 const failure=await browser.newPage();await failure.goto(BASE,{waitUntil:'networkidle'});
 await failure.route('**/samples/finishing-landscape.jpg',r=>r.fulfill({status:503,body:'unavailable'}));
 await failure.getByRole('button',{name:'Compress sample',exact:true}).click();await failure.locator('main').getByRole('alert').waitFor();
 check('sample: load failure explains recovery',/Try again/.test(await failure.locator('main').getByRole('alert').innerText()));
 await failure.unroute('**/samples/finishing-landscape.jpg'); await failure.getByRole('button',{name:'Compress sample',exact:true}).click();await failure.getByRole('link',{name:'Download sample result'}).waitFor();
 check('sample: retry recovers',true);await failure.close();
 const cancel=await browser.newPage();await cancel.goto(BASE,{waitUntil:'networkidle'});
 await cancel.route('**/samples/finishing-landscape.jpg',async r=>{await new Promise(resolve=>setTimeout(resolve,1500));await r.continue().catch(()=>{});});
 await cancel.getByRole('button',{name:'Compress sample',exact:true}).click();await cancel.getByRole('button',{name:'Cancel conversion'}).click();
 check('sample: cancellation restores action without a download',await cancel.getByRole('button',{name:'Compress sample',exact:true}).isVisible()&&await cancel.getByRole('link',{name:'Download sample result'}).count()===0);
 await cancel.close();
 writeFileSync(join(OUT,'evidence.json'),JSON.stringify({routes:evidence,requests,errors},null,2));
 await page.close();
} finally {await browser.close();await stopServer(server);}
finish();



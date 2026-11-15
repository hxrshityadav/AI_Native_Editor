import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, startServer, stopServer, createChecks } from './helpers.mjs';
const OUT=join(ROOT,process.env.DYNAMIC_TEST_OUT || 'output/dynamic-sidebar'), PORT=3205, base=`http://localhost:${PORT}`;
mkdirSync(OUT,{recursive:true});
const {check,finish}=createChecks(), evidence=[];
const server=await startServer(PORT),browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage();
 async function measure(){return page.evaluate(()=>{
  const rect=selector=>{const e=document.querySelector(selector);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,width:r.width,right:r.right};};
  return {column:rect('.rail-column'),nav:rect('#desktop-navigation'),main:rect('main'),header:rect('.top-bar'),footer:rect('footer'),home:rect('.home-columns'),search:rect('.search-pill'),overflow:document.documentElement.scrollWidth>innerWidth};
 });}
 for(const width of [1600,1440,1280,1024,768,430,390,360]){
  await page.setViewportSize({width,height:1000});
  for(const route of ['/','/tools/image-compressor','/command-center']){
   await page.goto(base+route,{waitUntil:'networkidle'});
   await page.locator('img').evaluateAll(images=>Promise.all(images.map(async image=>{image.loading='eager';await image.decode();})));
   if(width>=1024){
    await page.locator('main h1').click();await page.mouse.move(width-40,900);await page.waitForTimeout(600);
    const closed=await measure();
    await page.screenshot({path:join(OUT,`${width}-${route.replaceAll('/','_')}-collapsed.png`),fullPage:true});
    await page.locator('#desktop-navigation').getByRole('link',{name:'Home',exact:true}).hover();await page.waitForTimeout(400);
    const open=await measure();
    check(`${width} ${route}: column actually grows 72 to 224`,Math.abs(closed.column.width-72)<.1&&Math.abs(open.column.width-224)<.1);
    for(const item of ['main','header','footer'])check(`${width} ${route}: ${item} gains/loses 152px`,Math.abs(closed[item].width-open[item].width-152)<.1&&Math.abs(open[item].x-closed[item].x-152)<.1);
    check(`${width} ${route}: capsule tracks its column`,closed.nav.width===56&&open.nav.width===208&&open.nav.right<=open.main.x);
    check(`${width} ${route}: no horizontal overflow in either state`,!closed.overflow&&!open.overflow);
    if(open.home)check(`${width}: homepage grid uses recovered width`,Math.abs(closed.home.width-open.home.width-152)<.1);
    await page.screenshot({path:join(OUT,`${width}-${route.replaceAll('/','_')}-expanded.png`),fullPage:true});
    await page.mouse.move(width-40,900);await page.waitForTimeout(600);
    const restored=await measure();check(`${width} ${route}: leave restores content width`,Math.abs(restored.main.width-closed.main.width)<.1);
    evidence.push({width,route,closed,open,restored});
   }else{
    const m=await measure();check(`${width} ${route}: no desktop column consumes space`,m.column.width===0&&!m.overflow&&Math.abs(m.main.width-width)<1);
    await page.getByRole('button',{name:'Menu',exact:true}).click();await page.waitForTimeout(260);
    check(`${width} ${route}: drawer opens`,await page.getByRole('dialog',{name:'Site navigation'}).isVisible());
    await page.keyboard.press('Escape');
    check(`${width} ${route}: drawer returns focus`,await page.getByRole('button',{name:'Menu',exact:true}).evaluate(el=>el===document.activeElement));
   }
  }
 }
 writeFileSync(join(OUT,'measurements.json'),JSON.stringify(evidence,null,2));
}finally{await browser.close();await stopServer(server);}
finish();

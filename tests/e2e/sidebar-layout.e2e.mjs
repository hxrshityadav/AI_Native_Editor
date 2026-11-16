import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startServer, stopServer } from './helpers.mjs';
const PORT=Number(process.env.REEL_E2E_PORT || 3215);
const base=process.env.SIDEBAR_TEST_URL || `http://localhost:${PORT}`;
const server=process.env.SIDEBAR_TEST_URL ? undefined : await startServer(PORT);
mkdirSync('output/sidebar',{recursive:true});
const browser=await chromium.launch({channel:'chrome'}), results=[];
function check(name,ok){results.push({name,ok});console.log(`${ok?'PASS':'FAIL'} ${name}`);}
try {
 const page=await browser.newPage();
 for(const width of [1600,1440,1280,1024,768,430,390,360]){
  await page.setViewportSize({width,height:1000});
  for(const route of ['/','/tools/image-compressor','/command-center']){
   await page.goto(base+route,{waitUntil:'networkidle'});
   if(width>=1024){
    for(const state of ['expanded','collapsed']){
     if(state==='expanded'){await page.locator('#desktop-navigation').hover();}else{await page.locator('main h1').click();await page.mouse.move(width-40,700);}
     await page.waitForTimeout(650);
     const m=await page.evaluate(()=>{const nav=document.querySelector('.rail').getBoundingClientRect(), main=document.querySelector('main').getBoundingClientRect(), footer=document.querySelector('footer').getBoundingClientRect();return {ok:nav.right<=main.left&&nav.right<=footer.left,overflow:document.documentElement.scrollWidth>innerWidth};});
     check(`${width} ${route} ${state}: content and footer clear navigation`,m.ok&&!m.overflow);
     await page.screenshot({path:`output/sidebar/${width}-${route.replaceAll('/','_')}-${state}.png`,fullPage:true});
    }
   }else{
    check(`${width} ${route}: no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const menu=page.getByRole('button',{name:'Menu',exact:true});await menu.click();
    check(`${width} ${route}: drawer modal and scroll locked`,await page.getByRole('dialog',{name:'Site navigation'}).isVisible()&&await page.evaluate(()=>getComputedStyle(document.documentElement).overflow==='hidden'));
    await page.screenshot({path:`output/sidebar/${width}-${route.replaceAll('/','_')}-drawer.png`});
    await page.keyboard.press('Escape');check(`${width} ${route}: Escape returns focus`,await menu.evaluate(el=>el===document.activeElement));
   }
  }
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(base,{waitUntil:'networkidle'});
 const before=await page.locator('.app-frame').getAttribute('data-sidebar');await page.reload({waitUntil:'networkidle'});
 check('preference survives reload',await page.locator('.app-frame').getAttribute('data-sidebar')===before);
 writeFileSync('output/sidebar/results.json',JSON.stringify(results,null,2));
}finally{await browser.close();if(server)await stopServer(server);}
console.log(`${results.filter(x=>x.ok).length}/${results.length} checks passed`);
if(results.some(x=>!x.ok))process.exitCode=1;

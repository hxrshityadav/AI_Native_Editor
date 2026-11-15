import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { ROOT, startServer, stopServer, createChecks } from './helpers.mjs';
import { join } from 'node:path';
const OUT=join(ROOT,process.env.CAPSULE_TEST_OUT || 'output/capsule-navigation'), PORT=3201, base=`http://localhost:${PORT}`;
mkdirSync(OUT,{recursive:true});
const {check,finish}=createChecks();
const server=await startServer(PORT), browser=await chromium.launch({channel:'chrome'});
try {
 for(const theme of ['dark','light']){
  const page=await browser.newPage();
  await page.addInitScript(theme=>localStorage.setItem('rf-site-theme',theme),theme);
  for(const width of [1600,1440,1280,1024,768,430,390,360]){
   await page.setViewportSize({width,height:900});
   await page.goto(base+'/tools/image-compressor',{waitUntil:'networkidle'});
   if(width>=1024){
    const iconPositions=[];
    for(const expanded of [true,false]){
     const toggle=page.getByRole('button',{name:'Toggle sidebar'});
     if(expanded){await page.locator('#desktop-navigation').hover();await page.waitForTimeout(400);}else{await page.locator('main h1').click();await page.mouse.move(page.viewportSize().width-60,700);await page.waitForTimeout(600);}
     await page.waitForTimeout(250);
     const geometry=await page.locator('#desktop-navigation').evaluate(nav=>{
      const r=nav.getBoundingClientRect(), svg=nav.querySelector('svg').getBoundingClientRect(), main=document.querySelector('main').getBoundingClientRect(), footer=document.querySelector('footer').getBoundingClientRect();
      return {width:r.width,iconX:svg.x-r.x,iconY:svg.y-r.y,clear:r.right<=main.left&&r.right<=footer.left,overflow:document.documentElement.scrollWidth>innerWidth};
     });
     iconPositions.push(geometry);
     check(`${theme} ${width} ${expanded?'expanded':'collapsed'}: correct capsule width and no overlap`,geometry.width===(expanded?208:56)&&geometry.clear&&!geometry.overflow);
     check(`${theme} ${width}: photo category active`,await page.locator('#desktop-navigation a[aria-current="page"]').getAttribute('aria-label')==='Photo tools');
     if(!expanded){
      await page.locator('#desktop-navigation a').first().focus();
      check(`${theme} ${width}: keyboard focus reveals navigation`,await toggle.getAttribute('aria-expanded')==='true');
      await page.locator('main h1').click();await page.mouse.move(width-60,700);await page.waitForTimeout(600);
     }
     await page.screenshot({path:join(OUT,`${theme}-${width}-${expanded?'expanded':'collapsed'}.png`)});
    }
    check(`${theme} ${width}: icons keep their position inside the capsule`,iconPositions[0].iconX===iconPositions[1].iconX&&iconPositions[0].iconY===iconPositions[1].iconY);
   }else{
    await page.screenshot({path:join(OUT,`${theme}-${width}-closed.png`)});
    await page.getByRole('button',{name:'Menu',exact:true}).click();
    await page.waitForTimeout(260);
    const drawer=page.getByRole('dialog',{name:'Site navigation'});
    check(`${theme} ${width}: mobile reuses capsule and locks page`,await drawer.locator('.rail').isVisible()&&await page.evaluate(()=>getComputedStyle(document.documentElement).overflow==='hidden'));
    check(`${theme} ${width}: no clipped capsule`,await drawer.locator('.rail').evaluate(nav=>nav.getBoundingClientRect().right<=innerWidth&&nav.scrollWidth<=nav.clientWidth));
    await page.screenshot({path:join(OUT,`${theme}-${width}-drawer.png`)});
    await page.keyboard.press('Escape');
    check(`${theme} ${width}: Escape returns focus`,await page.getByRole('button',{name:'Menu',exact:true}).evaluate(el=>el===document.activeElement));
   }
  }
  await page.setViewportSize({width:1440,height:900});
  for(const route of ['/','/command-center']){
   await page.goto(base+route,{waitUntil:'networkidle'});
   for(const expanded of [true,false]){
    if(expanded){await page.locator('#desktop-navigation').hover();await page.waitForTimeout(400);}else{await page.locator('main h1').click();await page.mouse.move(page.viewportSize().width-60,700);await page.waitForTimeout(600);}
    await page.waitForTimeout(250);
    const clearance=await page.evaluate(()=>{const nav=document.querySelector('#desktop-navigation').getBoundingClientRect(), footer=document.querySelector('footer').getBoundingClientRect();return nav.right<=footer.left&&document.documentElement.scrollWidth<=innerWidth;});
    check(`${theme} ${route} ${expanded}: footer clearance`,clearance);
    await page.screenshot({path:join(OUT,`${theme}-${route==='/'?'home':'command'}-${expanded?'expanded':'collapsed'}.png`)});
   }
  }
  await page.reload({waitUntil:'networkidle'});
  check(`${theme}: compact default survives reload`,await page.getByRole('button',{name:'Toggle sidebar'}).getAttribute('aria-expanded')==='false');
  await page.setViewportSize({width:390,height:844});
  const menu=page.getByRole('button',{name:'Menu',exact:true});
  await menu.click(); await page.mouse.click(380,400);
  check(`${theme}: backdrop dismisses drawer`,!await page.getByRole('dialog',{name:'Site navigation'}).isVisible());
  await menu.click();await page.getByRole('dialog',{name:'Site navigation'}).getByRole('link',{name:'Resize Image',exact:true}).click();
  check(`${theme}: tool selection dismisses drawer`,!await page.getByRole('dialog',{name:'Site navigation'}).isVisible());
  await page.close();
 }
}finally{await browser.close();await stopServer(server);}
finish();




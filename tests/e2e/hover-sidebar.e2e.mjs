import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, startServer, stopServer, createChecks } from './helpers.mjs';
const OUT=join(ROOT,process.env.HOVER_TEST_OUT || 'output/hover-sidebar'), PORT=3203, BASE=`http://localhost:${PORT}`;
mkdirSync(OUT,{recursive:true});
const {check,finish}=createChecks(), evidence=[];
const server=await startServer(PORT), browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1600,1440,1280,1024]){
  await page.setViewportSize({width,height:900});await page.goto(BASE+'/tools/image-compressor',{waitUntil:'networkidle'});
  const nav=page.locator('#desktop-navigation'), button=page.getByRole('button',{name:'Toggle sidebar'});
  const closed=await nav.evaluate(el=>el.getBoundingClientRect().width);
  check(`${width}: collapsed by default`,closed===56&&await button.getAttribute('aria-expanded')==='false');
  const before=await page.locator('main').boundingBox();
  const logoBefore=await page.locator('.rail-mark').boundingBox();
  await page.evaluate(()=>{
   window.__positions=[];window.__sample=true;
   function sample(){if(!window.__sample)return;const r=document.querySelector('main').getBoundingClientRect();window.__positions.push([r.x,r.width]);requestAnimationFrame(sample);}requestAnimationFrame(sample);
  });
  await nav.getByRole('link',{name:'Home',exact:true}).hover();
  await page.waitForTimeout(50);check(`${width}: expand delay`,await button.getAttribute('aria-expanded')==='false');
  if(width===1440){await page.waitForTimeout(100);await page.screenshot({path:join(OUT,'1440-transition.png')});}
  await page.waitForTimeout(350);check(`${width}: hover expands`,await nav.evaluate(el=>el.getBoundingClientRect().width)===208);
  check(`${width}: expanded labels are readable`,await nav.locator('.rail-label').evaluateAll(labels=>labels.every(el=>el.getBoundingClientRect().width>0&&getComputedStyle(el).opacity==='1')));
  check(`${width}: reference capsule color and geometry`,await nav.evaluate(el=>{const c=getComputedStyle(el),a=getComputedStyle(el.querySelector('a'));return c.backgroundColor==='rgb(19, 19, 21)'&&c.padding==='6px'&&c.borderRadius==='28px'&&a.height==='44px';}));
  check(`${width}: independent logo stays above the icon lane`,Math.abs((await page.locator('.rail-mark').boundingBox()).x-logoBefore.x)<.1&&(await page.locator('.rail-mark').boundingBox()).width===56);
  check(`${width}: no permanent desktop collapse control`,await button.evaluate(el=>getComputedStyle(el).opacity==='0'&&el.getBoundingClientRect().height===0));
  await nav.getByRole('link',{name:'Video tools',exact:true}).hover();await page.waitForTimeout(350);
  check(`${width}: moving among links keeps expansion`,await button.getAttribute('aria-expanded')==='true');
  await page.mouse.move(width-60,700);await page.waitForTimeout(120);
  check(`${width}: leave delay holds labels`,await button.getAttribute('aria-expanded')==='true');
  await nav.getByRole('link',{name:'Home',exact:true}).hover();await page.waitForTimeout(350);
  check(`${width}: re-entry cancels pending collapse`,await button.getAttribute('aria-expanded')==='true');
  await page.mouse.move(width-60,700);await page.waitForTimeout(600);
  check(`${width}: leave eventually collapses`,await nav.evaluate(el=>el.getBoundingClientRect().width)===56);
  const positions=await page.evaluate(()=>{window.__sample=false;return window.__positions;});
  check(`${width}: main genuinely resizes within the grid bounds`,positions.some(([x,w])=>Math.abs(x-before.x-152)<.1&&Math.abs(w-before.width+152)<.1)&&positions.every(([x,w])=>x>=before.x-.1&&x<=before.x+152.1&&w>=before.width-152.1&&w<=before.width+.1));
  evidence.push({width,frames:positions.length,positions});
  await nav.getByRole('link',{name:'Photo tools',exact:true}).focus();await page.waitForTimeout(300);
  check(`${width}: keyboard focus expands`,await button.getAttribute('aria-expanded')==='true');
  await page.waitForTimeout(400);check(`${width}: focus prevents automatic collapse`,await button.getAttribute('aria-expanded')==='true');
  await page.screenshot({path:join(OUT,`${width}-expanded.png`)});
  await page.locator('main h1').click();await page.mouse.move(width-60,700);await page.waitForTimeout(600);
  check(`${width}: blur collapses when pointer is outside`,await nav.evaluate(el=>el.getBoundingClientRect().width)===56);
  await page.screenshot({path:join(OUT,`${width}-collapsed.png`)});
  const clearance=await page.evaluate(()=>{const n=document.querySelector('#desktop-navigation').getBoundingClientRect(),m=document.querySelector('main').getBoundingClientRect();return n.right<=m.left&&document.documentElement.scrollWidth<=innerWidth;});
  check(`${width}: no overlap or overflow`,clearance);
 }
 for(const width of [768,430,390,360]){
  await page.setViewportSize({width,height:844});await page.goto(BASE,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Menu',exact:true}).click();await page.waitForTimeout(260);
  check(`${width}: mobile drawer works`,await page.getByRole('dialog',{name:'Site navigation'}).isVisible()&&await page.evaluate(()=>getComputedStyle(document.documentElement).overflow==='hidden'));
  await page.screenshot({path:join(OUT,`${width}-drawer.png`)});
  await page.keyboard.press('Escape');check(`${width}: Escape restores focus`,await page.getByRole('button',{name:'Menu',exact:true}).evaluate(el=>el===document.activeElement));
 }
 const touch=await browser.newContext({hasTouch:true,isMobile:false,viewport:{width:1024,height:900}}), tablet=await touch.newPage();
 await tablet.goto(BASE,{waitUntil:'networkidle'});
 await tablet.getByRole('button',{name:'Toggle sidebar'}).tap();await tablet.waitForTimeout(300);
 check('touch: tap expands',await tablet.getByRole('button',{name:'Toggle sidebar'}).getAttribute('aria-expanded')==='true');
 await tablet.getByRole('button',{name:'Toggle sidebar'}).tap();await tablet.waitForTimeout(300);
 check('touch: tap again collapses',await tablet.getByRole('button',{name:'Toggle sidebar'}).getAttribute('aria-expanded')==='false');
 await touch.close();
 const reduced=await browser.newPage({reducedMotion:'reduce',viewport:{width:1440,height:900}});
 await reduced.goto(BASE,{waitUntil:'networkidle'});await reduced.locator('#desktop-navigation a').first().hover();await reduced.waitForTimeout(150);
 const motion=await reduced.locator('#desktop-navigation').evaluate(el=>getComputedStyle(el).transitionDuration);
 check('reduced motion: expansion works without animation',await reduced.getByRole('button',{name:'Toggle sidebar'}).getAttribute('aria-expanded')==='true'&&motion.split(',').every(s=>parseFloat(s)===0));
 await reduced.close();
 check('no browser exceptions',errors.length===0);
 writeFileSync(join(OUT,'geometry.json'),JSON.stringify(evidence,null,2));
}finally{await browser.close();await stopServer(server);}
finish();




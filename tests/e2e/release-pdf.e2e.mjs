import { chromium } from "playwright";
import { mkdirSync,readFileSync,writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT,startServer,stopServer,createChecks } from "./helpers.mjs";
const OUT=join(ROOT,"output/release-certification"),BASE="http://localhost:3187";mkdirSync(OUT,{recursive:true});
const {check,finish}=createChecks(),server=await startServer(3187,{env:{REEL_ENABLE_CLOUD:""}}),browser=await chromium.launch({channel:"chrome"});
const results=[];
try{
 const context=await browser.newContext(),printer=await context.newPage(),page=await context.newPage();
 const font=readFileSync(join(ROOT,"public/fonts/hind/hind-devanagari-600-normal.woff2")).toString("base64");
 const cases=[
  ["columns",'<div style="display:flex;gap:40px"><div>Left first paragraph.<p>Left second paragraph.</p></div><div>Right first paragraph.<p>Right second paragraph.</p></div></div>',["Left first paragraph.","Left second paragraph.","Right first paragraph.","Right second paragraph."]],
  ["table","<table><tr><th>Name</th><th>Count</th></tr><tr><td>Priya</td><td>23</td></tr><tr><td>Alex</td><td>105</td></tr></table>",["Name","Count","Priya","23","Alex","105"]],
  ["rotated",'<div style="transform:rotate(90deg);transform-origin:0 0;margin-left:200px">Rotated selectable words.</div>',["Rotated selectable words."]],
  ["hindi",'<p style="font-family:Hindi">भारत का नाम</p>',["भारत का नाम"]],
  ["hindi-unmapped",'<p style="font-family:Hindi">नमस्ते दुनिया</p>',[]],
  ["fifty-pages",Array.from({length:50},(_,i)=>`<div style="break-after:page">Page ${i+1}: locally extracted text.</div>`).join(""),["Page 1:","Page 50:"]],
 ];
 await page.goto(BASE+"/tools/pdf-to-audio");
 for(const [name,html,needles]of cases){
  await printer.setContent(`<style>@font-face{font-family:Hindi;src:url(data:font/woff2;base64,${font})}body{font:20px Arial}td,th{padding:15px}</style>${html}`);await printer.evaluate(()=>document.fonts.ready);
  const path=join(OUT,name+".pdf");await printer.pdf({path,format:"A4"});
  await page.getByLabel("Choose PDF",{exact:true}).setInputFiles(path);await page.getByRole("button",{name:"Use selected text for speech",exact:true}).waitFor({timeout:90000});
  if(name==="fifty-pages")await page.getByLabel("Last page",{exact:true}).fill("50");
  const text=await page.getByLabel("Extracted PDF text",{exact:true}).inputValue();results.push({name,text});
  if(name==="hindi-unmapped")check("PDF variations: damaged embedded glyph mappings are disclosed",await page.getByText(/missing character mappings on pages 1/i).isVisible());
  else check(`PDF variations: ${name} retains expected embedded text`,needles.every(word=>text.includes(word)));
  if(name==="columns")check("PDF variations: generated columns retain reading order",needles.every((word,i)=>!i||text.indexOf(word)>text.indexOf(needles[i-1])));
  if(name==="table")check("PDF variations: table rows retain word separation",text.replace(/\s+/g," ").includes("Name Count Priya 23 Alex 105"));
 }
 await context.close();
}finally{writeFileSync(join(OUT,"pdf-variations.json"),JSON.stringify(results,null,2));await browser.close();await stopServer(server);}finish();

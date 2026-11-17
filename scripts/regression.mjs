// One owned production build/server; suites run serially and cannot silently skip failures.
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, startServer, stopServer } from '../tests/e2e/helpers.mjs';
const stamp = new Date().toISOString().replaceAll(':', '-');
const dir = join(ROOT, 'output/recovery/regression', stamp);
mkdirSync(dir, { recursive:true });
const results = [], port = 3220;
let active, server;
const env = { ...process.env, REEL_ENABLE_CLOUD:'', REEL_E2E_PORT:String(port), SIDEBAR_TEST_URL:`http://localhost:${port}`,
  SITE_TEST_PORT:String(port), VIDEO_TEST_PORT:String(port), LOCAL_TOOLS_PORT:String(port), SWEEP_PORT:String(port),
  BENCH_CLIPS:process.env.BENCH_CLIPS || 'user-hinglish', BENCH_MODELS:'tiny,base,hinglish-swift', BENCH_LANGS:'hi', BENCH_RESULTS:`recovery-${stamp}.json`, BENCH_REPORT:`recovery-${stamp}.md` };
writeFileSync(join(dir,'artifacts.json'),JSON.stringify({benchmarkResults:join(ROOT,'output/caption-bench',env.BENCH_RESULTS),benchmarkReport:join(ROOT,'output/caption-bench',env.BENCH_REPORT)},null,2));
async function run(name, args, timeout = 40 * 60_000) {
  console.log(`Running ${name}; log: ${join(dir, name + '.log')}`);
  const log = createWriteStream(join(dir, name + '.log'));
  const began = Date.now();
  try {
    await new Promise((resolve, reject) => {
      active = spawn(process.execPath, args, { cwd:ROOT, env, stdio:['ignore', 'pipe', 'pipe'], detached:true, windowsHide:true });
      active.stdout.pipe(log, { end:false }); active.stderr.pipe(log, { end:false });
      const timer = setTimeout(() => { stopServer(active); reject(new Error(`${name}: deadline exceeded`)); }, timeout);
      active.once('error', error => { clearTimeout(timer); reject(error); });
      active.once('exit', code => { clearTimeout(timer); active = undefined; if(code === 0) resolve(); else reject(new Error(`${name}: exit ${code}`)); });
    });
    results.push({ name, ok:true, ms:Date.now()-began });
  } catch (error) { results.push({ name, ok:false, ms:Date.now()-began, error:String(error) }); throw error; }
  finally { await new Promise(resolve => log.end(resolve)); writeFileSync(join(dir, 'results.json'), JSON.stringify(results,null,2)); }
}
const npm = join(process.execPath, '..', 'node_modules/npm/bin/npm-cli.js');
async function suite(name,args){try{await run(name,args);}catch(error){console.error(String(error));}}
try {
  await run('check', [npm, 'run', 'check']);
  await run('build', [npm, 'run', 'build']);
  try { await fetch(`http://localhost:${port}/`, { signal:AbortSignal.timeout(1000) }); throw new Error('Test port is already in use'); }
  catch (error) { if (error.message === 'Test port is already in use') throw error; }
  // Start without the reuse flag; subsequent suite helpers receive it via their child environment.
  server = await startServer(port, { env:{ REEL_ENABLE_CLOUD:'' } });
  await suite('caption-bench', [join(ROOT, 'tests/e2e/caption-bench.e2e.mjs')]);
  if(existsSync(join(ROOT,'output/caption-bench',env.BENCH_RESULTS)))await suite('caption-score', [join(ROOT, 'tests/e2e/caption-bench-score.mjs')]);
  else{results.push({name:'caption-score',ok:false,error:'Blocked: this run produced no fresh benchmark artifact'});writeFileSync(join(dir,'results.json'),JSON.stringify(results,null,2));}
  for (const suite of ['site','redesign','command-center','capsule-navigation','dynamic-sidebar','hover-sidebar','sidebar-layout','header-spacing','scrollbar','ui-sweep',
    'photos','passport','heic','background','video-compressor','media','mixer','cutter-zoom','subtitle-studio','localtools','notes','pdf-audio','local-model-cache','transcription-benchmark']) {
    await run(suite, [join(ROOT, `tests/e2e/${suite}.e2e.mjs`)]).catch(error=>console.error(String(error)));
  }
  if(results.some(result=>!result.ok)){process.exitCode=1;console.error('Complete regression chain finished with failures; inspect results.json.');}
  else console.log('Complete uninterrupted regression chain passed.');
} catch (error) { console.error(String(error)); process.exitCode = 1; }
finally { if(active) stopServer(active); if(server) stopServer(server); }

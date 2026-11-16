import { expect, it, vi, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { probe, mediaExec, mediaSpawn } from '../e2e/helpers.mjs';
vi.mock('node:child_process',async importOriginal=>({...await importOriginal<typeof import('node:child_process')>(),execFileSync:vi.fn(),spawnSync:vi.fn()}));
afterEach(()=>{vi.mocked(execFileSync).mockReset();vi.mocked(spawnSync).mockReset();});
it('retries an OS-interrupted probe once and still parses the actual successful result',()=>{
  vi.mocked(execFileSync).mockImplementationOnce(()=>{throw Object.assign(new Error('interrupted'),{status:0xC000013A});}).mockReturnValueOnce(Buffer.from('{"streams":[{"codec_type":"audio"}]}'));
  expect(probe('fixture.m4a')).toEqual({streams:[{codec_type:'audio'}]});
  expect(execFileSync).toHaveBeenCalledTimes(2);
});
it('hides media utility windows and retries a spawned OS interruption without accepting a format failure',()=>{
  vi.mocked(execFileSync).mockReturnValueOnce(Buffer.from('pixels'));
  expect(mediaExec('ffmpeg',[])).toEqual(Buffer.from('pixels'));
  expect(execFileSync).toHaveBeenCalledWith('ffmpeg',[],{windowsHide:true});
  vi.mocked(spawnSync).mockReturnValueOnce({status:0xC000013A} as ReturnType<typeof spawnSync>).mockReturnValueOnce({status:1,stderr:'bad format'} as ReturnType<typeof spawnSync>);
  expect(mediaSpawn('ffmpeg',[])).toMatchObject({status:1,stderr:'bad format'});
  expect(spawnSync).toHaveBeenCalledTimes(2);
});
it('never retries a format failure or hides a second interruption',()=>{
  vi.mocked(execFileSync).mockImplementation(()=>{throw Object.assign(new Error('bad format'),{status:1});});
  expect(()=>probe('fixture.m4a')).toThrow('bad format'); expect(execFileSync).toHaveBeenCalledTimes(1);
  vi.mocked(execFileSync).mockReset().mockImplementation(()=>{throw Object.assign(new Error('interrupted'),{status:0xC000013A});});
  expect(()=>probe('fixture.m4a')).toThrow('interrupted'); expect(execFileSync).toHaveBeenCalledTimes(2);
});

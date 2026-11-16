import { expect, it } from 'vitest';
import { measuredWords } from '../../src/lib/subtitles/timing';
it('preserves measured repeated words, punctuation, pauses and code switching', () => {
  const chunks = [{text:'API,',timestamp:[0.2,0.5] as [number,number]}, {text:'haan',timestamp:[0.6,0.8] as [number,number]}, {text:'haan!',timestamp:[8,8.3] as [number,number]}];
  expect(measuredWords(chunks,10)).toEqual(chunks.map(c=>({text:c.text,start:c.timestamp[0],end:c.timestamp[1]})));
});
it('rejects missing, reversed, overlapping and outside-audio times instead of inventing boundaries', () => {
  for(const timestamp of [[null,1],[0,null],[1,0],[0,11],[-1,1],[0,NaN]] as [number|null,number|null][]) expect(measuredWords([{text:'word',timestamp}],10)).toBeUndefined();
  expect(measuredWords([{text:'one',timestamp:[0,1]},{text:'two',timestamp:[0.9,2]}],10)).toBeUndefined();
});
it('does not turn a phrase, empty result or zero-length segment into word highlighting', () => {
  expect(measuredWords([{text:'a whole phrase',timestamp:[0,8]}],10)).toBeUndefined();
  expect(measuredWords([],10)).toBeUndefined();
  expect(measuredWords([{text:'word',timestamp:[1,1]}],10)).toBeUndefined();
  expect(measuredWords([{text:'word',timestamp:[0,1]}],10,'word missing')).toBeUndefined();
  expect(measuredWords([{text:'word',timestamp:[0,1]}],10,'word')).toEqual([{text:'word',start:0,end:1}]);
});

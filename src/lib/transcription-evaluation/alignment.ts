import type { Counts, Edit } from "./types";
export function align(reference:string[],hypothesis:string[]):Edit[] {
  const n=reference.length,m=hypothesis.length,width=m+1;
  if((n+1)*width>16_000_000)throw new Error("Alignment exceeds 16 million cells. Split the recording before scoring.");
  const d=new Uint32Array((n+1)*width);
  for(let i=0;i<=n;i++)d[i*width]=i;for(let j=0;j<=m;j++)d[j]=j;
  for(let i=1;i<=n;i++)for(let j=1;j<=m;j++)d[i*width+j]=Math.min(d[(i-1)*width+j]+1,d[i*width+j-1]+1,d[(i-1)*width+j-1]+Number(reference[i-1]!==hypothesis[j-1]));
  const edits:Edit[]=[];let i=n,j=m;
  // Stable tie order: diagonal, deletion, insertion. Insertion belongs to the following reference word, or last word at EOF.
  while(i||j){
    if(i&&j&&d[i*width+j]===d[(i-1)*width+j-1]+Number(reference[i-1]!==hypothesis[j-1])){edits.push({operation:reference[i-1]===hypothesis[j-1]?"correct":"substitution",referenceIndex:i-1,hypothesisIndex:j-1,reference:reference[i-1],hypothesis:hypothesis[j-1],anchor:i-1});i--;j--;}
    else if(i&&d[i*width+j]===d[(i-1)*width+j]+1){edits.push({operation:"deletion",referenceIndex:i-1,hypothesisIndex:null,reference:reference[i-1],hypothesis:null,anchor:i-1});i--;}
    else{edits.push({operation:"insertion",referenceIndex:null,hypothesisIndex:j-1,reference:null,hypothesis:hypothesis[j-1],anchor:n?Math.min(i,n-1):-1});j--;}
  }
  return edits.reverse();
}
export function countEdits(edits:Edit[],referenceWords:number,hypothesisWords=edits.filter(e=>e.hypothesisIndex!==null).length):Counts {
  const substitutions=edits.filter(e=>e.operation==="substitution").length,deletions=edits.filter(e=>e.operation==="deletion").length,insertions=edits.filter(e=>e.operation==="insertion").length;
  return {substitutions,deletions,insertions,referenceWords,hypothesisWords,wer:referenceWords?(substitutions+deletions+insertions)/referenceWords:null};
}
export function characterErrors(reference:string,hypothesis:string){
  const a=[...reference.replace(/\s/gu,"")],b=[...hypothesis.replace(/\s/gu,"")];
  if(a.length*b.length>50_000_000)throw new Error("Character alignment is too large. Split the recording.");
  let prev=Uint32Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){const row=new Uint32Array(b.length+1);row[0]=i;for(let j=1;j<=b.length;j++)row[j]=Math.min(prev[j]+1,row[j-1]+1,prev[j-1]+Number(a[i-1]!==b[j-1]));prev=row;}
  return {rate:a.length?prev[b.length]/a.length:null,errors:prev[b.length],referenceCharacters:a.length};
}

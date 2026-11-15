"use client";
import { useEffect, useRef, useState } from "react";
export function useLocalJob<T>(){
  const [result,setResult]=useState<T>(),[busy,setBusy]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState(""),[progress,setProgress]=useState<number>(),[elapsed,setElapsed]=useState(0);const active=useRef<AbortController|null>(null),started=useRef(0);
  useEffect(()=>()=>active.current?.abort(),[]);
  useEffect(()=>{if(!busy)return;const timer=setInterval(()=>setElapsed((performance.now()-started.current)/1000),250);return()=>clearInterval(timer);},[busy]);
  function reset(){active.current?.abort();active.current=null;setBusy("");setResult(undefined);setError("");setNotice("");setProgress(undefined);}
  function cancel(){reset();setNotice("Operation cancelled. You can retry or choose another file.");}
  async function run(work:(signal:AbortSignal,status:(value:string)=>void,progress:(value:number)=>void)=>Promise<T>){reset();const controller=new AbortController();active.current=controller;started.current=performance.now();setElapsed(0);setBusy("Preparing local processing");const status=(value:string)=>{if(!controller.signal.aborted)setBusy(value);},progress=(value:number)=>{if(!controller.signal.aborted)setProgress(Math.max(0,Math.min(1,value)));};try{const value=await work(controller.signal,status,progress);if(!controller.signal.aborted){setResult(value);return value;}}catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Processing failed. Retry with a smaller file.");}finally{if(active.current===controller){active.current=null;setBusy("");setElapsed((performance.now()-started.current)/1000);}}}
  return{result,busy,error,notice,progress,elapsed,reset,cancel,run};
}

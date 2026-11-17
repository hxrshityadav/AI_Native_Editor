import type { BenchmarkConfig,BenchmarkReport,Prediction,Recording,Score } from "./types";
function request<T>(payload:unknown,signal:AbortSignal):Promise<T>{
  signal.throwIfAborted();return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL("./evaluation.worker.ts",import.meta.url),{type:"module"}),clean=()=>{clearTimeout(timer);signal.removeEventListener("abort",abort);worker.terminate();},abort=()=>{clean();reject(new DOMException("Cancelled","AbortError"));},timer=setTimeout(()=>{clean();reject(new Error("Scoring deadline exceeded. Split the recording"));},120000);
    signal.addEventListener("abort",abort,{once:true});worker.onmessage=({data})=>{clean();if(data.error)reject(new Error(data.error));else resolve(data);};worker.onerror=()=>{clean();reject(new Error("Scoring worker failed. Retry with a shorter recording"));};worker.postMessage(payload);
  });
}
export const scoreInWorker=(recording:Recording,prediction:Prediction,config:BenchmarkConfig,signal:AbortSignal)=>request<{strict:Score;normalized:Score}>({kind:"score",recording,prediction,config},signal);
export const parseReportInWorker=async(value:unknown,signal=new AbortController().signal)=>(await request<{report:BenchmarkReport}>({kind:"report",value},signal)).report;

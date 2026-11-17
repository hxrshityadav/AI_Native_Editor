import { score } from "./scoring";
import { parseReport } from "./report";
import type { BenchmarkConfig,Prediction,Recording } from "./types";
type Input={kind:"score";recording:Recording;prediction:Prediction;config:BenchmarkConfig}|{kind:"report";value:unknown};
const scope=self as unknown as {onmessage:(event:MessageEvent<Input>)=>void;postMessage:(value:unknown)=>void};
scope.onmessage=({data})=>{try{scope.postMessage(data.kind==="report"?{report:parseReport(data.value)}:{strict:score(data.recording,data.prediction,"strict",data.config.boundaryWindow,data.config.vocabulary),normalized:score(data.recording,data.prediction,data.config.profile,data.config.boundaryWindow,data.config.vocabulary)});}catch{scope.postMessage({error:"Invalid report or scoring limit exceeded. Check schema, annotations and model output; split long recordings and retry"});}};

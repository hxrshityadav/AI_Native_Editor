declare module "*transformers.min.js" {
  export const env: { allowLocalModels:boolean;allowRemoteModels:boolean;remoteHost:string;remotePathTemplate:string;useBrowserCache:boolean;useCustomCache:boolean;customCache:{match(input:RequestInfo|URL):Promise<Response|undefined>;put(input:RequestInfo|URL,response:Response):Promise<void>}|null;backends:{onnx:{wasm:{wasmPaths:Record<string,string>;numThreads:number}}} };
  export class Tensor { constructor(type:string,data:BigInt64Array|Float32Array,dims:number[]); }
  export function pipeline(task:string,model:string,options:Record<string,unknown>):Promise<(input:string|Float32Array,options?:Record<string,unknown>)=>Promise<unknown>>;
}

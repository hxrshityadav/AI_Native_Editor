// ONNX Runtime Web (WASM build) as used by the Background Remover. Resolved by a bundler alias to tools/ort (see
// next.config.ts); only the API this project calls is declared, matching onnxruntime-web 1.30.
declare module "site-ort/wasm" {
  export const env: { wasm: { wasmPaths?: string | { wasm?: string; mjs?: string }; numThreads?: number } };
  export class Tensor {
    constructor(type: "float32", data: Float32Array, dims: readonly number[]);
    readonly data: Float32Array | Uint8Array | Int32Array;
    readonly dims: readonly number[];
  }
  export class InferenceSession {
    static create(model: ArrayBuffer | Uint8Array, options?: { executionProviders?: string[] }): Promise<InferenceSession>;
    readonly inputNames: readonly string[];
    readonly outputNames: readonly string[];
    run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>;
  }
}

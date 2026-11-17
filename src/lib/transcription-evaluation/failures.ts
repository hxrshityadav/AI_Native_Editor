export function evaluationFailure(error:unknown,cancelled:boolean):{errorCode:string;error:string}{
  const message=error instanceof Error?error.message:"";
  if(cancelled)return {errorCode:"CANCELLED",error:"Cancelled; worker resources released"};
  if(/128 MiB|fingerprinting supports/i.test(message))return {errorCode:"INPUT_SIZE",error:"Audio exceeds the 128 MiB evaluation fingerprinting limit. Convert to a smaller local file"};
  if(/fingerprint/i.test(message))return {errorCode:"INPUT_FINGERPRINT",error:"Audio fingerprint mismatch. Reselect the original annotated file"};
  if(/missing/i.test(message))return {errorCode:"INPUT_MISSING",error:"Matching local audio is missing. Reselect the dataset folder"};
  if(/duration differs/i.test(message))return {errorCode:"REFERENCE_DURATION",error:"Audio duration differs from the annotation. Review the dataset"};
  if(/Scoring|Alignment exceeds|Character alignment/i.test(message))return {errorCode:"SCORING_LIMIT",error:"Scoring failed or exceeded alignment limits. Check annotations and split the recording"};
  if(/fetch|download|gateway|locate file|network|HTTP|status code/i.test(message))return {errorCode:"MODEL_ASSET",error:"Model assets could not load. Check the connection and retry with download consent"};
  if(/out of memory|memory allocation|failed to allocate|allocation failed|memory access out of bounds|bad_alloc/i.test(message))return {errorCode:"MODEL_MEMORY",error:"Model memory allocation failed. Use a shorter clip or a device with more memory"};
  if(/stopped responding|deadline|timeout|timed out/i.test(message))return {errorCode:"MODEL_TIMEOUT",error:"Model processing exceeded its deadline. Retry with a shorter recording"};
  if(/worker|WebAssembly|wasm/i.test(message))return {errorCode:"WORKER_RUNTIME",error:"Local worker/runtime failed. Reload or retry on a supported desktop browser"};
  return {errorCode:"MODEL_EXECUTION",error:"Model execution failed. Retry with consent or use a shorter recording"};
}

const FILES=new Set(["config.json","generation_config.json","preprocessor_config.json","processor_config.json","tokenizer.json","tokenizer_config.json","special_tokens_map.json","added_tokens.json","vocab.json","merges.txt","normalizer.json"]);
export const LOCAL_MODEL_VERSION="v1";
// Authoritative LFS metadata at the exact converted repository revision (audit: docs/engineering-recovery.md).
export const LOCAL_MODEL_INTEGRITY:Record<string,{bytes:number;sha256:string}>={
  'Hirecentive-D3l/Whisper-Hindi2Hinglish-Swift-ONNX/resolve/24211661105a7bb9e96a170fb92db173667e31fd/onnx/encoder_model_quantized.onnx':{bytes:23145769,sha256:'0cd4fb050fa9138a075571d9bc0228e2a06ae58951cd4210d3d78bfdf1fd5b9f'},
  'Hirecentive-D3l/Whisper-Hindi2Hinglish-Swift-ONNX/resolve/24211661105a7bb9e96a170fb92db173667e31fd/onnx/decoder_model_merged_quantized.onnx':{bytes:79336412,sha256:'ffab3719c07a7055cd818d194e166c8ed6b214e3e80f6c4ea04b201a4cf12cbe'},
};
export const LOCAL_MODEL_REVISIONS:Record<string,string>={
  "onnx-community/whisper-tiny":"ff4177021cc41f7db950912b73ea4fdf7d01d8e7",
  // Timestamped exports (cross-attention outputs) for real word timings in Subtitle Studio. Apache-2.0 via openai/whisper-*.
  "onnx-community/whisper-tiny_timestamped":"517244293732ee2d58139af5814231b7e6830a0d",
  "onnx-community/whisper-base_timestamped":"608c49e61301901684bc36cac8f74b95ff6b5a8e",
  // Hindi speech -> Roman Hinglish. Oriserve/Whisper-Hindi2Hinglish-Swift (Apache-2.0, whisper-base fine-tune), ONNX
  // conversion by Hirecentive-D3l. Best of five models on FLEURS hi_in (2026-11-15): median WER 39.8%, CER 23%.
  "Hirecentive-D3l/Whisper-Hindi2Hinglish-Swift-ONNX":"24211661105a7bb9e96a170fb92db173667e31fd",
  "Xenova/speecht5_tts":"1723781b8ce2d02f0400c8337be04ae8ee3d6d56",
  "Xenova/speecht5_hifigan":"cf980c3610d7b7f20919960031066ef7905737bd",
};
export function localModelAsset(asset:string[]):string|undefined{
  if(asset[0]===LOCAL_MODEL_VERSION)asset=asset.slice(1);
  if(asset.length===1&&asset[0]==="speaker.bin")return "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/542437c29cc5273cfd29e25c77696f2b349badd7/speaker_embeddings.bin";
  const [organization,model,resolve,revision,...parts]=asset,filename=parts.join("/");
  const pinned=LOCAL_MODEL_REVISIONS[`${organization}/${model}`];
  if(resolve!=="resolve"||!pinned||!["main",pinned].includes(revision))return;
  if(!FILES.has(filename)&&!/^onnx\/(?:encoder_model|decoder_model|decoder_model_merged|model)(?:_(?:q4|quantized|fp16|q8))?\.onnx(?:_data)?$/.test(filename))return;
  return `https://huggingface.co/${[organization,model,"resolve",pinned,...parts].map(encodeURIComponent).join("/")}`;
}

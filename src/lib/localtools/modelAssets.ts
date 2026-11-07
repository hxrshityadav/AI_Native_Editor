const FILES=new Set(["config.json","generation_config.json","preprocessor_config.json","processor_config.json","tokenizer.json","tokenizer_config.json","special_tokens_map.json","added_tokens.json","vocab.json","merges.txt","normalizer.json"]);
export const LOCAL_MODEL_VERSION="v1";
export const LOCAL_MODEL_REVISIONS:Record<string,string>={
  "onnx-community/whisper-tiny":"ff4177021cc41f7db950912b73ea4fdf7d01d8e7",
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

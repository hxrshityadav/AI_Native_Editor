/** Asset delivery only: no uploaded audio, transcript, prompts or arbitrary upstream URLs. */
const HOST = "https://media.openreel.video/models/";
const MODEL = new Set(["whisper-tiny", "whisper-large-v3-turbo_timestamped"]);
const CONFIG = new Set(["config.json", "generation_config.json", "preprocessor_config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "added_tokens.json", "vocab.json", "merges.txt", "normalizer.json"]);
export async function GET(request: Request, context: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await context.params;
  const [organization, model, resolve, revision, ...file] = asset;
  const filename = file.join("/");
  if (organization !== "onnx-community" || !MODEL.has(model) || resolve !== "resolve" || revision !== "main" ||
      !(CONFIG.has(filename) || /^onnx\/(?:encoder_model|decoder_model_merged)(?:_(?:q4|quantized|fp16|q8|int8|uint8|bnb4))?\.onnx(?:_data)?$/.test(filename))) return new Response("Unknown local model asset", { status: 404 });
  try {
    const response = await fetch(HOST + asset.map(encodeURIComponent).join("/"), { signal: request.signal, cache: "no-store", redirect: "error" });
    if (!response.ok) return new Response("Model asset unavailable. Retry the download when connected.", { status: response.status === 404 ? 404 : 502 });
    const headers = new Headers({ "Content-Type": filename.endsWith(".json") ? "application/json" : "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", "Cross-Origin-Resource-Policy": "same-origin" });
    for (const key of ["Content-Length", "ETag", "Last-Modified"]) { const value = response.headers.get(key); if (value && !(key === "Content-Length" && response.headers.has("Content-Encoding"))) headers.set(key, value); }
    return new Response(response.body, { headers });
  } catch { return new Response("Model download interrupted. Reconnect and retry; media remains on your device.", { status: 502 }); }
}

import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { localModelAsset, LOCAL_MODEL_REVISIONS } from "../../src/lib/localtools/modelAssets";
import { LOCAL_MODEL_CACHE, publicModelCache, speakerVector } from "../../src/lib/localtools/modelCache";
import { GET } from "../../src/app/local-models/[...asset]/route";
afterEach(()=>vi.unstubAllGlobals());
const origin="https://reel.example",url=`${origin}/local-models/v1/speaker.bin`;
const vector=()=>new Uint8Array(readFileSync(new URL("../fixtures/speaker-vector.bin",import.meta.url)));
function fixture(){const entries=new Map<string,Response>();const cache={match:vi.fn(async(key:string)=>entries.get(key)?.clone()),put:vi.fn(async(key:string,response:Response)=>{entries.set(key,response.clone());}),delete:vi.fn(async(key:string)=>entries.delete(key))};const open=vi.fn(async()=>cache);vi.stubGlobal("caches",{open});vi.stubGlobal("crypto",webcrypto);return{entries,cache,open};}
it("pins every allowlisted model and rejects unknown namespaces/revisions",()=>{
 for(const [repo,revision] of Object.entries(LOCAL_MODEL_REVISIONS)){
  expect(localModelAsset(["v1",...repo.split("/"),"resolve","main","config.json"])).toBe(`https://huggingface.co/${repo}/resolve/${revision}/config.json`);
  expect(localModelAsset([...repo.split("/"),"resolve","unreviewed","config.json"])).toBeUndefined();
 }
 expect(localModelAsset(["v2","Xenova","speecht5_tts","resolve","main","config.json"])).toBeUndefined();
 expect(localModelAsset(["v1","speaker.bin"])).toContain("/542437c29cc5273cfd29e25c77696f2b349badd7/");
});
it("isolates only versioned public assets and tolerates unavailable cache storage",async()=>{
 const {entries,open}=fixture(),cache=publicModelCache(origin);
 await cache.put(url,new Response("asset"));expect(open).toHaveBeenCalledWith(LOCAL_MODEL_CACHE);
 await cache.put(`${origin}/studio/private-project`,new Response("never"));await cache.put("https://external.example/local-models/v1/asset",new Response("never"));
 expect(entries.size).toBe(1);expect(await cache.match(`${origin}/local-models/speaker.bin`)).toBeUndefined();
 vi.stubGlobal("caches",{open:vi.fn(async()=>{throw new Error("Denied");})});await expect(publicModelCache(origin).put(url,new Response("asset"))).resolves.toBeUndefined();
});
it("repairs a corrupt cached vector, verifies exact bytes and reuses the good cache without a request",async()=>{
 const {entries}=fixture();entries.set(url,new Response("corrupted"));const fetch=vi.fn(async()=>new Response(vector()));vi.stubGlobal("fetch",fetch);
 const cache=publicModelCache(origin),first=await speakerVector(origin,cache),second=await speakerVector(origin,cache);
 expect(first.length).toBe(512);expect(Array.from(second)).toEqual(Array.from(first));expect(fetch).toHaveBeenCalledOnce();
});
it("rejects a changed voice artifact before caching or inference",async()=>{
 const {entries}=fixture();vi.stubGlobal("fetch",vi.fn(async()=>new Response(new Uint8Array(2048))));
 await expect(speakerVector(origin,publicModelCache(origin))).rejects.toThrow(/integrity/);expect(entries.size).toBe(0);
});
it("repairs a truncated weight by evicting only its cache entry, preserving unrelated models",async()=>{
 const {entries,cache}=fixture(),decoder=`${origin}/local-models/v1/Xenova/speecht5_tts/resolve/main/onnx/decoder_model_merged.onnx`;
 entries.set(decoder,new Response("partial",{headers:{"Content-Length":"244486683"}}));entries.set(url,new Response(vector()));
 expect(await publicModelCache(origin).match(decoder)).toBeUndefined();expect(cache.delete).toHaveBeenCalledWith(decoder);
 expect(entries.has(url)).toBe(true);
});
it("continues without persistence when browser storage is full",async()=>{
 const {cache}=fixture();cache.put.mockRejectedValueOnce(new DOMException("Full","QuotaExceededError"));
 await expect(publicModelCache(origin).put(url,new Response(vector()))).resolves.toBeUndefined();expect(cache.delete).not.toHaveBeenCalled();
});
it("gives immutable headers only to pinned versioned model routes",async()=>{
 const fetch=vi.fn(async()=>new Response("asset",{headers:{"Content-Length":"5"}}));vi.stubGlobal("fetch",fetch);
 const response=await GET(new Request(`${origin}/local-models/v1/asset`),{params:Promise.resolve({asset:["v1","Xenova","speecht5_tts","resolve","main","config.json"]})});
 expect(response.headers.get("Cache-Control")).toContain("immutable");expect(response.headers.get("Content-Length")).toBe("5");expect(fetch.mock.calls.length).toBe(1);
});
it("retries a transient asset failure but never caches error responses",async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(new Response(null,{status:503})).mockResolvedValueOnce(new Response("{}"));vi.stubGlobal("fetch",fetch);
 const params=Promise.resolve({asset:["v1","Xenova","speecht5_tts","resolve","main","config.json"]});
 expect((await GET(new Request(url),{params})).ok).toBe(true);expect(fetch).toHaveBeenCalledTimes(2);
 fetch.mockResolvedValue(new Response(null,{status:404}));
 const missing=await GET(new Request(url),{params});expect(missing.status).toBe(404);expect(missing.headers.get("Cache-Control")).toBe("no-store");
});

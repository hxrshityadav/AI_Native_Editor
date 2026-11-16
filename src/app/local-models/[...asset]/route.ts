import { localModelAsset, LOCAL_MODEL_VERSION, LOCAL_MODEL_INTEGRITY } from "@/lib/localtools/modelAssets";
import { modelDownload, modelRetry } from "@/lib/localtools/modelDelivery";
const failure=(message:string,status:number)=>new Response(message,{status,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
/** Static, allowlisted public weights only. No media/text inputs or provider inference. */
export async function GET(request:Request,context:{params:Promise<{asset:string[]}>}){
  const asset=(await context.params).asset,target=localModelAsset(asset);if(!target)return failure("Unknown local model asset",404);
  if(request.headers.has('Range')&&!/^bytes=\d+-\d*$/.test(request.headers.get('Range')!))return failure('Use a single byte range or restart the model download.',416);
  for(let attempt=0;attempt<5;attempt++){
    if(request.signal.aborted)return failure("Model download cancelled",499);
    try{
      const upstream=await modelDownload(target,request,30_000,'follow',LOCAL_MODEL_INTEGRITY[new URL(target).pathname.slice(1)]);
      if(upstream.status===416)return new Response(null,{status:416,headers:{'Cache-Control':'no-store',...(upstream.headers.has('Content-Range')?{'Content-Range':upstream.headers.get('Content-Range')!}:{})}});
      if(!upstream.ok){await upstream.body?.cancel();if((upstream.status===429||upstream.status>=500)&&attempt<4){await modelRetry(attempt,request.signal);continue;}return failure("Model asset unavailable. Reconnect and retry; your media stays local.",upstream.status===404?404:502);}
      const headers=new Headers({"Content-Type":target.endsWith(".json")?"application/json":"application/octet-stream","Cache-Control":asset[0]===LOCAL_MODEL_VERSION?"public, max-age=31536000, immutable":"public, max-age=86400","Cross-Origin-Resource-Policy":"same-origin","X-Robots-Tag":"noindex, nofollow"});
      for(const key of ["Content-Length","ETag","Accept-Ranges","Content-Range"])if(upstream.headers.has(key)&&!upstream.headers.has("Content-Encoding"))headers.set(key,upstream.headers.get(key)!);
      return new Response(upstream.body,{status:upstream.status,headers});
    }catch{if(attempt<4&&!request.signal.aborted){try{await modelRetry(attempt,request.signal);}catch{return failure('Model download cancelled',499);}continue;}}
  }
  return failure("Model download interrupted. Reconnect and retry.",request.signal.aborted?499:502);
}
// Avoid Next's automatic HEAD calling GET and opening a large weight stream.
export const HEAD=GET;

import { localModelAsset, LOCAL_MODEL_VERSION } from "@/lib/localtools/modelAssets";
import { modelDownload } from "@/lib/localtools/modelDelivery";
const failure=(message:string,status:number)=>new Response(message,{status,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
/** Static, allowlisted public weights only. No media/text inputs or provider inference. */
export async function GET(request:Request,context:{params:Promise<{asset:string[]}>}){
  const asset=(await context.params).asset,target=localModelAsset(asset);if(!target)return failure("Unknown local model asset",404);
  for(let attempt=0;attempt<3;attempt++){
    if(request.signal.aborted)return failure("Model download cancelled",499);
    try{
      const upstream=await modelDownload(target,request);
      if(!upstream.ok){await upstream.body?.cancel();if((upstream.status===429||upstream.status>=500)&&attempt<2){await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));continue;}return failure("Model asset unavailable. Reconnect and retry; your media stays local.",upstream.status===404?404:502);}
      const headers=new Headers({"Content-Type":target.endsWith(".json")?"application/json":"application/octet-stream","Cache-Control":asset[0]===LOCAL_MODEL_VERSION?"public, max-age=31536000, immutable":"public, max-age=86400","Cross-Origin-Resource-Policy":"same-origin","X-Robots-Tag":"noindex, nofollow"});
      for(const key of ["Content-Length","ETag"])if(upstream.headers.has(key)&&!upstream.headers.has("Content-Encoding"))headers.set(key,upstream.headers.get(key)!);
      return new Response(upstream.body,{headers});
    }catch{if(attempt<2&&!request.signal.aborted){await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));continue;}}
  }
  return failure("Model download interrupted. Reconnect and retry.",request.signal.aborted?499:502);
}
// Avoid Next's automatic HEAD calling GET and opening a large weight stream.
export const HEAD=GET;

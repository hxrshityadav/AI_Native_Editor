import { createHash } from 'node:crypto';
export type ModelIntegrity = {bytes:number;sha256:string};
/** Cancel-aware exponential backoff; public asset failures never trigger another provider. */
export function modelRetry(attempt:number,signal:AbortSignal):Promise<void>{
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(new DOMException('Cancelled','AbortError'));return;}
    const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new DOMException('Cancelled','AbortError'));};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},Math.min(8000,500*2**attempt)*(.75+Math.random()*.5));
    signal.addEventListener('abort',abort,{once:true});
  });
}
/** Bounded header/idle waits, rather than a total deadline on large public weights. */
export async function modelDownload(target: string, request: Request, timeoutMs = 30_000, redirect: RequestRedirect = "follow", integrity?:ModelIntegrity): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = () => controller.abort();
  const arm = () => { clearTimeout(timer); timer = setTimeout(abort, timeoutMs); };
  const cleanup = () => { clearTimeout(timer); request.signal.removeEventListener("abort", abort); };
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  arm();
  try {
    const headers = new Headers();
    const range = request.headers.get('Range');
    if (range) {
      if (!/^bytes=\d+-\d*$/.test(range)) { cleanup(); return new Response(null, {status:416}); }
      headers.set('Range',range);
      const validator = request.headers.get('If-Range'); if (validator) headers.set('If-Range',validator);
    }
    const upstream = await fetch(target, { method: request.method === "HEAD" ? "HEAD" : "GET", headers, redirect, signal: controller.signal, cache: "no-store" });
    if (upstream.status === 206 && (!range || !/^bytes \d+-\d+\/\d+$/.test(upstream.headers.get('Content-Range')??''))) {
      await upstream.body?.cancel(); cleanup(); throw new Error('Invalid partial model response. Restart the download.');
    }
    if (!upstream.ok || request.method === "HEAD" || !upstream.body) {
      await upstream.body?.cancel();
      cleanup();
      return new Response(null, { status: upstream.status, headers: upstream.headers });
    }
    const reader = upstream.body.getReader();
    const hash=integrity&&!range?createHash('sha256'):undefined;
    const expected = Number(upstream.headers.get('Content-Length')), checkLength = upstream.headers.has('Content-Length') && !upstream.headers.has('Content-Encoding');
    let received = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(output) {
        arm();
        try {
          const { done, value } = await reader.read();
          clearTimeout(timer); // No idle clock while downstream backpressure pauses reads.
          if (done) { cleanup(); if(checkLength && received !== expected) output.error(new Error('Incomplete model download. Reconnect and retry.')); else if(hash && (received!==integrity!.bytes || hash.digest('hex')!==integrity!.sha256)) output.error(new Error('Model checksum verification failed. Reconnect and retry.')); else output.close(); }
          else { received += value.byteLength; hash?.update(value); if(checkLength && received > expected) { controller.abort(); cleanup(); output.error(new Error('Model download exceeded its declared length.')); } else output.enqueue(value); }
        } catch (error) { cleanup(); output.error(error); }
      },
      async cancel(reason) { controller.abort(); cleanup(); await reader.cancel(reason); },
    });
    clearTimeout(timer);
    return new Response(body, { status: upstream.status, headers: upstream.headers });
  } catch (error) { cleanup(); throw error; }
}

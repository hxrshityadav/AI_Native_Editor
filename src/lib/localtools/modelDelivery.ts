/** Bounded header/idle waits, rather than a total deadline on large public weights. */
export async function modelDownload(target: string, request: Request, timeoutMs = 30_000, redirect: RequestRedirect = "follow"): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = () => controller.abort();
  const arm = () => { clearTimeout(timer); timer = setTimeout(abort, timeoutMs); };
  const cleanup = () => { clearTimeout(timer); request.signal.removeEventListener("abort", abort); };
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  arm();
  try {
    const upstream = await fetch(target, { method: request.method === "HEAD" ? "HEAD" : "GET", redirect, signal: controller.signal, cache: "no-store" });
    if (!upstream.ok || request.method === "HEAD" || !upstream.body) {
      await upstream.body?.cancel();
      cleanup();
      return new Response(null, { status: upstream.status, headers: upstream.headers });
    }
    const reader = upstream.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(output) {
        arm();
        try {
          const { done, value } = await reader.read();
          clearTimeout(timer); // No idle clock while downstream backpressure pauses reads.
          if (done) { cleanup(); output.close(); }
          else output.enqueue(value);
        } catch (error) { cleanup(); output.error(error); }
      },
      async cancel(reason) { controller.abort(); cleanup(); await reader.cancel(reason); },
    });
    clearTimeout(timer);
    return new Response(body, { status: upstream.status, headers: upstream.headers });
  } catch (error) { cleanup(); throw error; }
}

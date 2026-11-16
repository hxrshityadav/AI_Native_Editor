import { afterEach, expect, it, vi } from "vitest";
import { modelDownload, modelRetry } from "../../src/lib/localtools/modelDelivery";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("uses upstream HEAD without downloading the decoder body", async () => {
  const fetch = vi.fn(async () => new Response(null, { headers: { "Content-Length": "244486683" } }));
  vi.stubGlobal("fetch", fetch);
  const response = await modelDownload("https://model.example/decoder", new Request("https://local.example/weight", { method: "HEAD" }));
  expect(fetch.mock.calls[0]).toEqual(["https://model.example/decoder", expect.objectContaining({ method: "HEAD" })]);
  expect(response.body).toBeNull(); expect(response.headers.get("Content-Length")).toBe("244486683");
});
it("aborts a stalled header request instead of waiting indefinitely", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))))));
  const result = modelDownload("https://model.example", new Request("https://local.example"), 100);
  const failure = expect(result).rejects.toThrow("aborted");
  await vi.advanceTimersByTimeAsync(101); await failure;
});
it("propagates downstream cancellation to the upstream body and request", async () => {
  const cancel = vi.fn(); let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => { signal = options.signal; return new Response(new ReadableStream({ pull(c) { c.enqueue(new Uint8Array([1, 2])); }, cancel })); }));
  const response = await modelDownload("https://model.example", new Request("https://local.example"));
  const reader = response.body!.getReader(); expect((await reader.read()).value).toEqual(new Uint8Array([1, 2]));
  await reader.cancel(); expect(cancel).toHaveBeenCalled(); expect(signal!.aborted).toBe(true);
});
it("streams and completes without retaining a timeout", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("weight")));
  const response = await modelDownload("https://model.example", new Request("https://local.example"));
  expect(await response.text()).toBe("weight"); expect(vi.getTimerCount()).toBe(0);
});
it("aborts a stalled stream read and releases its idle timer", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(async (_url, { signal }) => new Response(new ReadableStream({
    start(controller) { signal.addEventListener("abort", () => controller.error(new Error("idle timeout"))); },
  }))));
  const response = await modelDownload("https://model.example", new Request("https://local.example"), 100);
  const failure = expect(response.text()).rejects.toThrow("idle timeout");
  await vi.advanceTimersByTimeAsync(101); await failure; expect(vi.getTimerCount()).toBe(0);
});
it('forwards a single resume range and preserves a validated partial response', async () => {
  const fetch = vi.fn(async () => new Response('abc',{status:206,headers:{'Content-Range':'bytes 3-5/6','Content-Length':'3'}}));
  vi.stubGlobal('fetch',fetch);
  const response = await modelDownload('https://model.example',new Request('https://local.example',{headers:{Range:'bytes=3-','If-Range':'"revision"'}}));
  expect((fetch.mock.calls[0] as unknown as [string,RequestInit])[1].headers).toBeInstanceOf(Headers);
  expect(response.status).toBe(206); expect(await response.text()).toBe('abc');
});
it('rejects a truncated model body before it can be cached as complete', async () => {
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('short',{headers:{'Content-Length':'100'}})));
  const response = await modelDownload('https://model.example',new Request('https://local.example'));
  await expect(response.arrayBuffer()).rejects.toThrow('Incomplete');
});
it('rejects malformed partial responses and unsupported multi-ranges', async () => {
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('bad',{status:206})));
  await expect(modelDownload('https://model.example',new Request('https://local.example',{headers:{Range:'bytes=2-'}}))).rejects.toThrow('Invalid partial');
  expect((await modelDownload('https://model.example',new Request('https://local.example',{headers:{Range:'bytes=1-2,4-5'}}))).status).toBe(416);
});
it('verifies known weight hashes without accepting same-length corruption',async()=>{
  const integrity={bytes:3,sha256:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'};
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('abc',{headers:{'Content-Length':'3'}})));
  expect(await (await modelDownload('https://model.example',new Request('https://local.example'),30000,'follow',integrity)).text()).toBe('abc');
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('xyz',{headers:{'Content-Length':'3'}})));
  await expect((await modelDownload('https://model.example',new Request('https://local.example'),30000,'follow',integrity)).text()).rejects.toThrow('checksum');
});
it('backs off exponentially and cancels without leaving a delay timer',async()=>{
  vi.useFakeTimers(); const random=vi.spyOn(Math,'random').mockReturnValue(.5);
  try{
    const controller=new AbortController();let completed=false;
    const first=modelRetry(0,controller.signal).then(()=>{completed=true;});
    await vi.advanceTimersByTimeAsync(499);expect(completed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);await first;expect(completed).toBe(true);
    const pending=modelRetry(2,controller.signal),failure=expect(pending).rejects.toMatchObject({name:'AbortError'});
    controller.abort();await failure;expect(vi.getTimerCount()).toBe(0);
  }finally{random.mockRestore();}
});

import { afterEach, expect, it, vi } from "vitest";
import { modelDownload } from "../../src/lib/localtools/modelDelivery";
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

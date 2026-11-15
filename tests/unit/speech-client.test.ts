import { afterEach, expect, it, vi } from "vitest";
import { runSpeech } from "../../src/lib/localtools/speechClient";
import { runLocal } from "../../src/lib/localtools/client";

class WorkerFixture {
  static instances: WorkerFixture[] = [];
  onmessage?: (event: { data: unknown }) => void;
  onerror?: (event: { preventDefault: () => void }) => void;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor(readonly url?: string) { WorkerFixture.instances.push(this); }
}
afterEach(() => { vi.unstubAllGlobals(); WorkerFixture.instances = []; });
it("neural selection dispatches to its dedicated worker and cancellation terminates it", async () => {
  vi.stubGlobal("Worker", WorkerFixture);
  const controller = new AbortController();
  const job = runLocal({ kind: "noise", neural: true, file: new File(["fixture"], "test.wav") }, controller.signal, () => {}, () => {});
  const worker = WorkerFixture.instances[0];
  expect(worker.url).toBe("/local-ai/noise.worker.js");
  controller.abort();
  await expect(job).rejects.toMatchObject({ name: "AbortError" });
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it("cancellation terminates the actual job handle and ignores late completion", async () => {
  vi.stubGlobal("Worker", WorkerFixture);
  const controller = new AbortController();
  const job = runSpeech({ kind: "synthesize", text: "Hello" }, controller.signal, () => {});
  const worker = WorkerFixture.instances[0];
  controller.abort();
  await expect(job).rejects.toMatchObject({ name: "AbortError" });
  worker.onmessage?.({ data: { type: "done", result: { blob: new Blob(), duration: 0 } } });
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it("a worker crash releases the worker and allows an independent retry", async () => {
  vi.stubGlobal("Worker", WorkerFixture);
  const first = runSpeech({ kind: "synthesize", text: "Hello" }, new AbortController().signal, () => {});
  WorkerFixture.instances[0].onerror?.({ preventDefault() {} });
  await expect(first).rejects.toThrow(/worker failed/);
  const second = runSpeech({ kind: "synthesize", text: "Retry" }, new AbortController().signal, () => {});
  const result = { blob: new Blob(["fixture"]), duration: 1 };
  WorkerFixture.instances[1].onmessage?.({ data: { type: "done", result } });
  await expect(second).resolves.toBe(result);
  expect(WorkerFixture.instances.every(worker => worker.terminate.mock.calls.length === 1)).toBe(true);
});

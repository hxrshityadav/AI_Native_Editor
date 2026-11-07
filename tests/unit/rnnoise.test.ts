import { expect, it, vi } from "vitest";
import { suppressNoise, type RnnoiseRuntime } from "../../src/lib/localtools/rnnoise";

it("compensates a one-frame model delay, preserves duration/rate and destroys native allocations", () => {
  const heap = new Float32Array(2048), previous = new Float32Array(480);
  const runtime: RnnoiseRuntime = {
    HEAPF32: heap, _malloc: vi.fn().mockReturnValueOnce(1920).mockReturnValueOnce(3840), _free: vi.fn(),
    _rnnoise_create: () => 7, _rnnoise_destroy: vi.fn(),
    _rnnoise_process_frame: (_state, output, input) => {
      const next = heap.slice(input / 4, input / 4 + 480);
      heap.set(previous, output / 4); previous.set(next); return 1;
    },
  };
  const input = Float32Array.from({ length: 2000 }, (_, i) => Math.sin(i / 50) * .2);
  const output = suppressNoise(runtime, input, 16000, () => {});
  expect(output.length).toBe(input.length);
  expect(Math.max(...output.map((x, i) => Math.abs(x - input[i])))).toBeLessThan(1e-6);
  expect(runtime._free).toHaveBeenCalledTimes(2);
  expect(runtime._rnnoise_destroy).toHaveBeenCalledWith(7);
});
it("releases partial native allocations when memory is unavailable", () => {
  const free = vi.fn(), destroy = vi.fn();
  const runtime: RnnoiseRuntime = { HEAPF32: new Float32Array(), _malloc: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(8), _free: free, _rnnoise_create: () => 5, _rnnoise_destroy: destroy, _rnnoise_process_frame: () => 0 };
  expect(() => suppressNoise(runtime, new Float32Array(100), 48000, () => {})).toThrow(/memory/);
  expect(free).toHaveBeenCalledWith(8); expect(destroy).toHaveBeenCalledWith(5);
});

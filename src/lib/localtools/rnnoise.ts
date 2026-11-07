import { resampleMono } from "./dsp";

export interface RnnoiseRuntime {
  HEAPF32: Float32Array;
  _malloc(bytes: number): number;
  _free(pointer: number): void;
  _rnnoise_create(model: number): number;
  _rnnoise_destroy(state: number): void;
  _rnnoise_process_frame(state: number, output: number, input: number): number;
}

/** RNNoise v0.1: 480 samples at 48 kHz, signed-16-bit scale in float buffers, one-frame delay. */
export function suppressNoise(runtime: RnnoiseRuntime, channel: Float32Array, sampleRate: number, progress: (fraction: number) => void) {
  const rate = 48000, frame = 480;
  const input = resampleMono([channel], sampleRate, rate);
  const output = new Float32Array(input.length);
  const state = runtime._rnnoise_create(0), source = runtime._malloc(frame * 4), target = runtime._malloc(frame * 4);
  if (!state || !source || !target) {
    if (source) runtime._free(source); if (target) runtime._free(target); if (state) runtime._rnnoise_destroy(state);
    throw new Error("Not enough memory for neural cleanup. Try a shorter recording.");
  }
  try {
    // Flush the final frame and discard the measured 10 ms algorithmic delay.
    for (let start = 0; start < input.length + frame; start += frame) {
      for (let i = 0; i < frame; i++) runtime.HEAPF32[source / 4 + i] = (input[start + i] ?? 0) * 32768;
      runtime._rnnoise_process_frame(state, target, source);
      for (let i = 0; i < frame; i++) {
        const index = start + i - frame;
        if (index >= 0 && index < output.length) {
          const value = runtime.HEAPF32[target / 4 + i] / 32768;
          if (!Number.isFinite(value)) throw new Error("The noise model produced invalid audio. Try another recording.");
          output[index] = Math.max(-1, Math.min(1, value));
        }
      }
      if (start % (frame * 50) === 0) progress(Math.min(1, start / input.length));
    }
    const restored = resampleMono([output], rate, sampleRate), result = new Float32Array(channel.length);
    result.set(restored.subarray(0, result.length));
    progress(1);
    return result;
  } finally { runtime._free(source); runtime._free(target); runtime._rnnoise_destroy(state); }
}

import { readPcm } from "../../src/lib/localtools/audio";
import { wav } from "../../src/lib/localtools/dsp";
import { suppressNoise, type RnnoiseRuntime } from "../../src/lib/localtools/rnnoise";
import { replaceSoundtrack } from "../../src/lib/localtools/video";
import type { LocalRequest } from "../../src/lib/localtools/local.worker";

const scope = self as unknown as { onmessage: (event: MessageEvent<LocalRequest>) => void; postMessage: (message: unknown) => void };
const status = (value: string) => scope.postMessage({ type: "phase", value });
const progress = (value: number) => scope.postMessage({ type: "progress", value });
const HASH = "677147b9248aedc0a00de79dc090d1ecead37c08c8bb773a790da16109d2c487";
scope.onmessage = async ({ data }) => {
  try {
    if (data.kind !== "noise" || !data.neural) throw new Error("Choose neural noise cleanup and retry.");
    const { channels, sampleRate } = await readPcm(data.file, status);
    status("Loading local RNNoise runtime (about 122 KiB, cached by the browser)");
    let bytes: ArrayBuffer | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch("/local-ai/rnnoise-0.2.1.wasm", { cache: attempt ? "reload" : "default" });
      if (!response.ok) throw new Error("The neural runtime is unavailable. Reconnect and retry or use Light noise reduction.");
      const candidate = await response.arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", candidate)), x => x.toString(16).padStart(2, "0")).join("");
      if (hash === HASH) { bytes = candidate; break; }
    }
    if (!bytes) throw new Error("Neural runtime integrity check failed after retry. Reconnect or use Light noise reduction; keep your Studio storage.");
    const modulePath = "/local-ai/rnnoise-0.2.1.js";
    const { default: create } = await import(/* webpackIgnore: true */ modulePath) as { default: (options: { wasmBinary: ArrayBuffer; print: () => void; printErr: () => void }) => Promise<RnnoiseRuntime> };
    const runtime = await create({ wasmBinary: bytes, print() {}, printErr() {} });
    status("Suppressing noise with RNNoise locally");
    const cleaned = channels.map((channel, index) => suppressNoise(runtime, channel, sampleRate, value => progress((index + value) / channels.length)));
    const audio = wav(cleaned, sampleRate);
    if (data.preserveVideo) {
      status("Copying the picture and replacing its cleaned soundtrack");
      scope.postMessage({ type: "done", result: await replaceSoundtrack(data.file, audio, progress) });
    } else scope.postMessage({ type: "done", result: { blob: audio, extension: "wav" } });
  } catch (error) { scope.postMessage({ type: "error", message: error instanceof Error ? error.message : "Neural cleanup failed. Try a shorter recording or Light mode." }); }
};

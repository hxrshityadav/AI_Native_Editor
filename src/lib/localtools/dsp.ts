/** Small, deterministic audio helpers shared by the worker and generated-output tests. */
export function wav(channels: Float32Array[], sampleRate: number): Blob {
  if (!channels.length || channels.length > 2 || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000 || !channels[0].length || channels.some(channel => channel.length !== channels[0].length)) throw new Error("Invalid PCM audio.");
  const frames = channels[0].length, buffer = new ArrayBuffer(44 + frames * channels.length * 2), view = new DataView(buffer);
  const ascii = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  ascii(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); ascii(8, "WAVEfmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels.length, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels.length * 2, true); view.setUint16(32, channels.length * 2, true); view.setUint16(34, 16, true); ascii(36, "data"); view.setUint32(40, buffer.byteLength - 44, true);
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < channels.length; channel++) { const value = Math.max(-1, Math.min(1, channels[channel][frame])); view.setInt16(44 + (frame * channels.length + channel) * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true); }
  return new Blob([buffer], { type: "audio/wav" });
}

export function resampleMono(channels: Float32Array[], sourceRate: number, targetRate = 16000): Float32Array<ArrayBuffer> {
  const length = Math.floor(channels[0].length * targetRate / sourceRate), result = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    // Average the source interval when downsampling; interpolate when upsampling.
    const start = i * sourceRate / targetRate, end = Math.min(channels[0].length, (i + 1) * sourceRate / targetRate);
    let sum = 0, weight = 0;
    for (let j = Math.floor(start); j < Math.ceil(end); j++) { const fraction = Math.max(0, Math.min(end, j + 1) - Math.max(start, j)); for (const channel of channels) sum += channel[j] * fraction; weight += fraction * channels.length; }
    result[i] = weight ? sum / weight : 0;
  }
  return result;
}

/** Stereo centre/side cancellation. This is not neural stem separation. */
export function stereoStems(channels: Float32Array[]) {
  if (channels.length !== 2) throw new Error("This method needs true stereo audio. Mono cannot be separated by centre cancellation; choose another recording.");
  const centre = new Float32Array(channels[0].length), left = new Float32Array(centre.length);
  let sideEnergy = 0, energy = 0;
  for (let i = 0; i < centre.length; i++) { const a = channels[0][i], b = channels[1][i]; centre[i] = (a + b) / 2; left[i] = (a - b) / 2; sideEnergy += left[i] ** 2; energy += a * a + b * b; }
  if (sideEnergy < Math.max(1e-10, energy * 1e-6)) throw new Error("Both channels are effectively identical. Centre cancellation would remove almost everything; use a genuinely stereo mix.");
  // A single side channel remains audible on mono speakers; opposite stereo copies would cancel when downmixed.
  return { centre: [centre], sides: [left] };
}

function fft(real: Float64Array, imaginary: Float64Array, inverse = false) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [real[i], real[j]] = [real[j], real[i]]; [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]]; } }
  for (let size = 2; size <= n; size *= 2) { const angle = (inverse ? 2 : -2) * Math.PI / size; for (let start = 0; start < n; start += size) for (let j = 0; j < size / 2; j++) { const a = start + j, b = a + size / 2, cos = Math.cos(angle * j), sin = Math.sin(angle * j), r = real[b] * cos - imaginary[b] * sin, im = real[b] * sin + imaginary[b] * cos; real[b] = real[a] - r; imaginary[b] = imaginary[a] - im; real[a] += r; imaginary[a] += im; } }
  if (inverse) for (let i = 0; i < n; i++) { real[i] /= n; imaginary[i] /= n; }
}

/** Spectral subtraction from an explicitly selected noise-only opening, with overlap-add reconstruction. */
export function denoise(channel: Float32Array, sampleRate: number, noiseSeconds: number, strength: number, progress: (fraction: number) => void = () => {}) {
  if (!(noiseSeconds >= 0.1 && noiseSeconds <= 3 && noiseSeconds * sampleRate < channel.length) || !(strength >= 0.5 && strength <= 3)) throw new Error("Choose 0.1–3 seconds of opening noise, shorter than the recording, and strength 0.5–3.");
  const n = 1024, hop = 256, window = Float64Array.from({ length: n }, (_, i) => Math.sin(Math.PI * (i + 0.5) / n));
  const noise = new Float64Array(n), real = new Float64Array(n), imaginary = new Float64Array(n);
  const analyze = (start: number) => { imaginary.fill(0); for (let i = 0; i < n; i++) real[i] = (channel[start + i] ?? 0) * window[i]; fft(real, imaginary); };
  let profiles = 0;
  for (let start = 0; start + n <= noiseSeconds * sampleRate; start += hop) { analyze(start); for (let k = 0; k < n; k++) noise[k] += real[k] ** 2 + imaginary[k] ** 2; profiles++; }
  if (!profiles) { analyze(0); for (let k = 0; k < n; k++) noise[k] = real[k] ** 2 + imaginary[k] ** 2; profiles = 1; }
  for (let k = 0; k < n; k++) noise[k] /= profiles;
  const output = new Float32Array(channel.length), weights = new Float32Array(channel.length);
  for (let start = -n + hop; start < channel.length; start += hop) {
    analyze(start);
    for (let k = 0; k < n; k++) { const power = real[k] ** 2 + imaginary[k] ** 2, gain = Math.max(0.08, Math.sqrt(Math.max(0, power - strength * noise[k]) / Math.max(1e-20, power))); real[k] *= gain; imaginary[k] *= gain; }
    fft(real, imaginary, true);
    for (let i = 0; i < n; i++) { const index = start + i; if (index >= 0 && index < output.length) { output[index] += real[i] * window[i]; weights[index] += window[i] ** 2; } }
    if (start % (hop * 16) === 0) progress(Math.max(0, start / channel.length));
  }
  for (let i = 0; i < output.length; i++) output[i] = Math.max(-1, Math.min(1, output[i] / Math.max(1e-8, weights[i])));
  progress(1); return output;
}

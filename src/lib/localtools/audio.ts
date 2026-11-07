import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from "mediabunny";
import { inspectMedia } from "../mediatools/engine";
import { resampleMono } from "./dsp";

export const LOCAL_MAX_SECONDS = 120;
export async function readPcm(file: Blob, status: (message: string) => void = () => {}, maxSeconds: 120 | 600 = LOCAL_MAX_SECONDS, speechMono = false) {
  const info = await inspectMedia(file, "audio");
  if (info.duration > maxSeconds) throw new Error(`This local tool supports up to ${maxSeconds / 60} minutes per job to bound memory and model processing. Trim the file first.`);
  if (!info.audio || info.audio.channels > 2 || info.audio.sampleRate > 96000 || info.audio.sampleRate < 8000) throw new Error("Use mono or stereo audio at 8–96 kHz. Convert the recording first.");
  status("Decoding audio locally");
  const input = new Input({ source: new BlobSource(file, { maxCacheSize: 8 * 1024 * 1024 }), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack(); if (!track) throw new Error("No readable audio track.");
    const sourceRate = info.audio.sampleRate, sampleRate = speechMono ? 16000 : sourceRate, frames = Math.ceil(info.duration * sampleRate), channels = Array.from({ length: speechMono ? 1 : info.audio.channels }, () => new Float32Array(frames));
    for await (const sample of new AudioSampleSink(track).samples()) {
      try {
        if (sample.sampleRate !== sourceRate || sample.numberOfChannels !== info.audio.channels) throw new Error("Audio format changes inside this file. Convert it to WAV first.");
        const start = Math.round(sample.timestamp * sampleRate);
        const planes = Array.from({ length: info.audio.channels }, (_, channel) => { const plane = new Float32Array(sample.numberOfFrames); sample.copyTo(plane, { planeIndex: channel, format: "f32-planar" }); return plane; });
        const decoded = speechMono ? [resampleMono(planes, sourceRate, sampleRate)] : planes;
        for (let channel = 0; channel < channels.length; channel++) { const plane = decoded[channel], from = Math.max(0, -start), to = Math.min(plane.length, frames - start); if (to > from) channels[channel].set(plane.subarray(from, to), Math.max(0, start)); }
      } finally { sample.close(); }
    }
    return { channels, sampleRate, info };
  } finally { input.dispose(); }
}

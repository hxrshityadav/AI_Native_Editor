import { describe, expect, it } from "vitest";
import { isAudioOnlyOggOpus, oggOpusDurationSec } from "@/lib/transcription/sniff";
import { concat, oggOpusFile, oggPage, opusHead, opusTags, theoraHead } from "./oggFixtures";

describe("isAudioOnlyOggOpus", () => {
  it("accepts Ogg Opus", () => {
    expect(isAudioOnlyOggOpus(oggOpusFile())).toBe(true);
  });

  it("rejects Ogg with a muxed Theora video stream", () => {
    const bytes = concat(oggPage(opusHead, { bos: true, serial: 1 }), oggPage(theoraHead, { bos: true, serial: 2 }), oggPage(opusTags));
    expect(isAudioOnlyOggOpus(bytes)).toBe(false);
  });

  it("rejects Ogg Vorbis/other first streams", () => {
    expect(isAudioOnlyOggOpus(oggPage(new TextEncoder().encode("\x01vorbis-------"), { bos: true }))).toBe(false);
  });

  it("rejects MP4, WebM, empty and truncated input", () => {
    const mp4 = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);
    expect(isAudioOnlyOggOpus(mp4)).toBe(false);
    expect(isAudioOnlyOggOpus(webm)).toBe(false);
    expect(isAudioOnlyOggOpus(new Uint8Array())).toBe(false);
    expect(isAudioOnlyOggOpus(oggOpusFile().slice(0, 30))).toBe(false);
  });

  it("rejects an Ogg page without the BOS flag first", () => {
    expect(isAudioOnlyOggOpus(oggPage(opusHead, { bos: false }))).toBe(false);
  });
});

describe("oggOpusDurationSec", () => {
  /** Last page with the given granule position (48 kHz samples). */
  function withGranule(granule: number) {
    const last = oggPage(new Uint8Array(40));
    last[5] = 0x04;
    new DataView(last.buffer).setBigInt64(6, BigInt(granule), true);
    return concat(oggPage(opusHead, { bos: true }), oggPage(opusTags), last);
  }

  it("reads the duration from the last page, minus the pre-skip", () => {
    // The fixture's OpusHead pre-skip is 312 samples.
    expect(oggOpusDurationSec(withGranule(48_000 * 31 + 312))).toBe(31);
  });

  it("returns null for bytes that aren't Ogg Opus", () => {
    expect(oggOpusDurationSec(new Uint8Array(100))).toBeNull();
  });
});

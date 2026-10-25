import { describe, expect, it } from "vitest";
import { discardOpusPadding } from "@/lib/media/opusPadding";
import { oggOpusDurationSec } from "@/lib/transcription/sniff";
import { oggOpusFile } from "./oggFixtures";

describe("Opus encoder tail padding", () => {
  it("keeps a 600-second source within the strict API boundary and updates the EOS checksum", () => {
    const bytes = oggOpusFile();
    const eos = bytes.length - 68;
    const view = new DataView(bytes.buffer);
    view.setBigInt64(eos + 6, BigInt(600 * 48_000 + 312 + 648), true);
    discardOpusPadding(bytes.buffer as ArrayBuffer, 600);
    expect(oggOpusDurationSec(bytes)).toBe(600);
    const crc = view.getUint32(eos + 22, true);
    expect(crc).not.toBe(0);
    // Reapplying the correction must leave both the granule and checksum unchanged.
    const again = bytes.slice();
    discardOpusPadding(again.buffer, 600);
    expect(again).toEqual(bytes);
  });
  it("does not extend shorter audio or change its bytes", () => {
    const bytes = oggOpusFile();
    const before = bytes.slice();
    discardOpusPadding(bytes.buffer as ArrayBuffer, 600);
    expect(bytes).toEqual(before);
    expect(oggOpusDurationSec(bytes)).toBe(1);
  });
});

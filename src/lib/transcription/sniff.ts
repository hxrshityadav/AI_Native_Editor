const OGGS = [0x4f, 0x67, 0x67, 0x53];
const OPUS_HEAD = [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64];
const BOS_FLAG = 0x02;

/**
 * True only for an Ogg stream whose logical streams are all Opus audio.
 *
 * Ogg places every stream's beginning-of-stream (BOS) page first, so walking
 * the leading BOS pages and requiring each to carry an OpusHead rejects video
 * (Theora, VP8) or other payloads muxed into the same file. The declared
 * Content-Type is ignored; only the bytes count.
 */
export function isAudioOnlyOggOpus(bytes: Uint8Array): boolean {
  let offset = 0;
  let streams = 0;
  while (offset + 27 <= bytes.length && startsWith(bytes, offset, OGGS)) {
    const headerType = bytes[offset + 5];
    if ((headerType & BOS_FLAG) === 0) break;
    const segments = bytes[offset + 26];
    const payloadStart = offset + 27 + segments;
    if (payloadStart > bytes.length) return false;
    let payloadLength = 0;
    for (let i = 0; i < segments; i++) payloadLength += bytes[offset + 27 + i];
    if (!startsWith(bytes, payloadStart, OPUS_HEAD)) return false;
    streams += 1;
    offset = payloadStart + payloadLength;
  }
  return streams > 0;
}

function startsWith(bytes: Uint8Array, offset: number, magic: number[]): boolean {
  if (offset + magic.length > bytes.length) return false;
  for (let i = 0; i < magic.length; i++) if (bytes[offset + i] !== magic[i]) return false;
  return true;
}

/**
 * Duration of an Ogg Opus file in seconds, from the last page's granule position (48 kHz samples)
 * minus the OpusHead pre-skip. Null when the bytes don't allow it.
 */
export function oggOpusDurationSec(bytes: Uint8Array): number | null {
  if (bytes.length < 47 || !startsWith(bytes, 0, OGGS)) return null;
  const headStart = 27 + bytes[26];
  if (!startsWith(bytes, headStart, OPUS_HEAD) || headStart + 12 > bytes.length) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const preSkip = view.getUint16(headStart + 10, true);
  const serial = view.getUint32(14, true);
  let offset = 0;
  while (offset + 27 <= bytes.length) {
    if (!startsWith(bytes, offset, OGGS) || bytes[offset + 4] !== 0 || view.getUint32(offset + 14, true) !== serial) return null;
    if (offset > 0 && (bytes[offset + 5] & BOS_FLAG)) return null; // no chained streams
    const count = bytes[offset + 26];
    const payload = offset + 27 + count;
    if (payload > bytes.length) return null;
    let end = payload;
    for (let i = 0; i < count; i++) end += bytes[offset + 27 + i];
    if (end > bytes.length) return null;
    if (bytes[offset + 5] & 0x04) {
      const granule = view.getBigInt64(offset + 6, true);
      if (end !== bytes.length || granule <= BigInt(preSkip)) return null;
      return (Number(granule) - preSkip) / 48_000;
    }
    offset = end;
  }
  return null;
}

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

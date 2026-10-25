/** Discard encoder tail padding using Opus's EOS granule, without dropping speech packets.
 * Only called on our own Mediabunny output, after the source duration has been validated.
 */
export function discardOpusPadding(buffer: ArrayBuffer, duration: number): void {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const head = 27 + bytes[26];
  const preSkip = view.getUint16(head + 10, true);
  const endGranule = BigInt(Math.round(duration * 48_000) + preSkip);
  let offset = 0;
  while (offset + 27 <= bytes.length) {
    const count = bytes[offset + 26];
    let end = offset + 27 + count;
    for (let i = 0; i < count; i++) end += bytes[offset + 27 + i];
    if (end > bytes.length) throw new Error("Incomplete extracted audio page.");
    if ((bytes[offset + 5] & 0x04) && view.getBigInt64(offset + 6, true) > endGranule) {
      view.setBigInt64(offset + 6, endGranule, true);
      view.setUint32(offset + 22, 0, true);
      let crc = 0;
      for (let i = offset; i < end; i++) {
        crc ^= bytes[i] << 24;
        for (let bit = 0; bit < 8; bit++) crc = (crc << 1) ^ (crc & 0x80000000 ? 0x04c11db7 : 0);
      }
      view.setUint32(offset + 22, crc >>> 0, true);
    }
    offset = end;
  }
}

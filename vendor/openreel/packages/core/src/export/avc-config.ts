/** Firefox can duplicate NAL headers in avcC while emitting valid video packets. */
export function normalizeAvcConfig(description: AllowSharedBufferSource): AllowSharedBufferSource {
  const bytes = ArrayBuffer.isView(description)
    ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength)
    : new Uint8Array(description);
  // Match the observed malformed descriptor only; valid encoder output is untouched.
  if (bytes.length < 12 || bytes[0] !== 1 || (bytes[4] & 0xfc) !== 0 || (bytes[5] & 0xe0) !== 0
    || bytes[8] !== 0x67 || bytes[9] !== 0x67 || bytes[10] !== bytes[1]) return description;
  const result = [...bytes.subarray(0, 6)];
  result[4] |= 0xfc;
  result[5] |= 0xe0;
  let offset = 6;
  const parameterSets = (count: number, header: number) => {
    for (let i = 0; i < count; i++) {
      if (offset + 2 > bytes.length) throw new Error("Invalid H.264 configuration. Choose VP9 / WebM or another browser.");
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      offset += 2;
      if (length < 2 || offset + length > bytes.length || bytes[offset] !== header || bytes[offset + 1] !== header) throw new Error("Invalid H.264 parameter set. Choose VP9 / WebM or another browser.");
      result.push((length - 1) >> 8, (length - 1) & 255, ...bytes.subarray(offset + 1, offset + length));
      offset += length;
    }
  };
  parameterSets(bytes[5] & 31, 0x67);
  if (offset >= bytes.length) throw new Error("Missing H.264 configuration. Choose VP9 / WebM or another browser.");
  const pictures = bytes[offset++]; result.push(pictures);
  parameterSets(pictures, 0x68);
  result.push(...bytes.subarray(offset));
  return Uint8Array.from(result);
}

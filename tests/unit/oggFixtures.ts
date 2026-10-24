/** Builds a minimal single-segment Ogg page. CRC is left zero; the sniffer doesn't check it. */
export function oggPage(payload: Uint8Array, opts: { bos?: boolean; serial?: number } = {}): Uint8Array {
  if (payload.length > 255) throw new Error("payload too long for a single-segment page");
  const header = new Uint8Array(28);
  header.set([0x4f, 0x67, 0x67, 0x53]); // "OggS"
  header[4] = 0; // version
  header[5] = opts.bos ? 0x02 : 0x00;
  new DataView(header.buffer).setUint32(14, opts.serial ?? 1, true);
  header[26] = 1; // one segment
  header[27] = payload.length;
  const page = new Uint8Array(header.length + payload.length);
  page.set(header);
  page.set(payload, header.length);
  return page;
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const ascii = (s: string) => new TextEncoder().encode(s);

export const opusHead = concat(ascii("OpusHead"), new Uint8Array([1, 1, 0x38, 0x01, 0x80, 0xbb, 0, 0, 0, 0, 0]));
export const opusTags = concat(ascii("OpusTags"), new Uint8Array(8));
export const theoraHead = concat(new Uint8Array([0x80]), ascii("theora"), new Uint8Array(20));

/** A valid-looking audio-only Ogg Opus file header. */
export function oggOpusFile(): Uint8Array {
  return concat(oggPage(opusHead, { bos: true }), oggPage(opusTags), oggPage(new Uint8Array(40)));
}

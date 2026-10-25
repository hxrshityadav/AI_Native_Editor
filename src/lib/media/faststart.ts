/**
 * "Fast start": move an MP4's `moov` box from the end of the file to just after `ftyp`, as
 * YouTube's upload guidelines recommend. This is the same operation as ffmpeg's qt-faststart:
 * every chunk offset (stco/co64) grows by the size of the moved box. The media data is streamed,
 * so memory stays at the size of `moov` (well under a few MB) whatever the video length.
 */

export type TopBox = { type: string; start: number; size: number };

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf", "udta", "mvex"]);

/** Lists the top-level boxes by reading only their headers. */
export async function readTopBoxes(file: Blob): Promise<TopBox[]> {
  const boxes: TopBox[] = [];
  let pos = 0;
  while (pos + 8 <= file.size) {
    const head = new DataView(await file.slice(pos, pos + 16).arrayBuffer());
    let size = head.getUint32(0);
    const type = String.fromCharCode(head.getUint8(4), head.getUint8(5), head.getUint8(6), head.getUint8(7));
    if (size === 1) size = Number(head.getBigUint64(8));
    else if (size === 0) size = file.size - pos;
    if (size < 8 || pos + size > file.size) throw new Error(`Malformed MP4 box "${type}" at ${pos}.`);
    boxes.push({ type, start: pos, size });
    pos += size;
  }
  return boxes;
}

/** Returns a copy of `moov` with every chunk offset increased by `delta`. Throws if a 32-bit offset would overflow. */
export function shiftChunkOffsets(moov: Uint8Array, delta: number): Uint8Array {
  const out = moov.slice();
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);

  const walk = (start: number, end: number) => {
    let pos = start;
    while (pos + 8 <= end) {
      let size = view.getUint32(pos);
      const type = String.fromCharCode(out[pos + 4], out[pos + 5], out[pos + 6], out[pos + 7]);
      let header = 8;
      if (size === 1) {
        size = Number(view.getBigUint64(pos + 8));
        header = 16;
      } else if (size === 0) size = end - pos;
      if (size < header || pos + size > end) throw new Error(`Malformed "${type}" box inside moov.`);

      if (CONTAINERS.has(type)) walk(pos + header, pos + size);
      else if (type === "stco" || type === "co64") {
        const count = view.getUint32(pos + header + 4);
        let entry = pos + header + 8;
        for (let i = 0; i < count; i++) {
          if (type === "stco") {
            const shifted = view.getUint32(entry) + delta;
            if (shifted > 0xffffffff) throw new Error("Chunk offset overflow; keeping moov at the end.");
            view.setUint32(entry, shifted);
            entry += 4;
          } else {
            view.setBigUint64(entry, view.getBigUint64(entry) + BigInt(delta));
            entry += 8;
          }
        }
      }
      pos += size;
    }
  };
  walk(8, out.byteLength);
  return out;
}

type Writable = { write(data: Uint8Array): Promise<void> };

/**
 * Writes `file` to `out` with `moov` moved after `ftyp`. Returns false, writing nothing, when the
 * file is already fast-start or isn't laid out as ftyp…mdat…moov, so the caller keeps the original.
 */
export async function moveMoovToFront(file: Blob, out: Writable, chunkBytes = 4 << 20): Promise<boolean> {
  const boxes = await readTopBoxes(file);
  const ftyp = boxes.findIndex((b) => b.type === "ftyp");
  const moov = boxes.findIndex((b) => b.type === "moov");
  const mdat = boxes.findIndex((b) => b.type === "mdat");
  if (ftyp !== 0 || moov < 0 || mdat < 0 || moov < mdat) return false;

  const moovBox = boxes[moov];
  const patched = shiftChunkOffsets(
    new Uint8Array(await file.slice(moovBox.start, moovBox.start + moovBox.size).arrayBuffer()),
    moovBox.size,
  );

  await out.write(new Uint8Array(await file.slice(0, boxes[0].size).arrayBuffer()));
  await out.write(patched);
  // Everything between ftyp and moov (mdat, free, …), copied in chunks.
  for (let pos = boxes[0].size; pos < moovBox.start; pos += chunkBytes) {
    await out.write(new Uint8Array(await file.slice(pos, Math.min(pos + chunkBytes, moovBox.start)).arrayBuffer()));
  }
  // Anything after moov (rare: udta, free) keeps its relative order.
  if (moovBox.start + moovBox.size < file.size) {
    await out.write(new Uint8Array(await file.slice(moovBox.start + moovBox.size).arrayBuffer()));
  }
  return true;
}

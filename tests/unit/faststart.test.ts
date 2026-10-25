import { describe, expect, it } from "vitest";
import { moveMoovToFront, readTopBoxes, shiftChunkOffsets } from "@/lib/media/faststart";

/** Builds a box: 32-bit size + 4-char type + payload. */
function box(type: string, ...payload: Uint8Array[]): Uint8Array {
  const body = concat(...payload);
  const out = new Uint8Array(8 + body.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(body, 8);
  return out;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
const u32 = (...values: number[]) => {
  const out = new Uint8Array(values.length * 4);
  values.forEach((v, i) => new DataView(out.buffer).setUint32(i * 4, v));
  return out;
};
const u64 = (v: bigint) => {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, v);
  return out;
};
const stco = (...offsets: number[]) => box("stco", u32(0, offsets.length, ...offsets));
const co64 = (offset: bigint) => box("co64", u32(0, 1), u64(offset));
const moovWith = (...tables: Uint8Array[]) =>
  box("moov", box("mvhd", new Uint8Array(20)), box("trak", box("mdia", box("minf", box("stbl", ...tables)))));

/** Minimal in-memory writable. */
function sink() {
  const parts: Uint8Array[] = [];
  return { parts, write: async (d: Uint8Array) => void parts.push(d.slice()), bytes: () => concat(...parts) };
}

describe("faststart", () => {
  const ftyp = box("ftyp", new TextEncoder().encode("isom"), u32(0));
  const media = new Uint8Array(1000).map((_, i) => i % 251);
  const mdat = box("mdat", media);
  // Chunk offsets point into mdat's payload, as a real muxer writes them.
  const firstChunk = ftyp.length + 8;
  const moov = moovWith(stco(firstChunk, firstChunk + 400), co64(BigInt(firstChunk + 800)));
  const file = new Blob([ftyp, mdat, moov] as BlobPart[]);

  it("lists top-level boxes", async () => {
    expect((await readTopBoxes(file)).map((b) => b.type)).toEqual(["ftyp", "mdat", "moov"]);
  });

  it("moves moov after ftyp and shifts every chunk offset by the moov size", async () => {
    const out = sink();
    expect(await moveMoovToFront(file, out, 64)).toBe(true);
    const result = out.bytes();
    const boxes = await readTopBoxes(new Blob([result as BlobPart]));
    expect(boxes.map((b) => b.type)).toEqual(["ftyp", "moov", "mdat"]);
    expect(result.length).toBe(file.size);

    // The new offsets must point at the same media bytes as before.
    const shifted = firstChunk + moov.length;
    expect(result.slice(shifted, shifted + 16)).toEqual(media.slice(0, 16));
    const patchedMoov = result.slice(boxes[1].start, boxes[1].start + boxes[1].size);
    const expected = moovWith(stco(shifted, shifted + 400), co64(BigInt(shifted + 800)));
    expect(patchedMoov).toEqual(expected);
  });

  it("leaves a file alone when it is already fast-start", async () => {
    const fast = new Blob([ftyp, moov, mdat] as BlobPart[]);
    const out = sink();
    expect(await moveMoovToFront(fast, out)).toBe(false);
    expect(out.parts).toHaveLength(0);
  });

  it("refuses to overflow 32-bit chunk offsets", () => {
    expect(() => shiftChunkOffsets(moovWith(stco(0xfffffff0)), 0x100)).toThrow(/overflow/);
  });

  it("rejects malformed boxes", async () => {
    const broken = new Uint8Array(ftyp);
    new DataView(broken.buffer).setUint32(0, 9999);
    await expect(readTopBoxes(new Blob([broken as BlobPart]))).rejects.toThrow(/Malformed/);
  });
});

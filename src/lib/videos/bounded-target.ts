import { VIDEO_LIMITS } from "./policy";
/** Bounded encoded-byte pages support muxer seeks without allocating an entire decoded movie. */
export class BoundedVideoBytes {
  private readonly pages = new Map<number, Uint8Array<ArrayBuffer>>();
  private size = 0;
  private readonly pageSize = 1024 * 1024;
  constructor(private readonly limit: number = VIDEO_LIMITS.outputBytes) {}
  write(data: Uint8Array, position: number) {
    if (!Number.isSafeInteger(position) || position < 0 || position + data.length > this.limit) throw new Error("The encoded output exceeds its 128 MiB memory limit. Choose a lower resolution or bitrate and try again.");
    let offset = 0;
    while (offset < data.length) {
      const index = Math.floor((position + offset) / this.pageSize), start = (position + offset) % this.pageSize;
      let page = this.pages.get(index);
      if (!page) { page = new Uint8Array(Math.min(this.pageSize, this.limit - index * this.pageSize)); this.pages.set(index, page); }
      const count = Math.min(data.length - offset, page.length - start);
      page.set(data.subarray(offset, offset + count), start); offset += count;
    }
    this.size = Math.max(this.size, position + data.length);
  }
  blob(type: string): Blob {
    const parts: Uint8Array<ArrayBuffer>[] = [];
    for (let offset = 0; offset < this.size; offset += this.pageSize) parts.push((this.pages.get(offset / this.pageSize) ?? new Uint8Array(Math.min(this.pageSize, this.size - offset))).subarray(0, Math.min(this.pageSize, this.size - offset)));
    return new Blob(parts, { type });
  }
  clear() { this.pages.clear(); this.size = 0; }
}

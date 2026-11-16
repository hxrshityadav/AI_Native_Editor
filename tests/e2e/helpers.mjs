// Shared helpers for the E2E suites: ffmpeg fixtures, a production Next server, ffprobe, checks.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Records PASS/FAIL lines; `finish()` prints the total and exits non-zero on any failure. */
export function createChecks() {
  const results = [];
  return {
    check(name, ok, detail = "") {
      results.push({ name, ok });
      console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
    },
    finish() {
      const failed = results.filter((r) => !r.ok);
      console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
      process.exit(failed.length ? 1 : 0);
    },
  };
}

export function ff(...args) {
  mediaExec("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
}

/** Retry only an OS-cancelled media subprocess, never a format/content failure. */
export function mediaExec(command,args,options={}) {
  for(let attempt=0;attempt<2;attempt++){
    try{return execFileSync(command,args,{...options,windowsHide:true});}
    catch(error){
      if(attempt || error.status !== 0xC000013A)throw error;
      console.warn('Media subprocess interrupted by Windows (0xC000013A); retrying once.');
    }
  }
}
export function mediaSpawn(command,args,options={}) {
  for(let attempt=0;attempt<2;attempt++){
    const result=spawnSync(command,args,{...options,windowsHide:true});
    if(attempt || result.status !== 0xC000013A)return result;
    console.warn('Media subprocess interrupted by Windows (0xC000013A); retrying once.');
  }
}
export function probe(file) { return JSON.parse(mediaExec('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',file]).toString()); }

/** Generates every fixture into `dir` and returns a path helper. */
export function makeFixtures(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const f = (name) => join(dir, name);
  const bg = "color=c=0x2a4d69:s=720x1280:r=30:d=4";
  const tone = "sine=frequency=440:sample_rate=48000:duration=4";

  ff("-f", "lavfi", "-i", bg, "-f", "lavfi", "-i", tone, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", f("vertical.mp4"));
  ff("-f", "lavfi", "-i", "color=c=0x2a4d69:s=1280x720:r=30:d=3", "-f", "lavfi", "-i", tone, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", f("landscape.mp4"));
  ff("-display_rotation", "90", "-i", f("landscape.mp4"), "-c", "copy", f("rotated.mp4"));
  ff("-f", "lavfi", "-i", "color=c=0x2a4d69:s=540x960:r=30:d=3", "-f", "lavfi", "-i", tone, "-c:v", "libvpx-vp9", "-b:v", "500k", "-c:a", "libopus", "-shortest", f("vp9-opus.webm"));
  ff("-f", "lavfi", "-i", bg, "-c:v", "libx264", "-pix_fmt", "yuv420p", f("no-audio.mp4"));
  ff("-f", "lavfi", "-i", "color=c=0x2a4d69:s=1080x1920:r=30:d=2", "-f", "lavfi", "-i", tone, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", f("vertical-1080.mp4"));
  // HDR (PQ, BT.2020, 10-bit), as phones record by default, and HEVC, which many Android phones use.
  ff("-f", "lavfi", "-i", "color=c=0x2a4d69:s=540x960:r=30:d=2", "-f", "lavfi", "-i", tone, "-c:v", "libvpx-vp9", "-profile:v", "2", "-pix_fmt", "yuv420p10le", "-color_primaries", "bt2020", "-color_trc", "smpte2084", "-colorspace", "bt2020nc", "-b:v", "500k", "-c:a", "libopus", "-shortest", f("hdr.webm"));
  ff("-f", "lavfi", "-i", "color=c=0x2a4d69:s=540x960:r=30:d=2", "-f", "lavfi", "-i", tone, "-c:v", "libx265", "-x265-params", "log-level=error", "-tag:v", "hvc1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", f("hevc.mp4"));
  ff("-f", "lavfi", "-i", tone, "-c:a", "aac", f("audio-only.m4a"));
  writeFileSync(f("garbage.mp4"), Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 7919) % 256)));
  return f;
}


/** Starts `next start` (or `next dev` with `dev: true`) on `port`, with optional extra environment variables. */
export async function startServer(port, { env: extra = {}, dev = false } = {}) {
  if (process.env.REEL_E2E_PORT) {
    if (dev || port !== Number(process.env.REEL_E2E_PORT)) throw new Error('Suite must use the owned production server port');
    if (!(await fetch(`http://localhost:${port}/`)).ok) throw new Error('Shared test server is not ready');
    for (const [key, value] of Object.entries(extra)) if (process.env[key] !== value) throw new Error(`Shared server environment mismatch: ${key}`);
    return { shared: true };
  }
  const env = { ...process.env, PORT: String(port), ...extra };
  const server = spawn(process.execPath, [join(ROOT, "node_modules/next/dist/bin/next"), ...(dev ? ["dev", "--webpack"] : ["start"]), "-p", String(port)], {
    cwd: ROOT,
    env,
    stdio: "pipe",
    detached: true, windowsHide: true, // own process group, so stopServer() also kills next-server children
  });
  server.stderr.on("data", (d) => process.stderr.write(d));
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/`)).ok) return server;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  stopServer(server);
  throw new Error("next start did not become ready. Did you run `npm run build`?");
}

export function stopServer(server) {
  if (server.shared) return;
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-server.pid, "SIGTERM");
  } catch {}
}


export async function download(page, testId, dest) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId(testId).click()]);
  await dl.saveAs(dest);
  return dest;
}


/** Mean absolute luma difference between two files' frames at time t, within a horizontal band. */
export function frameDiff(a, b, t, width, height, bandTop, bandBottom) {
  const gray = (file) =>
    mediaExec("ffmpeg", ["-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 64 << 20 });
  const ga = gray(a);
  const gb = gray(b);
  let sum = 0;
  let n = 0;
  for (let y = Math.floor(height * bandTop); y < Math.floor(height * bandBottom); y++) {
    for (let x = 0; x < width; x++) {
      sum += Math.abs(ga[y * width + x] - gb[y * width + x]);
      n++;
    }
  }
  return sum / n;
}

/** Counts pixels in a horizontal band of the frame at time t whose RGB matches `match`. */
export function countPixels(file, t, width, height, bandTop, bandBottom, match) {
  const rgb = mediaExec("ffmpeg", ["-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 64 << 20 });
  let n = 0;
  for (let y = Math.floor(height * bandTop); y < Math.floor(height * bandBottom); y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      if (match(rgb[i], rgb[i + 1], rgb[i + 2])) n++;
    }
  }
  return n;
}

export const streams = (info, type) => info.streams.filter((s) => s.codec_type === type);

/** Top-level MP4 box types in file order (fast start means moov comes before mdat). */
export function topLevelBoxes(file) {
  const buf = readFileSync(file);
  const types = [];
  for (let pos = 0; pos + 8 <= buf.length; ) {
    let size = buf.readUInt32BE(pos);
    if (size === 1) size = Number(buf.readBigUInt64BE(pos + 8));
    else if (size === 0) size = buf.length - pos;
    types.push(buf.toString("latin1", pos + 4, pos + 8));
    pos += size;
  }
  return types;
}

/** Decodes every frame and sample; returns ffmpeg's error output (empty when the file is clean). */
export function decodeErrors(file) {
  // Keep sub-frame cut timestamps: the null muxer's default 1/fps clock merges distinct frames.
  const result = mediaSpawn("ffmpeg", ["-v", "error", "-i", file, "-enc_time_base:v", "1:1000000", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] });
  return result.stderr?.toString() || result.error?.message || (result.status !== 0 ? `Decoder exited ${result.status}` : "");
}

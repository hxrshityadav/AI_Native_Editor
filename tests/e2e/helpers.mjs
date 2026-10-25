// Shared helpers for the E2E suites: ffmpeg fixtures, a production Next server, ffprobe, checks.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = new URL("../..", import.meta.url).pathname;

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
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
}

export function probe(file) {
  return JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]).toString(),
  );
}

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


/**
 * Starts `next start` on `port`. By default without a Groq key, so the real route reports
 * NOT_CONFIGURED and tests never make billable calls. An empty value is used instead of deleting
 * the variable: Next.js doesn't override variables that are already set, so a developer's
 * .env.local key can't leak in. Pass `{ withKey: true }` to use the key from the env or .env.local.
 */
/**
 * Starts `next start`. Keys and abuse-control settings are blanked so a developer's .env.local
 * can't switch them on (or make billable calls); pass `withKey` or `env` to set them.
 */
export async function startServer(port, { withKey = false, env: extra = {} } = {}) {
  const env = { ...process.env, PORT: String(port) };
  if (!withKey) env.GROQ_API_KEY = "";
  for (const k of ["DATABASE_URL", "TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY", "VERCEL"]) env[k] = "";
  Object.assign(env, extra);
  const server = spawn(join(ROOT, "node_modules/.bin/next"), ["start", "-p", String(port)], {
    cwd: ROOT,
    env,
    stdio: "pipe",
    detached: true, // own process group, so stopServer() also kills next-server children
  });
  server.stderr.on("data", (d) => process.stderr.write(d));
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/lab`)).ok) return server;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  stopServer(server);
  throw new Error("next start did not become ready. Did you run `npm run build`?");
}

export function stopServer(server) {
  try {
    process.kill(-server.pid, "SIGTERM");
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
    execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 64 << 20 });
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
  const rgb = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 64 << 20 });
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
  try {
    execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] });
    return "";
  } catch (err) {
    return String(err.stderr || err.message);
  }
}

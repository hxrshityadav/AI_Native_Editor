// Prints the gzip size of the JavaScript each prerendered public route loads. Needs a fresh `npm run build`.
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", ".next");
const routes = ["index", "tools", "tools/image-compressor", "tools/image-resizer", "tools/image-converter", "tools/video-compressor", "privacy", "studio"];
const cache = new Map();
const gzip = (file) => cache.get(file) ?? cache.set(file, gzipSync(readFileSync(file)).length).get(file);
for (const route of routes) {
  const html = join(root, "server/app", `${route}.html`);
  if (!existsSync(html)) { console.log(`${route}: not prerendered`); continue; }
  const scripts = [...new Set([...readFileSync(html, "utf8").matchAll(/\/_next\/(static\/[^"']+?\.js)/g)].map(match => match[1]))];
  const total = scripts.reduce((sum, src) => sum + gzip(join(root, src)), 0);
  const icons = scripts.filter(src => readFileSync(join(root, src), "utf8").includes("lucide lucide-")).reduce((sum, src) => sum + gzip(join(root, src)), 0);
  console.log(`/${route === "index" ? "" : route}: ${(total / 1024).toFixed(1)} KiB gzip JS in ${scripts.length} files${icons ? ` (chunks containing lucide icons: ${(icons / 1024).toFixed(1)} KiB)` : ""}`);
}

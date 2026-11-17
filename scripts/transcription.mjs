// Compile TypeScript with the existing isolated toolchain; no runtime TS loader or new dependency.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const root=join(import.meta.dirname,".."),require=createRequire(join(root,"tools/transformers/package.json")),out=join(root,"output/transcription-evaluation/cli.mjs");
mkdirSync(join(root,"output/transcription-evaluation"),{recursive:true});
require("esbuild").buildSync({entryPoints:[join(root,"scripts/transcription/cli.ts")],outfile:out,bundle:true,platform:"node",format:"esm",packages:"external"});
await import(pathToFileURL(out).href);

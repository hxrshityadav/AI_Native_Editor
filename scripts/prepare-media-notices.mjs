import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dependency = join(root, "node_modules/mediabunny");
const output = join(root, "public/media-notices");
const pkg = JSON.parse(readFileSync(join(dependency, "package.json"), "utf8"));
mkdirSync(output, { recursive: true });
cpSync(join(dependency, "LICENSE"), join(output, "MEDIABUNNY-LICENSE.txt"));
cpSync(join(dependency, "src"), join(output, "mediabunny-source"), { recursive: true });
writeFileSync(join(output, "SOURCES.txt"), `This application uses unmodified Mediabunny ${pkg.version}, licensed under MPL-2.0.\nLicense: /media-notices/MEDIABUNNY-LICENSE.txt\nSource files: /media-notices/mediabunny-source/index.ts and accompanying files.\nUpstream: https://github.com/Vanilagy/mediabunny\nThese local source files match the installed runtime used by the standalone browser tools.\n`);

// Background Remover runtime: ONNX Runtime Web's WebAssembly binary, served from /ort/ and loaded only when a user removes a background.
const ort = join(root, "tools/ort/node_modules/onnxruntime-web"), ortOutput = join(root, "public/ort");
const ortPkg = JSON.parse(readFileSync(join(ort, "package.json"), "utf8"));
mkdirSync(ortOutput, { recursive: true });
cpSync(join(ort, "dist/ort-wasm-simd-threaded.wasm"), join(ortOutput, "ort-wasm-simd-threaded.wasm"));

// Notices for the other browser-side media components.
const heifPkg = JSON.parse(readFileSync(join(root, "node_modules/libheif-js/package.json"), "utf8"));
cpSync(join(root, "node_modules/libheif-js/LICENSE"), join(output, "LIBHEIF-LICENSE.txt"));
cpSync(join(root, "node_modules/typescript/LICENSE.txt"), join(output, "APACHE-2.0.txt"));
writeFileSync(join(output, "ONNXRUNTIME-LICENSE.txt"), `MIT License\n\nCopyright (c) Microsoft Corporation\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n`);
writeFileSync(join(output, "SOURCES.txt"), readFileSync(join(output, "SOURCES.txt"), "utf8") + `
HEIC to JPG uses unmodified libheif-js ${heifPkg.version} (an Emscripten build of libheif), licensed under LGPL-3.0: /media-notices/LIBHEIF-LICENSE.txt.
It is loaded as a separate script only when converting. Source: https://github.com/catdad-experiments/libheif-js/tree/v${heifPkg.version} (build script naming the exact libheif release) and https://github.com/strukturag/libheif.

Background Remover uses unmodified onnxruntime-web ${ortPkg.version} (MIT): /media-notices/ONNXRUNTIME-LICENSE.txt. Upstream: https://github.com/microsoft/onnxruntime
and the U²-Net-p salient object detection model (u2netp.onnx), Apache-2.0: /media-notices/APACHE-2.0.txt. Model: Qin et al., U²-Net, https://github.com/xuebinqin/U-2-Net. ONNX export as published by https://github.com/danielgatis/rembg (MIT), file SHA-256 309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8.

Workflow illustrations are rendered from adapted Stageshow 1.1.1 components, copyright 2026 Benji Taylor (MIT): /illustrations/STAGESHOW-LICENSE.txt. Source: https://github.com/benjitaylor/skills/tree/main/stageshow. No third-party brand artwork is used in these illustrations.
`);

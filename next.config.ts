import { join } from "node:path";
import type { NextConfig } from "next";

// ONNX Runtime for the Background Remover lives in tools/ort (its own install), outside the vendored editor's module path.
const SITE_ORT = join(process.cwd(), "tools/ort/node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    const isolation = [
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    ];
    return [
      { source: "/pdfjs/6.5.438/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      ...["js", "wasm"].map(extension => ({ source: `/local-ai/rnnoise-0.2.1.${extension}`, headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] })),
      { source: "/editor/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/editor-models/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/studio", headers: isolation },
      { source: "/studio-sw.js", headers: isolation },
      { source: "/editor/:path*", headers: [...isolation, { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob: data:; font-src 'self' blob: data:; connect-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'" }] },
    ];
  },
  // Keep Tailwind available when using `next build --webpack` to diagnose a Turbopack failure.
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, "site-ort/wasm": SITE_ORT };
    // Extend Next's CSS chain so its extraction and minification stay intact.
    for (const group of config.module.rules) {
      for (const rule of group.oneOf ?? []) {
        if (Array.isArray(rule.use) && rule.use.some((entry: { loader?: string }) => /[\\/]css-loader[\\/]/.test(entry.loader ?? ""))) {
          rule.use.push({ loader: "@tailwindcss/turbopack" });
        }
      }
    }
    return config;
  },
  turbopack: {
    resolveAlias: { "site-ort/wasm": "./tools/ort/node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs" },
    rules: {
      // CSS modules must keep their module type; renaming them to *.css makes Turbopack emit unscoped global
      // classes and an empty class map, which left every *.module.css component unstyled under `next dev`.
      "*.css": [
        { condition: { not: { path: /\.module\.css$/ } }, loaders: ["@tailwindcss/turbopack"], as: "*.css" },
        { condition: { path: /\.module\.css$/ }, loaders: ["@tailwindcss/turbopack"], as: "*.module.css" },
      ],
    },
  },
};

export default nextConfig;

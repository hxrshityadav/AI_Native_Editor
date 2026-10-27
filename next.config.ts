import type { NextConfig } from "next";

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
      { source: "/editor/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/editor-models/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/studio", headers: isolation },
      { source: "/studio-sw.js", headers: isolation },
      { source: "/editor/:path*", headers: [...isolation, { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob: data:; font-src 'self' blob: data:; connect-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'" }] },
    ];
  },
  // Keep Tailwind available when using `next build --webpack` to diagnose a Turbopack failure.
  webpack(config) {
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
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

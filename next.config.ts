import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "vendor/**",
    "public/editor/**",
    "public/media-notices/**",
    "public/local-ai/**",
    "public/pdfjs/**",
    "output/cliputils-rea/**",
    "output/local-ai-*/**",
    "output/stageshow-workshop-build/**",
    // Third-party agent skills (see .claude/skills/SOURCES.md) are not project code.
    ".claude/skills/**",
  ]),
]);

export default eslintConfig;

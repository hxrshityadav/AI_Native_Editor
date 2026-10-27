import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import type { Plugin } from "vite";

/** Preserve notices for dependencies actually present in the generated chunks. */
export function thirdPartyNotices(): Plugin {
  return {
    name: "reelfinisher-third-party-notices",
    generateBundle(_options, bundle) {
      const packages = new Map<string, { name: string; version: string; license?: unknown; repository?: unknown; notices: string[] }>();
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        for (const id of Object.keys(chunk.modules)) {
          if (!id.includes("node_modules")) continue;
          let directory = dirname(id.split("?")[0]);
          while (directory !== parse(directory).root && !existsSync(join(directory, "package.json"))) directory = dirname(directory);
          if (!existsSync(join(directory, "package.json")) || packages.has(directory)) continue;
          const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
          if (!pkg.name || !pkg.version) continue;
          const notices: string[] = [];
          for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (!entry.isFile() || !/^(licen[sc]e|copying|notice|copyright)(\.|$)/i.test(entry.name)) continue;
            const fileName = `licenses/${pkg.name.replaceAll("/", "_")}-${pkg.version}/${entry.name}`;
            this.emitFile({ type: "asset", fileName, source: readFileSync(join(directory, entry.name)) });
            notices.push(fileName);
          }
          packages.set(directory, { name: pkg.name, version: pkg.version, license: pkg.license, repository: pkg.repository, notices });
        }
      }
      this.emitFile({ type: "asset", fileName: "licenses/bundled.json", source: JSON.stringify([...packages.values()].sort((a, b) => a.name.localeCompare(b.name)), null, 2) });
    },
  };
}

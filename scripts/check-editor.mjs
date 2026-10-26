import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(new URL("../vendor/openreel", import.meta.url));
for (const args of [["--filter", "@openreel/web", "typecheck"], ["--filter", "@openreel/web", "exec", "vitest", "run", "src/reelfinisher", "src/stores/project", "src/services/auto-save.test.ts", "src/services/project-fonts.test.ts", "src/services/export-runner.test.ts"]]) {
  const result = spawnSync(process.platform === "win32" ? "corepack.cmd" : "corepack", ["pnpm", ...args], { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

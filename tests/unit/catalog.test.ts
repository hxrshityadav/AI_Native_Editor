import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { CATEGORIES, TOOLS, toolsIn } from "../../src/lib/tools/catalog";

it("lists only tools that have a real route", () => {
  for (const tool of TOOLS) expect(existsSync(join("src/app", tool.href, "page.tsx")), tool.href).toBe(true);
  expect(new Set(TOOLS.map(tool => tool.href)).size).toBe(TOOLS.length);
});

it("gives every empty category an honest message instead of placeholder tools", () => {
  for (const category of CATEGORIES) expect(toolsIn(category.id).length > 0 || !!category.empty, category.id).toBe(true);
});

import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { CATEGORIES, TOOLS, toolsIn } from "../../src/lib/tools/catalog";

it("gives every available tool a real route and every planned tool none", () => {
  for (const tool of TOOLS.filter(entry => entry.status === "available")) expect(existsSync(join("src/app", tool.href!, "page.tsx")), tool.title).toBe(true);
  for (const tool of TOOLS.filter(entry => entry.status === "planned")) expect(tool.href, tool.title).toBeUndefined();
  expect(new Set(TOOLS.map(tool => tool.title)).size).toBe(TOOLS.length);
});

it("lists every category with at least one entry", () => {
  for (const category of CATEGORIES) expect(toolsIn(category.id).length, category.id).toBeGreaterThan(0);
});

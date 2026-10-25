import { describe, expect, it } from "vitest";
import { changeEditing, defaultEditing, editingSchema, undoEditing, redoEditing } from "@/lib/editor/project";

describe("versioned editing model", () => {
  it("round trips settings and rejects corrupt stored projects", () => {
    const initial = defaultEditing();
    expect(editingSchema.parse(JSON.parse(JSON.stringify(initial)))).toEqual(initial);
    expect(editingSchema.safeParse({ composition: { scale: Infinity } }).success).toBe(false);
    expect(editingSchema.safeParse({ cuts: [{ start: 5, end: 2 }] }).success).toBe(false);
  });
  it("undoes and redoes settings without touching unrelated composition", () => {
    const current = defaultEditing();
    const before = { current, past: [], future: [] };
    const edited = changeEditing(before, { ...current, appearance: { textColor: "#ff0000" } });
    expect(edited.current.composition).toEqual(current.composition);
    expect(undoEditing(edited).current).toEqual(current);
    expect(redoEditing(undoEditing(edited)).current).toEqual(edited.current);
    expect(changeEditing(undoEditing(edited), { ...current, styleId: "boxed" }).future).toEqual([]);
  });
});

"use client";
import { useCallback, useRef, useState } from "react";
import { changeEditing, defaultEditing, editingSchema, redoEditing, undoEditing, type EditingSettings, type EditHistory } from "@/lib/editor/project";

export function useEditingSettings(onDirty: () => void) {
  const [history, setHistory] = useState<EditHistory>(() => ({ current: defaultEditing(), past: [], future: [] }));
  const gesture = useRef<EditingSettings | null>(null);
  const update = useCallback((patch: Partial<EditingSettings>) => {
    onDirty();
    const active = !!gesture.current;
    setHistory((history) => active ? { ...history, current: editingSchema.parse({ ...history.current, ...patch }), future: [] } : changeEditing(history, { ...history.current, ...patch }));
  }, [onDirty]);
  const restore = useCallback((settings: unknown) => {
    const parsed = editingSchema.safeParse(settings);
    setHistory({ current: parsed.success ? parsed.data : defaultEditing(), past: [], future: [] });
  }, []);
  return { settings: history.current, update, restore,
    beginGesture: () => { gesture.current = history.current; },
    endGesture: () => { const before = gesture.current; gesture.current = null; if (before) setHistory((history) => JSON.stringify(before) === JSON.stringify(history.current) ? history : { ...history, past: [...history.past, before].slice(-100), future: [] }); },
    undo: () => { onDirty(); setHistory(undoEditing); }, redo: () => { onDirty(); setHistory(redoEditing); },
    canUndo: !!history.past.length, canRedo: !!history.future.length };
}

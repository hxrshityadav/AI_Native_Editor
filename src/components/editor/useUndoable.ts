"use client";

import { useCallback, useState } from "react";

/** A value with undo and redo. `reset` replaces it and clears the history (a new file, a restored draft). */
export function useUndoable<T>(initial: T, limit = 50) {
  const [state, setState] = useState({ past: [] as T[], present: initial, future: [] as T[] });
  const set = useCallback(
    (next: T) => setState((s) => ({ past: [...s.past, s.present].slice(-limit), present: next, future: [] })),
    [limit],
  );
  const reset = useCallback((value: T) => setState({ past: [], present: value, future: [] }), []);
  const undo = useCallback(
    () =>
      setState((s) =>
        s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s,
      ),
    [],
  );
  const redo = useCallback(
    () => setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s)),
    [],
  );
  return { value: state.present, set, reset, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}

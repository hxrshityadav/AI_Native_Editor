"use client";
import { useEffect, useSyncExternalStore } from "react";
import { createWorkspaceStore, EMPTY_WORKSPACE, WORKSPACE_KEY } from "@/lib/command-center/store";

export const workspaceStore = createWorkspaceStore();
let consumers = 0;
function onStorage(event: StorageEvent) {
  if (event.key === WORKSPACE_KEY || event.key === null) workspaceStore.hydrate();
}
export function useWorkspace() {
  const snapshot = useSyncExternalStore(workspaceStore.subscribe, workspaceStore.getSnapshot, () => EMPTY_WORKSPACE);
  useEffect(() => {
    if (!consumers++) { workspaceStore.hydrate(); window.addEventListener("storage", onStorage); }
    return () => { if (!--consumers) window.removeEventListener("storage", onStorage); };
  }, []);
  return snapshot;
}

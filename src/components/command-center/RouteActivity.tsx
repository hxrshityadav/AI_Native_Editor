"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useWorkspace, workspaceStore } from "./useWorkspace";

export function RouteActivity() {
  const path = usePathname(), last = useRef<string | null>(null);
  const state = useWorkspace();
  useEffect(() => {
    if (!state.loaded || path === last.current) return;
    last.current = path;
    workspaceStore.recordVisit(path);
  }, [path, state.loaded]);
  return null;
}

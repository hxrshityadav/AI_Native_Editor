import { toolByHref } from "./catalog";

export const WORKSPACE_KEY = "rf-command-workspace-v1";
export type RecentVisit = { href: string; visitedAt: number };
export type WorkspaceData = { version: 1; favorites: string[]; recent: RecentVisit[]; recordHistory: boolean };
export type WorkspaceSnapshot = WorkspaceData & { loaded: boolean; storage: "available" | "temporary" | "recovered" };
export const EMPTY_WORKSPACE: WorkspaceSnapshot = { version: 1, favorites: [], recent: [], recordHistory: true, loaded: false, storage: "available" };
type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

export function parseWorkspace(raw: string | null): WorkspaceData {
  if (raw === null) return { version: 1, favorites: [], recent: [], recordHistory: true };
  if (raw.length > 32_768) throw new Error("WORKSPACE_TOO_LARGE");
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1) throw new Error("WORKSPACE_VERSION");
  const data = value as Partial<WorkspaceData>;
  if (!Array.isArray(data.favorites) || !Array.isArray(data.recent) || typeof data.recordHistory !== "boolean") throw new Error("WORKSPACE_INVALID");
  const favorites = [...new Set(data.favorites.filter((href): href is string => typeof href === "string" && toolByHref.has(href)))].slice(0, 64);
  const recent = data.recent.filter((visit): visit is RecentVisit => !!visit && typeof visit === "object" && toolByHref.has(visit.href) && Number.isFinite(visit.visitedAt) && visit.visitedAt >= 0)
    .sort((a, b) => b.visitedAt - a.visitedAt).filter((visit, index, all) => all.findIndex(other => other.href === visit.href) === index).slice(0, 12).map(visit => ({ href: visit.href, visitedAt: visit.visitedAt }));
  return { version: 1, favorites, recent, recordHistory: data.recordHistory };
}

/** Stores route names and visit times only. It never reads media, transcripts or Studio databases. */
export function createWorkspaceStore(getStorage: () => StorageAdapter = () => window.localStorage) {
  let snapshot = EMPTY_WORKSPACE;
  const listeners = new Set<() => void>();
  function emit() { for (const listener of listeners) listener(); }
  function hydrate() {
    try {
      const raw = getStorage().getItem(WORKSPACE_KEY);
      try { snapshot = { ...parseWorkspace(raw), loaded: true, storage: "available" }; }
      catch { snapshot = { ...EMPTY_WORKSPACE, loaded: true, storage: "recovered" }; }
    } catch { snapshot = { ...snapshot, loaded: true, storage: "temporary" }; }
    emit();
  }
  function update(change: (current: WorkspaceSnapshot) => WorkspaceData) {
    if (!snapshot.loaded) hydrate();
    // Merge the latest persisted state before a mutation in another tab.
    if (snapshot.storage !== "temporary") {
      try { snapshot = { ...parseWorkspace(getStorage().getItem(WORKSPACE_KEY)), loaded: true, storage: snapshot.storage }; } catch { /* preserve the usable in-memory copy */ }
    }
    const changed = change(snapshot);
    const data: WorkspaceData = { version: 1, favorites: changed.favorites, recent: changed.recent, recordHistory: changed.recordHistory };
    snapshot = { ...data, loaded: true, storage: snapshot.storage };
    try { getStorage().setItem(WORKSPACE_KEY, JSON.stringify(data)); snapshot = { ...snapshot, storage: "available" }; }
    catch { snapshot = { ...snapshot, storage: "temporary" }; }
    emit();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    hydrate,
    toggleFavorite(href: string) {
      if (!toolByHref.has(href)) return;
      update(current => ({ ...current, favorites: current.favorites.includes(href) ? current.favorites.filter(item => item !== href) : [...current.favorites, href] }));
    },
    recordVisit(href: string, visitedAt = Date.now()) {
      if (!toolByHref.has(href) || !Number.isFinite(visitedAt) || visitedAt < 0) return;
      if (!snapshot.loaded) hydrate();
      if (!snapshot.recordHistory) return;
      update(current => ({ ...current, recent: current.recordHistory ? [{ href, visitedAt }, ...current.recent.filter(item => item.href !== href)].slice(0, 12) : current.recent }));
    },
    clearHistory() { update(current => ({ ...current, recent: [] })); },
    clearFavorites() { update(current => ({ ...current, favorites: [] })); },
    setRecordHistory(recordHistory: boolean) { update(current => ({ ...current, recordHistory })); },
  };
}

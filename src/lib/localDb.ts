import { openDB, type DBSchema } from "idb";
import type { Draft } from "./drafts";

/** Everything this app keeps in the browser. Nothing here is ever uploaded. */
interface LocalDB extends DBSchema {
  drafts: { key: string; value: Draft; indexes: { savedAt: number } };
  /** Small app-wide records, e.g. the brand kit under key "brandKit". */
  settings: { key: string; value: unknown };
}

let dbPromise: ReturnType<typeof openDB<LocalDB>> | null = null;

export function localDb() {
  dbPromise ??= openDB<LocalDB>("reel-finisher", 2, {
    upgrade(database, oldVersion) {
      // Each step runs once per browser; existing drafts survive the upgrade.
      if (oldVersion < 1) {
        database.createObjectStore("drafts", { keyPath: "fingerprint" }).createIndex("savedAt", "savedAt");
      }
      if (oldVersion < 2) database.createObjectStore("settings");
    },
  });
  return dbPromise;
}

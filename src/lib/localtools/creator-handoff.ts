import { openDB } from "idb";
import { fingerprintFile } from "../drafts";
import { creatorSpec, type CreatorSpec } from "./moments";

const database = () => openDB("reel-finisher-creator-handoff", 1, { upgrade(db) { db.createObjectStore("jobs", { keyPath: "id" }).createIndex("expiresAt", "expiresAt"); } });
const validId = (id: string) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
export async function saveCreatorHandoff(file: File, value: CreatorSpec): Promise<string> {
  const spec = creatorSpec.parse(value);
  if (!file.size || file.size > 512 * 1048576) throw new Error("Choose a non-empty video up to 512 MiB.");
  const db = await database();
  try {
    const expired = await db.getAllKeysFromIndex("jobs", "expiresAt", IDBKeyRange.upperBound(Date.now()));
    for (const id of expired) await db.delete("jobs", id);
    const id = crypto.randomUUID();
    await db.put("jobs", { id, spec, file, fingerprint: await fingerprintFile(file), expiresAt: Date.now() + 86400000 });
    return id;
  } catch { throw new Error("Cannot store the Studio handoff. Free browser storage or try a smaller source; existing Studio projects are unchanged."); }
  finally { db.close(); }
}
export async function loadCreatorHandoff(id: string): Promise<{ spec: CreatorSpec; file: File; fingerprint: string }> {
  if (!validId(id)) throw new Error("Invalid Studio handoff. Return to Shorts Maker and create it again.");
  const db = await database();
  try {
    const job = await db.get("jobs", id);
    if (!job || !Number.isFinite(job.expiresAt) || job.expiresAt < Date.now()) { if (job) await db.delete("jobs", id); throw new Error("This handoff expired or was already imported. Create it again in Shorts Maker."); }
    const spec = creatorSpec.parse(job.spec);
    if (!(job.file instanceof File) || !job.file.size || job.file.size > 512 * 1048576 || await fingerprintFile(job.file) !== job.fingerprint) throw new Error("The saved original could not be validated. Reselect it in Shorts Maker.");
    return { spec, file: job.file, fingerprint: job.fingerprint };
  } finally { db.close(); }
}
export async function consumeCreatorHandoff(id: string) {
  if (!validId(id)) return;
  const db = await database(); try { await db.delete("jobs", id); } finally { db.close(); }
}

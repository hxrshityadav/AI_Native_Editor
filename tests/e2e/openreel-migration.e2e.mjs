import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createChecks, ROOT, startServer, stopServer, decodeErrors, probe, streams, countPixels } from "./helpers.mjs";
const OUT = join(ROOT, "tests/e2e/.out-openreel"), PORT = 3142;
mkdirSync(OUT, { recursive: true });
const original = join(OUT, "blue.mp4"), wrong = join(OUT, "red.mp4"), bytes = readFileSync(original);
const fingerprint = createHash("sha256").update(Buffer.concat([Buffer.from(String(bytes.length)), bytes.subarray(0, 1048576), bytes.subarray(Math.max(0, bytes.length - 1048576))])).digest("hex");
const legacy = { version: 1, fingerprint, savedAt: Date.now(), providerName: "Manual", transcript: [], edited: null, editing: { version: 1, exportPreset: "original", cuts: [{ start: 0.5, end: 1 }], gaps: [{ start: 1.5, end: 2 }], splits: [3], audio: { volume: 0.6 }, captions: [{ id: "caption", start: 2, end: 3, words: [{ text: "नमस्ते", start: 2, end: 2.5 }, { text: "doston", start: 2.5, end: 3 }], appearance: { textColor: "#00ff00", fontSizeRatio: 0.1 }, estimated: false }] } };
const { check, finish } = createChecks();
const server = await startServer(PORT, { env: { REEL_ENABLE_CLOUD: "" } }), browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); await page.goto(`http://localhost:${PORT}/studio`);
  await page.evaluate(async (draft) => {
    const database = await new Promise((resolve, reject) => { const request = indexedDB.open("reel-finisher", 2); request.onupgradeneeded = () => { const db = request.result; db.createObjectStore("drafts", { keyPath: "fingerprint" }).createIndex("savedAt", "savedAt"); db.createObjectStore("settings"); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise((resolve, reject) => { const tx = database.transaction(["drafts", "settings"], "readwrite"); tx.objectStore("drafts").put(draft); tx.objectStore("settings").put(draft.editing, `project:${draft.fingerprint}`); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); database.close();
  }, legacy);
  const frame = page.frameLocator('iframe[title="Reel Finisher video editor"]'); await frame.getByRole("button", { name: "Import legacy", exact: true }).click();
  await frame.getByLabel("Legacy original video", { exact: true }).setInputFiles(wrong); await frame.getByText(/This is not the original media/).waitFor(); check("migration: rejects the wrong original before creating a project", true);
  await frame.getByLabel("Legacy original video", { exact: true }).setInputFiles(original); await frame.getByRole("button", { name: "Create separate browser project", exact: true }).waitFor();
  await frame.getByRole("button", { name: "Create separate browser project", exact: true }).click(); await frame.getByRole("button", { name: "Skip tour", exact: true }).first().click();
  const records = await page.evaluate(async (fingerprint) => {
    const read = async (name, store, key) => { const db = await new Promise((resolve) => { const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); }); const value = await new Promise((resolve) => { const request = db.transaction(store).objectStore(store)[key ? "get" : "getAll"](key); request.onsuccess = () => resolve(request.result); }); db.close(); return value; };
    return { draft: await read("reel-finisher", "drafts", fingerprint), autosaves: await read("openreel-autosave", "autosaves") };
  }, fingerprint);
  check("migration: original draft is byte-for-byte unchanged", JSON.stringify(records.draft) === JSON.stringify(legacy));
  const project = JSON.parse(records.autosaves.sort((a, b) => b.timestamp - a.timestamp)[0].data);
  check("migration: separate project preserves source intervals and blank output gaps", project.id !== fingerprint && project.timeline.duration === 3.5 && project.timeline.tracks.flatMap((track) => track.clips).some((clip) => clip.inPoint === 2 && clip.startTime === 1.5));
  check("migration: Hindi words and overrides survive in caption extension", project.textClips[0].text === "नमस्ते doston" && project.textClips[0].metadata.reelFinisher.appearance.textColor === "#00ff00");
  await frame.getByRole("button", { name: "Export", exact: true }).click(); const event = page.waitForEvent("download", { timeout: 120000 }); await frame.getByRole("button", { name: "Export Video", exact: true }).click(); const result = await event; const path = join(OUT, "migrated.mp4"); await result.saveAs(path);
  check("migration: migrated video/audio decode with the cut duration", !decodeErrors(path) && Math.abs(Number(streams(probe(path), "video")[0].duration) - 3.5) < 0.05);
  check("migration: a non-ripple deleted gap exports as empty time", countPixels(path, 1.25, 320, 180, 0.4, 0.95, (r, g, b) => r < 15 && g < 15 && b < 15) > 20000);
  await frame.getByRole("button", { name: "Select clip blue.mp4", exact: true }).nth(2).click({ button: "right" });
  await frame.getByRole("menuitem", { name: "Close Gap to Previous", exact: true }).click();
  await page.waitForTimeout(2600);
  const time = await frame.getByLabel("Project duration", { exact: true }).innerText();
  check("native gap: global close-gap reduces output time by the actual empty interval", time === "00:00:03:00");
  await frame.getByRole("button", { name: "Captions & tools", exact: true }).click(); await frame.getByLabel("Choose caption", { exact: true }).selectOption({ index: 1 });
  check("native gap: caption shifts with the media", Number(await frame.getByLabel("Start (s)", { exact: true }).inputValue()) === 1);
  await frame.getByRole("button", { name: "Close tools", exact: true }).click(); await frame.getByRole("button", { name: "Undo", exact: true }).first().click();
  check("native gap: one undo restores the gap", await frame.getByLabel("Project duration", { exact: true }).innerText() === "00:00:03:15");
  await page.screenshot({ path: join(OUT, "migration.png") });
} finally { await browser.close(); await stopServer(server); }
finish();

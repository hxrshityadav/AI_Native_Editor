import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../reelfinisher/captions", () => ({ ensureLocalCaptionFonts: vi.fn(async () => undefined) }));
import { ensureFontFamily, ensureProjectFonts, collectProjectFonts } from "./project-fonts";
import { createEmptyProject } from "../stores/project/project-helpers";
const load = vi.fn(async () => []);
beforeEach(() => { load.mockClear(); Object.defineProperty(document, "fonts", { value: { load, *[Symbol.iterator]() { yield { family: "RF Poppins" }; yield { family: "RF Hind" }; } }, configurable: true }); });
describe("local fonts", () => {
 it("loads bundled Hindi glyphs without injecting an external stylesheet", async () => { await ensureFontFamily("RF Poppins", 700, "नमस्ते"); expect(load).toHaveBeenCalledWith('700 48px "RF Poppins"', "नमस्ते"); expect(document.querySelector('link[data-openreel-font]')).toBeNull(); });
 it("rejects fonts requiring a remote Google download with a recovery action", async () => { await expect(ensureFontFamily("Bangers")).rejects.toThrow(/Upload the font/); expect(load).not.toHaveBeenCalled(); });
 it("supports system fonts without a remote request", async () => { await ensureFontFamily("Arial", 400); expect(document.querySelector('link[data-openreel-font]')).toBeNull(); });
 it("collects text and waits for its local fonts before export", async () => { const project = createEmptyProject("Font sample"); const modified = { ...project, timeline: { ...project.timeline, subtitles: [{ id: "cue", text: "नमस्ते doston", startTime: 0, endTime: 1, style: { fontFamily: "RF Hind", fontSize: 24, color: "white", backgroundColor: "black", position: "bottom" as const } }] } }; expect(collectProjectFonts(modified)).toEqual([{ family: "RF Hind", weight: "700", sample: "नमस्ते dostn" }]); await ensureProjectFonts(modified); expect(load).toHaveBeenCalled(); });
});

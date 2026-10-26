import { useEffect, useState } from "react";
import { z } from "zod";
import type { TextClip } from "@openreel/core";
import { useProjectStore } from "../stores/project-store";
import { useTimelineStore } from "../stores/timeline-store";
import { cloneProjectForEdit } from "../stores/project/clone-project-for-edit";
import { snapshotAction } from "./commit";
import { captionTrack, makeCaption, srtCaptions } from "./caption-project";
import { readCaption, estimatedWords, captionExtension, type CaptionExtension } from "./caption-data";
import { CAPTION_PRESETS } from "../../../../../../src/lib/editor/captionPresets";
import { FONT_CATALOG, listLocalFonts, importFont, type FontRecord } from "../../../../../../src/lib/editor/fontLibrary";
import { localDb } from "../../../../../../src/lib/localDb";
import { editingSchema, appearanceSchema, animationSchema } from "../../../../../../src/lib/editor/project";
import { toSrt } from "../../../../../../src/lib/captions/srt";
import { getCaptionStyle } from "../../../../../../src/lib/captions/styles";
import { applyAppearance } from "../../../../../../src/lib/captions/appearance";
import { ensureLocalCaptionFonts } from "./captions";

const savedSchema = z.array(z.object({ name: z.string(), styleId: z.string(), appearance: appearanceSchema, animation: animationSchema }));
const defaults = (text: string, duration: number): CaptionExtension => ({ version: 1, kind: "caption", styleId: "clean", appearance: {}, animation: { effect: "none", duration: 0.25, intensity: 0.5 }, words: estimatedWords(text, duration), referenceDuration: duration, referenceFontSize: 1, timing: "estimated" });
export function CaptionPanel() {
  const project = useProjectStore((state) => state.project);
  const clips = project.textClips ?? [];
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("");
  const [start, setStart] = useState(0), [end, setEnd] = useState(2);
  const [data, setData] = useState<CaptionExtension>(defaults("", 2));
  const [problem, setProblem] = useState("");
  const [fontList, setFontList] = useState<FontRecord[]>(FONT_CATALOG);
  const [presets, setPresets] = useState<z.infer<typeof savedSchema>>([]);
  const [advanced, setAdvanced] = useState("{}");
  useEffect(() => { void Promise.all([listLocalFonts(), localDb().then((db) => db.get("settings", "subtitlePresets"))]).then(([fonts, saved]) => { setFontList([...FONT_CATALOG, ...fonts]); const parsed = savedSchema.safeParse(saved); if (parsed.success) setPresets(parsed.data); }).catch(() => setProblem("Cannot read fonts or presets. Check browser storage and retry.")); }, []);
  function select(clip?: TextClip) {
    const duration = clip?.duration ?? 2;
    const initial = clip ? readCaption(clip) ?? { ...defaults(clip.text, duration), appearance: { textColor: clip.style.color, horizontalPosition: clip.transform.position.x, verticalPosition: clip.transform.position.y, fontSizeRatio: clip.style.fontSize / project.settings.height } } : defaults("", duration);
    setSelected(clip?.id ?? ""); setText(clip?.text ?? ""); const time = clip?.startTime ?? useTimelineStore.getState().playheadPosition;
    setStart(time); setEnd(time + duration); setData(initial); setAdvanced(JSON.stringify(initial.appearance, null, 2)); setProblem("");
  }
  function updateData(next: CaptionExtension) { setData(next); setAdvanced(JSON.stringify(next.appearance, null, 2)); }
  async function save() {
    try {
      if (!text.trim() || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > project.timeline.duration + 0.001) throw new Error("Enter caption text and a valid start/end within the project.");
      await ensureLocalCaptionFonts();
      const state = useProjectStore.getState(); const current = state.getFullProject();
      const original = current.textClips?.find((clip) => clip.id === selected);
      const track = current.timeline.tracks.find((track) => track.id === original?.trackId);
      if (track?.locked) throw new Error("Unlock this caption track before editing.");
      if (original && !readCaption(original) && (original.keyframes.length || original.effects?.length || original.animation?.preset && original.animation.preset !== "none")) throw new Error("Use the native text inspector for this animated/effected title. Converting it would discard native settings.");
      const next = cloneProjectForEdit(current);
      const target = track ?? captionTrack();
      if (!track) next.timeline.tracks.unshift(target);
      const changed = !original || original.text.trim() !== text.trim();
      const extension = captionExtension.parse({ ...data, appearance: appearanceSchema.parse(JSON.parse(advanced)), ...(changed ? { words: estimatedWords(text, end - start), timing: "estimated", referenceDuration: end - start } : {}) });
      if ([extension.appearance.font, extension.baseAppearance?.font].some((id) => id && !fontList.some((font) => font.id === id))) throw new Error("This font is not installed. Upload it or choose a bundled font before saving.");
      const made = makeCaption(next, target.id, text.trim(), start, end - start, extension, fontList);
      const updated = original ? { ...made, id: original.id, keyframes: original.keyframes, effects: original.effects, transform: { ...original.transform, position: made.transform.position }, metadata: { ...original.metadata, ...made.metadata } } : made;
      const others = (next.textClips ?? []).filter((clip) => clip.id !== selected);
      const result = await state.executeAction(snapshotAction({ ...next, textClips: [...others, updated] }));
      if (!result.success) throw new Error(result.error?.message ?? "Caption could not be saved.");
      select(updated); useTimelineStore.getState().seekTo(start);
    } catch (error) { setProblem(error instanceof Error ? error.message : "Cannot save this caption. Check its settings and retry."); }
  }
  const a = data.appearance, style = applyAppearance(getCaptionStyle(data.styleId), data.baseAppearance ?? {}, data.animation, fontList);
  return <section className="rf-stack"><h2>Reel Finisher captions</h2><p>Type Hindi or Hinglish manually, or edit generated text. Manual and segment captions have estimated word timing; automatic karaoke remains off.</p>
    <button onClick={() => select()}>New manual caption</button>
    <label>Caption<select aria-label="Choose caption" value={selected} onChange={(event) => select(clips.find((clip) => clip.id === event.target.value))}><option value="">New caption</option>{clips.map((clip, index) => <option key={clip.id} value={clip.id}>{index + 1}. {clip.text.slice(0, 55)}</option>)}</select></label>
    <label>Caption text<textarea aria-label="Caption text" value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} /></label>
    <div className="rf-row"><label>Start (s)<input type="number" step={0.01} min={0} value={start} onChange={(event) => setStart(Number(event.target.value))} /></label><label>End (s)<input type="number" step={0.01} min={0} value={end} onChange={(event) => setEnd(Number(event.target.value))} /></label></div>
    <label>Style preset<select aria-label="Style preset" value="" onChange={(event) => { const preset = CAPTION_PRESETS[Number(event.target.value)]; if (preset) updateData({ ...data, styleId: preset.styleId, appearance: { ...preset.appearance }, animation: { ...data.animation, effect: preset.effect } }); }}><option value="">Choose a preset…</option>{CAPTION_PRESETS.map((preset, index) => <option key={preset.name} value={index}>{preset.name}</option>)}</select></label>
    {!!presets.length && <label>Saved brand presets<select aria-label="Saved brand presets" value="" onChange={(event) => { const preset = presets[Number(event.target.value)]; if (preset) updateData({ ...data, ...preset }); }}><option value="">Choose a saved preset…</option>{presets.map((preset, i) => <option key={i} value={i}>{preset.name}</option>)}</select></label>}
    <label>Font<select aria-label="Font" value={a.font ?? style.font} onChange={(event) => updateData({ ...data, appearance: { ...a, font: event.target.value } })}>{fontList.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label>
    <label>Upload a local font<input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void importFont(file).then(async (font) => { setFontList([...fontList, font]); await ensureLocalCaptionFonts(true); updateData({ ...data, appearance: { ...a, font: font.id } }); }).catch((error: Error) => setProblem(error.message)); event.target.value = ""; }} /></label>
    <label>Text color<input type="color" value={a.textColor ?? style.textColor} onChange={(event) => updateData({ ...data, appearance: { ...a, textColor: event.target.value } })} /></label>
    {([ ["horizontalPosition", "Horizontal position", 0.05, 0.95, 0.5], ["verticalPosition", "Vertical position", 0.05, 0.95, style.verticalPosition], ["fontSizeRatio", "Font size", 0.015, 0.15, style.fontSizeRatio] ] as const).map(([key, label, min, max, fallback]) => <label key={key}>{label}<input aria-label={label} type="range" min={min} max={max} step={0.001} value={a[key] ?? fallback} onChange={(event) => updateData({ ...data, appearance: { ...a, [key]: Number(event.target.value) } })} /></label>)}
    <label>Animation<select aria-label="Animation" value={data.animation.effect} onChange={(event) => updateData({ ...data, customAnimation: true, animation: animationSchema.parse({ ...data.animation, effect: event.target.value }) })}>{animationSchema.shape.effect.unwrap().options.map((effect) => <option key={effect}>{effect}</option>)}</select></label>
    <details><summary>All appearance settings</summary><p>Versioned JSON supports weight, italic, outline, shadow, box, opacity, line spacing and per-caption overrides. Invalid settings are rejected before saving.</p><textarea aria-label="Caption appearance JSON" rows={8} value={advanced} onChange={(event) => setAdvanced(event.target.value)} /></details>
    <button className="rf-primary" disabled={!project.timeline.duration} onClick={() => void save()}>{selected ? "Save caption changes" : "Add caption to timeline"}</button>
    <button disabled={!clips.some((clip) => readCaption(clip)?.kind === "caption")} onClick={() => { void (async () => {
      try {
        const baseAppearance = appearanceSchema.parse({ ...data.baseAppearance, ...JSON.parse(advanced) });
        if (baseAppearance.font && !fontList.some((font) => font.id === baseAppearance.font)) throw new Error("Install the shared style's font before applying it.");
        await ensureLocalCaptionFonts(); const state = useProjectStore.getState(), current = state.getFullProject();
        const captions = current.textClips?.filter((clip) => readCaption(clip)?.kind === "caption") ?? [];
        if (captions.some((clip) => current.timeline.tracks.find((track) => track.id === clip.trackId)?.locked)) throw new Error("Unlock caption tracks before applying a shared style. No changes were made.");
        const ids = new Set(captions.map((clip) => clip.id));
        const updated = current.textClips?.map((clip) => {
          if (!ids.has(clip.id)) return clip;
          const previous = readCaption(clip)!;
          const extension = { ...previous, styleId: data.styleId, baseAppearance, animation: previous.customAnimation ? previous.animation : data.animation };
          const made = makeCaption(current, clip.trackId, clip.text, clip.startTime, clip.duration, extension, fontList);
          return { ...made, id: clip.id, keyframes: clip.keyframes, effects: clip.effects, transform: { ...clip.transform, position: made.transform.position }, metadata: { ...clip.metadata, ...made.metadata } };
        });
        const result = await state.executeAction(snapshotAction({ ...current, textClips: updated }));
        if (!result.success) throw new Error(result.error?.message ?? "Cannot apply the shared style.");
      } catch (error) { setProblem(error instanceof Error ? error.message : "Cannot apply shared styling."); }
    })(); }}>Apply shared style to Reel Finisher captions</button>
    <p>Shared styles keep each caption’s explicit appearance and animation overrides.</p>
    {selected && <button onClick={() => { void (async () => { try { const state = useProjectStore.getState(), next = state.getFullProject(); const clip = next.textClips?.find((clip) => clip.id === selected); if (next.timeline.tracks.find((track) => track.id === clip?.trackId)?.locked) throw new Error("Unlock the caption track before deletion."); const result = await state.executeAction(snapshotAction({ ...next, textClips: next.textClips?.filter((clip) => clip.id !== selected) })); if (!result.success) throw new Error(result.error?.message); select(); } catch (error) { setProblem(error instanceof Error ? error.message : "Cannot delete caption."); } })(); }}>Delete caption only</button>}
    <button onClick={() => { const name = window.prompt("Name this caption preset"); if (!name?.trim()) return; void (async () => { try { const checked = editingSchema.parse({ styleId: data.styleId, appearance: { ...data.baseAppearance, ...JSON.parse(advanced) }, animation: data.animation }); const next = [...presets, { name: name.trim().slice(0, 60), styleId: checked.styleId, appearance: checked.appearance, animation: checked.animation }].slice(-30); await (await localDb()).put("settings", next, "subtitlePresets"); setPresets(next); } catch { setProblem("Cannot save preset. Check appearance settings and browser storage."); } })(); }}>Save as brand preset</button>
    <button disabled={!clips.length} onClick={() => {
      const lines = srtCaptions(useProjectStore.getState().getFullProject());
      const url = URL.createObjectURL(new Blob([toSrt(lines)], { type: "application/x-subrip;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "captions.srt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Download captions SRT</button>
    {problem && <p role="alert">{problem}</p>}
  </section>;
}

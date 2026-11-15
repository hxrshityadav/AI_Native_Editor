"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Trash2, Upload } from "lucide-react";
import { CAPTION_FONTS, DYNAMIC, PRESETS, drawCaption, fontById, type Caption, type CaptionStyle, type PresetId } from "@/lib/subtitles/captions";
import { addCustomFont, removeCustomFont, type StoredFont } from "@/lib/subtitles/fonts";
import { InlineMessage, styles } from "../../tools/surface/ToolSurface";
import css from "../SubtitleStudio.module.css";

/* Caption style: a preset library with live thumbnails (drawn by the real renderer), then grouped controls. */

const SAMPLE: Caption[] = [{ id: "s", start: 0, end: 2, text: "Make every word count", words: [{ text: "Make", start: 0, end: 0.4 }, { text: "every", start: 0.4, end: 0.8 }, { text: "word", start: 0.8, end: 1.3 }, { text: "count", start: 1.3, end: 2 }] }];
const SAVED = "rf-caption-presets-v1";
type Saved = { name: string; style: CaptionStyle };
const readSaved = (): Saved[] => { try { return JSON.parse(localStorage.getItem(SAVED) || "[]"); } catch { return []; } };

function Thumb({ style, ready }: { style: CaptionStyle; ready: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas || !ready) return;
    const ctx = canvas.getContext("2d")!; canvas.width = 320; canvas.height = 180;
    ctx.fillStyle = "#3b3f46"; ctx.fillRect(0, 0, 320, 180); ctx.fillStyle = "#2a2d33"; ctx.fillRect(0, 110, 320, 70);
    drawCaption(ctx, SAMPLE, 1.0, { ...style, x: style.align === "left" ? 0.06 : 0.5, y: 0.55, size: style.size * 2.6, maxWords: 2, maxChars: 14, width: 1, safeMargin: 0.3, entrance: style.entrance === "typewriter" ? "none" : style.entrance }, 320, 180);
  }, [style, ready]);
  return <canvas ref={ref} className={css.thumb} aria-hidden />;
}

function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return <details className={css.section} open={open}><summary>{title}</summary><div className={css.sectionBody}>{children}</div></details>;
}

export function StylePanel({ style, setStyle, hasWords, fontsReady, customFonts, setCustomFonts, devanagari }: {
  style: CaptionStyle; setStyle: (next: CaptionStyle) => void; hasWords: boolean; fontsReady: boolean; customFonts: StoredFont[]; setCustomFonts: (fonts: StoredFont[]) => void; devanagari: boolean;
}) {
  const [saved, setSaved] = useState<Saved[]>(() => typeof window === "undefined" ? [] : readSaved()), [fontName, setFontName] = useState(""), [fontError, setFontError] = useState(""), [busy, setBusy] = useState(false);
  const update = <K extends keyof CaptionStyle>(key: K, value: CaptionStyle[K]) => setStyle({ ...style, [key]: value, preset: "custom" });
  const font = fontById(style.font), dynamic = DYNAMIC.includes(style.highlightMode);
  const persist = (list: Saved[]) => { setSaved(list); try { localStorage.setItem(SAVED, JSON.stringify(list)); } catch { /* storage blocked: kept for this session */ } };

  async function upload(file: File) {
    setFontError(""); setBusy(true);
    try { const added = await addCustomFont(file, fontName); setCustomFonts([...customFonts, added]); setStyle({ ...style, font: added.id, preset: "custom" }); setFontName(""); }
    catch (failure) { setFontError(failure instanceof Error ? failure.message : "This font could not be used."); }
    finally { setBusy(false); }
  }

  return <div className={css.styleBody}>
    <fieldset className={css.presetGrid}><legend className={styles.label}>Presets</legend>
      {(Object.keys(PRESETS) as Exclude<PresetId, "custom">[]).map(id => { const p = PRESETS[id], needsWords = DYNAMIC.includes(p.style.highlightMode), latinOnly = !fontById(p.style.font).scripts.includes("devanagari");
        return <label key={id} className={css.presetCard} data-checked={style.preset === id || undefined}>
          <input type="radio" name="caption-preset" value={id} className="sr-only" checked={style.preset === id} onChange={() => setStyle({ ...p.style, x: p.style.align === "center" ? 0.5 : p.style.x })} />
          <Thumb style={p.style} ready={fontsReady} />
          <span className={css.presetName}>{p.label}</span>
          <span className={css.presetNote}>{p.note}{needsWords && !hasWords ? " Needs word timings; shows whole captions for now." : ""}{latinOnly && devanagari ? " Cannot draw your Devanagari text." : ""}</span>
        </label>; })}
    </fieldset>
    {dynamic && !hasWords && <InlineMessage tone="warn">This style highlights words as they are spoken, which needs word timings from transcription. These captions have none (written by hand or edited), so they show as whole captions.</InlineMessage>}

    <Section title="Typography" open>
      <label className={styles.group}><span className={styles.label}>Font</span>
        <select aria-label="Caption font" className={styles.field} value={style.font} onChange={event => update("font", event.target.value)}>
          <optgroup label="Bundled">{CAPTION_FONTS.map(f => <option key={f.id} value={f.id}>{f.label}{f.scripts.includes("devanagari") ? " · Latin + Devanagari" : " · Latin only"}</option>)}</optgroup>
          {customFonts.length > 0 && <optgroup label="Your fonts">{customFonts.map(f => <option key={f.id} value={f.id}>{f.label} · {f.scripts.join(" + ")}</option>)}</optgroup>}
        </select></label>
      <Range label="Size" value={style.size} min={2.5} max={14} step={0.1} unit="%" onChange={v => update("size", v)} />
      {font.weights && <Range label="Weight" value={style.weight} min={font.weights[0]} max={font.weights[1]} step={100} onChange={v => update("weight", v)} />}
      <Range label="Letter spacing" value={style.letterSpacing} min={-0.05} max={0.3} step={0.01} unit="em" onChange={v => update("letterSpacing", v)} />
      <Range label="Line height" value={style.lineHeight} min={0.9} max={2} step={0.05} onChange={v => update("lineHeight", v)} />
      <div className={css.pair}>
        <label className={styles.group}><span className={styles.label}>Case</span><select aria-label="Text case" className={styles.field} value={style.transform} onChange={event => update("transform", event.target.value as CaptionStyle["transform"])}><option value="none">As written</option><option value="uppercase">UPPERCASE</option><option value="lowercase">lowercase</option></select></label>
        <label className={styles.group}><span className={styles.label}>Alignment</span><select aria-label="Text alignment" className={styles.field} value={style.align} onChange={event => update("align", event.target.value as CaptionStyle["align"])}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label>
      </div>
      <Range label="Words per line" value={style.maxWords} min={1} max={14} step={1} onChange={v => update("maxWords", v)} />
      <Range label="Characters per line" value={style.maxChars} min={8} max={60} step={1} onChange={v => update("maxChars", v)} />
    </Section>

    <Section title="Colour and highlighting">
      <div className={css.pair}>
        <Color label="Text colour" value={style.color} onChange={v => update("color", v)} />
        <Color label="Highlight colour" value={style.highlight} onChange={v => update("highlight", v)} />
      </div>
      <label className={styles.group}><span className={styles.label}>Word highlighting</span>
        <select aria-label="Word highlighting" className={styles.field} value={style.highlightMode} onChange={event => update("highlightMode", event.target.value as CaptionStyle["highlightMode"])}>
          <option value="none">Off (whole captions)</option><option value="word">Current word</option><option value="line">Current line</option><option value="reveal">Reveal words as spoken</option><option value="karaoke">Karaoke fill</option>
        </select>
        {dynamic && <span className={styles.help}>{hasWords ? "Uses the word timings from transcription." : "No word timings yet: captions show whole until you transcribe."}</span>}</label>
      <label className={css.check}><input type="checkbox" checked={!!style.activeBg} onChange={event => update("activeBg", event.target.checked ? "#ffd23f" : null)} /> Box behind the current word</label>
      {style.activeBg && <Color label="Word box colour" value={style.activeBg} onChange={v => update("activeBg", v)} />}
      <Range label="Current word scale" value={style.emphasis} min={1} max={1.25} step={0.01} unit="×" onChange={v => update("emphasis", v)} />
    </Section>

    <Section title="Outline, shadow and background">
      <div className={css.pair}>
        <Range label="Outline" value={style.outline} min={0} max={24} step={1} unit="%" onChange={v => update("outline", v)} />
        <Color label="Outline colour" value={style.outlineColor} onChange={v => update("outlineColor", v)} />
      </div>
      <label className={css.check}><input type="checkbox" checked={!!style.shadow} onChange={event => update("shadow", event.target.checked ? { blur: 8, x: 0, y: 2, color: "rgba(0,0,0,0.6)" } : null)} /> Drop shadow</label>
      {style.shadow && <Range label="Shadow softness" value={style.shadow.blur} min={0} max={30} step={1} onChange={v => update("shadow", { ...style.shadow!, blur: v })} />}
      <label className={styles.group}><span className={styles.label}>Background</span>
        <select aria-label="Caption background" className={styles.field} value={style.background} onChange={event => update("background", event.target.value as CaptionStyle["background"])}><option value="none">None</option><option value="box">A box per line</option><option value="band">One band</option></select></label>
      {style.background !== "none" && <>
        <div className={css.pair}><Color label="Background colour" value={style.backgroundColor} onChange={v => update("backgroundColor", v)} /><Range label="Opacity" value={style.backgroundOpacity} min={0.1} max={1} step={0.05} onChange={v => update("backgroundOpacity", v)} /></div>
        <div className={css.pair}><Range label="Padding" value={style.padding} min={0.1} max={1} step={0.05} unit="em" onChange={v => update("padding", v)} /><Range label="Corner radius" value={style.radius} min={0} max={1} step={0.05} unit="em" onChange={v => update("radius", v)} /></div>
      </>}
    </Section>

    <Section title="Animation">
      <label className={styles.group}><span className={styles.label}>Caption entrance</span>
        <select aria-label="Caption entrance" className={styles.field} value={style.entrance} onChange={event => update("entrance", event.target.value as CaptionStyle["entrance"])}><option value="none">None</option><option value="fade">Fade</option><option value="pop">Pop in</option><option value="rise">Rise</option><option value="typewriter">Typewriter</option></select>
        <span className={styles.help}>Entrances last under a fifth of a second. Preview and export use the same timing.</span></label>
    </Section>

    <Section title="Your fonts">
      <p className={styles.help}>Upload a TTF, OTF, WOFF or WOFF2 file (up to 15 MB). It stays in this browser and is never uploaded. You are responsible for having the right to use the fonts you upload.</p>
      <label className={styles.group}><span className={styles.label}>Font name</span><input className={styles.field} aria-label="Custom font name" maxLength={40} value={fontName} placeholder="Optional" onChange={event => setFontName(event.target.value)} /></label>
      <label className={styles.secondary}><Upload aria-hidden size={16} />{busy ? "Reading font…" : "Upload font"}<input type="file" className="sr-only" aria-label="Upload caption font" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} /></label>
      {fontError && <InlineMessage role="alert" tone="error">{fontError}</InlineMessage>}
      {customFonts.map(f => <div key={f.id} className={css.fontRow}><span style={{ fontFamily: `"${fontById(f.id).family}"` }}>{f.label}</span><small>{f.scripts.includes("devanagari") ? "Latin + Devanagari" : "Latin only"}</small>
        <button type="button" className={css.icon} aria-label={`Remove ${f.label}`} onClick={() => { void removeCustomFont(f.id); setCustomFonts(customFonts.filter(x => x.id !== f.id)); if (style.font === f.id) update("font", "poppins"); }}><Trash2 aria-hidden size={16} /></button></div>)}
    </Section>

    <Section title="Saved styles">
      <div className={css.actions}>
        <button type="button" className={styles.secondary} onClick={() => { const name = `My style ${saved.length + 1}`; persist([...saved, { name, style: { ...style, preset: "custom" } }]); }}>Save current style</button>
      </div>
      {saved.length === 0 ? <p className={styles.help}>Saved styles stay in this browser.</p> : saved.map((item, i) => <div key={i} className={css.fontRow}><button type="button" className={css.text} onClick={() => setStyle(item.style)}>{item.name}</button>
        <button type="button" className={css.icon} aria-label={`Delete ${item.name}`} onClick={() => persist(saved.filter((_, j) => j !== i))}><Trash2 aria-hidden size={16} /></button></div>)}
    </Section>
  </div>;
}

function Range({ label, value, min, max, step, unit = "", onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (value: number) => void }) {
  return <label className={styles.group}><span className={styles.label}>{label}<span className={styles.value}>{Number.isInteger(step) ? value : value.toFixed(2)}{unit}</span></span>
    <input className={styles.range} type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></label>;
}
function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className={styles.group}><span className={styles.label}>{label}</span><input className={css.color} type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={event => onChange(event.target.value)} /></label>;
}

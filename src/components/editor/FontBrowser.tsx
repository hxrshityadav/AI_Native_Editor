"use client";
import { useEffect, useRef, useState } from "react";
import { FONT_CATEGORIES, importFont, loadLibraryFont, removeLocalFont, renameLocalFont, type FontRecord } from "@/lib/editor/fontLibrary";
import { localDb } from "@/lib/localDb";
import type { ReelSession } from "./useReelSession";

export function FontBrowser({ session: s }: { session: ReelSession }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sample, setSample] = useState("Create your next story · नमस्ते");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState<FontRecord | null>(null);
  useEffect(() => { void localDb().then(async (db) => {
    const saved = await db.get("settings", "fontPreferences") as { favorites?: string[]; recent?: string[] } | undefined;
    if (Array.isArray(saved?.favorites)) setFavorites(saved.favorites.filter((id) => typeof id === "string"));
    if (Array.isArray(saved?.recent)) setRecent(saved.recent.filter((id) => typeof id === "string"));
  }).catch(() => setProblem("Font preferences couldn't be restored. Browser storage may be unavailable.")); }, []);
  const selected = s.editing.settings.appearance.font ?? s.style.font;
  const choose = async (font: FontRecord) => {
    try {
      await loadLibraryFont(font, document.fonts);
      s.editing.update({ appearance: { ...s.editing.settings.appearance, font: font.id, weight: font.weights.includes(s.style.weight ?? 0) ? s.style.weight : font.weights[0] } });
      const next = [font.id, ...recent.filter((id) => id !== font.id)].slice(0, 8);
      setRecent(next);
      await (await localDb()).put("settings", { favorites, recent: next }, "fontPreferences");
      setProblem("");
    } catch { setProblem("Couldn't load or save this font. Retry, or choose a bundled font."); }
  };
  const visible = s.fonts.filter((font) => font.label.toLowerCase().includes(query.toLowerCase()) &&
    (category === "All" || category === font.category || category === "Favorites" && favorites.includes(font.id) || category === "Recent" && recent.includes(font.id)));
  return <details className="border-t border-line pt-3" open>
    <summary className="cursor-pointer font-medium">Font library</summary>
    <div className="mt-3 flex flex-col gap-3 text-sm">
      <input className="min-h-10 rounded border bg-panel px-2" placeholder="Search fonts" aria-label="Search fonts" value={query} onChange={(e) => setQuery(e.target.value)} />
      <select className="min-h-10 rounded border bg-panel p-2" aria-label="Font category" value={category} onChange={(e) => setCategory(e.target.value)}>
        {["All", ...FONT_CATEGORIES, "Favorites", "Recent"].map((name) => <option key={name}>{name}</option>)}
      </select>
      <input className="min-h-10 rounded border bg-panel px-2" aria-label="Font preview text" value={sample} onChange={(e) => setSample(e.target.value)} />
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto" role="list" aria-label="Font choices">
        {visible.map((font) => <div key={font.id} role="listitem" className="rounded border border-line p-2">
          <div className="flex gap-2">
            <button type="button" aria-pressed={selected === font.id} className="min-h-10 flex-1 text-left" onClick={() => void choose(font)}>
              <span className="font-medium">{font.label}{selected === font.id ? " ✓" : ""}</span>
              <FontSample font={font} text={sample} />
            </button>
            <button className="min-h-10 px-2" type="button" aria-label={`Favorite ${font.label}`} aria-pressed={favorites.includes(font.id)} onClick={() => {
              const next = favorites.includes(font.id) ? favorites.filter((id) => id !== font.id) : [...favorites, font.id];
              setFavorites(next); void localDb().then((db) => db.put("settings", { favorites: next, recent }, "fontPreferences")).catch(() => setProblem("Couldn't save favorites. Check browser storage."));
            }}>{favorites.includes(font.id) ? "★" : "☆"}</button>
          </div>
          {font.id.startsWith("local:") && <div className="flex gap-3 text-xs">
            <button type="button" className="min-h-10 underline" onClick={() => {
              const label = window.prompt("Rename font", font.label);
              if (label?.trim()) void renameLocalFont(font, label).then(s.refreshFonts).catch(() => setProblem("Couldn't rename the font. Use a name of 1–60 characters."));
            }}>Rename</button>
            <button type="button" className="min-h-10 underline" onClick={() => {
              if (window.confirm(`Remove ${font.label} from this browser? Projects using it will need another font.`)) void removeLocalFont(font.id).then(s.refreshFonts).catch(() => setProblem("Couldn't remove the font. Try again."));
            }}>Remove</button>
          </div>}
        </div>)}
        {!visible.length && <p>No matching fonts. Clear the search or change category.</p>}
      </div>
      <label>Upload a local font (up to 10 MB)
        <input type="file" aria-label="Upload font" accept=".woff,.woff2,.ttf,.otf" disabled={busy} className="mt-2 block w-full" onChange={async (e) => {
          const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
          setBusy(true); setProblem("");
          try { const font = await importFont(file); setCandidate(font); await s.refreshFonts(); }
          catch (error) { setProblem(error instanceof Error ? error.message : "Font import failed. Try another file."); }
          finally { setBusy(false); }
        }} />
      </label>
      {busy && <p role="status">Parsing and storing font locally…</p>}
      {candidate && <div className="rounded border p-2"><p style={{ fontFamily: `"${candidate.family}", sans-serif` }}>{sample}</p>
        <button type="button" className="min-h-10 underline" onClick={() => { void choose(candidate); setCandidate(null); }}>Apply uploaded font</button></div>}
      {problem && <p role="alert" className="text-red-700">{problem}</p>}
      <p className="text-xs text-muted">Font files stay in this browser. Use fonts you have permission to use. Clearing site data removes uploads; private browsing and storage quotas can prevent saving. Unselected fonts load when previewed or selected. Extra Latin families fall back to the bundled font for Devanagari.</p>
      <label>Weight <select aria-label="Font weight" className="ml-2 min-h-10 rounded border bg-panel p-2" value={s.style.weight ?? (s.fonts.find((f) => f.id === selected)?.weights[0] ?? 700)}
        onChange={(e) => s.editing.update({ appearance: { ...s.editing.settings.appearance, weight: Number(e.target.value) } })}>
        {(s.fonts.find((font) => font.id === selected)?.weights ?? [700]).map((weight) => <option key={weight} value={weight}>{selected.startsWith("local:") ? "Native font weight" : weight}</option>)}
      </select></label>
    </div>
  </details>;
}

function FontSample({ font, text }: { font: FontRecord; text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    let current = true;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void loadLibraryFont(font, document.fonts).then(() => current && setLoaded(true), () => current && setFailed(true));
    });
    observer.observe(ref.current);
    return () => { current = false; observer.disconnect(); };
  }, [font]);
  return <span ref={ref} className="block text-lg" style={{ fontFamily: loaded ? `"${font.family}", sans-serif` : undefined }}>{loaded ? text : failed ? "Font preview unavailable" : "Loading font preview…"}</span>;
}

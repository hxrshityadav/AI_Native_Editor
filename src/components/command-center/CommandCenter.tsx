"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, AudioLines, Clock3, Command, Heart, Image as ImageIcon, LayoutGrid, LayoutDashboard, Search, Settings2, ShieldCheck, Sparkles, Star, Trash2, Video, type LucideIcon } from "lucide-react";
import { CATEGORIES, type ToolCategory, type ToolEntry } from "@/lib/tools/catalog";
import { QUICK_ACTIONS, commandTools, searchTools, toolByHref, type CategoryFilter } from "@/lib/command-center/catalog";
import { TOOL_ICONS } from "@/components/site/toolIcons";
import { buttonClass } from "@/components/site/ui";
import { CommandPaletteLauncher } from "./CommandPalette";
import { useWorkspace, workspaceStore } from "./useWorkspace";
import "./command-center.css";

type View = "overview" | "all" | ToolCategory | "favorites" | "recent" | "settings";
const NAV: { id: View; label: string; icon: LucideIcon }[][] = [
  [{ id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "all", label: "All tools", icon: LayoutGrid }],
  [{ id: "photo", label: "Photo", icon: ImageIcon }, { id: "video", label: "Video", icon: Video }, { id: "audio", label: "Audio", icon: AudioLines }, { id: "ai", label: "AI Studio", icon: Sparkles }],
  [{ id: "favorites", label: "Favorites", icon: Heart }, { id: "recent", label: "Recent activity", icon: Clock3 }, { id: "settings", label: "Settings", icon: Settings2 }],
];
const VIEW_IDS = NAV.flat().map(item => item.id);
const isView = (value: string): value is View => (VIEW_IDS as string[]).includes(value);
const isCategory = (view: View): view is ToolCategory => CATEGORIES.some(category => category.id === view);
const count = (category: ToolCategory) => commandTools.filter(tool => tool.category === category).length;
const timeFormat = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }) : undefined;
function ago(at: number, now: number) {
  const minutes = Math.round((at - now) / 60000);
  if (!timeFormat) return "";
  if (Math.abs(minutes) < 60) return timeFormat.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  return Math.abs(hours) < 24 ? timeFormat.format(hours, "hour") : timeFormat.format(Math.round(hours / 24), "day");
}

function ToolCollection({ tools, favorites, empty, times }: { tools: ToolEntry[]; favorites: string[]; empty: string; times?: Map<string, string> }) {
  if (!tools.length) return <div className="cc-empty"><Search aria-hidden size={22} /><p>{empty}</p></div>;
  return <ul className="cc-tool-list">{tools.map(tool => { const Icon = TOOL_ICONS[tool.icon], pinned = favorites.includes(tool.href!); return <li key={tool.href}>
    <Link prefetch={false} href={tool.href!}><Icon aria-hidden size={20} strokeWidth={1.75} /><div><h3>{tool.title}</h3><p>{tool.summary}</p><span>{times?.get(tool.href!) ?? tool.formats.slice(0, 4).join(" · ")}</span></div></Link>
    <button type="button" className="cc-pin" onClick={() => workspaceStore.toggleFavorite(tool.href!)} aria-pressed={pinned} aria-label={`${pinned ? "Unpin" : "Pin"} ${tool.title}`} title={pinned ? "Remove from favorites" : "Add to favorites"}><Star aria-hidden size={18} fill={pinned ? "currentColor" : "none"} /></button>
  </li>; })}</ul>;
}

function Directory({ category, favorites }: { category: CategoryFilter; favorites: string[] }) {
  const [query, setQuery] = useState("");
  const matched = searchTools(query, category), meta = category === "all" ? undefined : CATEGORIES.find(item => item.id === category);
  return <section aria-labelledby="directory-title">
    <div className="cc-section-title"><div><h2 id="directory-title">{meta ? meta.title : "All tools"}</h2><p>{meta ? meta.blurb : "Every working tool in the catalog. Pin a tool to keep it close."}</p></div></div>
    <label className="cc-search"><Search aria-hidden size={19} /><input type="search" aria-label={`Search ${meta ? meta.title.toLowerCase() : "all tools"}`} placeholder="Search by name or format…" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" spellCheck={false} /></label>
    <p className="cc-result-count" role="status">{matched.length} {matched.length === 1 ? "tool" : "tools"}{query.trim() ? ` match “${query.trim()}”` : ""}</p>
    <ToolCollection tools={matched} favorites={favorites} empty="No tool matches. Try a format such as MP4 or WAV, or clear the search." />
  </section>;
}

export function CommandCenter() {
  const state = useWorkspace();
  const [view, setViewState] = useState<View>("overview"), [now, setNow] = useState(0);
  useEffect(() => {
    const read = () => { const hash = location.hash.slice(1); setViewState(isView(hash) ? hash : "overview"); };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The hash and the clock are browser state, read after hydration so server and client markup match.
    read(); setNow(Date.now());
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    // On narrow screens the rail scrolls sideways: keep the current section in view without moving the page.
    const rail = document.querySelector<HTMLElement>(".cc-rail"), current = rail?.querySelector<HTMLElement>("[aria-current]");
    if (rail && current && rail.scrollWidth > rail.clientWidth) rail.scrollLeft = current.offsetLeft - rail.clientWidth / 2 + current.offsetWidth / 2;
  }, [view]);
  function setView(next: View) {
    setViewState(next);
    history.replaceState(null, "", next === "overview" ? location.pathname : `#${next}`);
    document.getElementById("cc-main")?.focus({ preventScroll: true });
  }
  const favorites = state.favorites.map(href => toolByHref.get(href)!).filter(Boolean), recent = state.recent.map(visit => toolByHref.get(visit.href)!).filter(Boolean);
  const times = new Map(now ? state.recent.map(visit => [visit.href, `Opened ${ago(visit.visitedAt, now)}`]) : []);
  const firstRun = state.loaded && !favorites.length && !recent.length;
  const badge = (id: View) => id === "favorites" ? favorites.length : id === "recent" ? recent.length : isCategory(id) ? count(id) : id === "all" ? commandTools.length : undefined;

  return <main className="command-center-page">
    <header className="cc-header">
      <div><h1>Command Center</h1><p>Find a tool, pin the ones you use, and pick up where you left off. Everything here stays in this browser; your files stay inside each tool.</p></div>
      <div className="cc-header-search"><CommandPaletteLauncher /></div>
    </header>
    {state.loaded && state.storage === "temporary" && <p className="cc-storage-message" role="status">Browser storage is unavailable, so favorites and visits last only while this tab is open. Allow site storage for this site to keep them.</p>}
    {state.loaded && state.storage === "recovered" && <p className="cc-storage-message" role="status">Your saved Command Center preferences could not be read, so they were reset. Pin your tools again; Studio projects and other site data are untouched.</p>}
    <div className="cc-layout">
      <nav className="cc-rail" aria-label="Command Center sections">{NAV.map((group, index) => <ul key={index}>{group.map(item => { const total = badge(item.id); return <li key={item.id}>
        <button type="button" aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}><item.icon aria-hidden size={17} strokeWidth={1.75} /><span>{item.label}</span>{total !== undefined && <small className="tabular">{total}</small>}</button>
      </li>; })}</ul>)}</nav>
      <div id="cc-main" className="cc-main" tabIndex={-1}>
        {view === "overview" && <>
          {firstRun && <section className="cc-onboarding" aria-labelledby="onboarding-title">
            <h2 id="onboarding-title">Start in three moves</h2>
            <ol><li><Command aria-hidden size={20} /><p><strong>Press Ctrl K</strong> (⌘ K on a Mac) on any page to jump to a tool.</p></li><li><Star aria-hidden size={20} /><p><strong>Pin a tool</strong> with its star. It appears here next time.</p></li><li><Clock3 aria-hidden size={20} /><p><strong>Open any tool.</strong> Recent activity lists it, and only its name.</p></li></ol>
          </section>}
          <section className="cc-quick" aria-labelledby="quick-actions"><div className="cc-section-title"><h2 id="quick-actions">Quick actions</h2><p>Open a tool, then choose your file there.</p></div>
            <ul>{QUICK_ACTIONS.map(tool => { const Icon = TOOL_ICONS[tool.icon]; return <li key={tool.href}><Link prefetch={false} href={tool.href!}><Icon aria-hidden size={20} strokeWidth={1.75} /><span>{tool.navLabel}</span><small>{tool.formats.slice(0, 3).join(" · ")}</small></Link></li>; })}</ul>
          </section>
          <div className="cc-overview-grid">
            <section aria-labelledby="overview-favorites"><div className="cc-section-title"><h2 id="overview-favorites">Favorites</h2>{favorites.length > 4 && <button type="button" onClick={() => setView("favorites")}>All {favorites.length} <ArrowUpRight aria-hidden size={15} /></button>}</div><ToolCollection tools={favorites.slice(0, 4)} favorites={state.favorites} empty="Nothing pinned yet. Use the star next to any tool, here or in All tools." /></section>
            <section aria-labelledby="overview-recent"><div className="cc-section-title"><h2 id="overview-recent">Recently opened</h2>{recent.length > 4 && <button type="button" onClick={() => setView("recent")}>All {recent.length} <ArrowUpRight aria-hidden size={15} /></button>}</div><ToolCollection tools={recent.slice(0, 4)} favorites={state.favorites} times={times} empty={state.recordHistory ? "Tools you open appear here. File names and results are never recorded." : "Visit history is paused. Turn it back on in Settings."} /></section>
          </div>
          <section className="cc-categories" aria-labelledby="categories-title"><div className="cc-section-title"><h2 id="categories-title">Browse by category</h2></div>
            <ul>{CATEGORIES.map(category => <li key={category.id}><button type="button" onClick={() => setView(category.id)}><strong>{category.id === "ai" ? "AI Studio" : category.title}</strong><span>{category.blurb}</span><small className="tabular">{count(category.id)} tools</small></button></li>)}</ul>
          </section>
        </>}
        {(view === "all" || isCategory(view)) && <Directory key={view} category={view} favorites={state.favorites} />}
        {view === "favorites" && <section aria-labelledby="favorites-title"><div className="cc-section-title"><div><h2 id="favorites-title">Favorites</h2><p>Pinned tools, saved only in this browser.</p></div><button type="button" className="cc-clear" disabled={!favorites.length} onClick={() => workspaceStore.clearFavorites()}><Trash2 aria-hidden size={16} />Clear favorites</button></div><ToolCollection tools={favorites} favorites={state.favorites} empty="No favorites yet. Open All tools and pin the ones you want to keep close." />{!favorites.length && <button type="button" className={buttonClass("secondary")} onClick={() => setView("all")}>Find tools to pin</button>}</section>}
        {view === "recent" && <section aria-labelledby="recent-title"><div className="cc-section-title"><div><h2 id="recent-title">Recent activity</h2><p>Up to twelve tools you opened recently. These are page visits, not processing jobs.</p></div><button type="button" className="cc-clear" disabled={!recent.length} onClick={() => workspaceStore.clearHistory()}><Trash2 aria-hidden size={16} />Clear recent activity</button></div><ToolCollection tools={recent} favorites={state.favorites} times={times} empty={state.recordHistory ? "Nothing opened yet. Open a tool and it appears here; no file or transcript data is recorded." : "History is paused. Turn it on in Settings to remember tool visits."} /></section>}
        {view === "settings" && <section className="cc-settings" aria-labelledby="settings-title"><h2 id="settings-title">Settings</h2><p>These preferences belong to this browser. There is no sign-in and nothing is synchronised.</p>
          <label className="cc-setting"><span><strong>Remember recently opened tools</strong><small>Stores only tool routes and visit times. Turning this off stops new records; existing visits stay until you clear them.</small></span><input type="checkbox" checked={state.recordHistory} onChange={event => workspaceStore.setRecordHistory(event.target.checked)} /></label>
          <div className="cc-setting"><span><strong>Clear recent activity</strong><small>Removes the list of tool visits.</small></span><button type="button" className="cc-clear" disabled={!recent.length} onClick={() => workspaceStore.clearHistory()}>Clear history</button></div>
          <div className="cc-setting"><span><strong>Clear favorites</strong><small>Removes pinned tools. You can pin them again at any time.</small></span><button type="button" className="cc-clear" disabled={!favorites.length} onClick={() => workspaceStore.clearFavorites()}>Clear favorites</button></div>
          <p className="cc-safety"><ShieldCheck aria-hidden size={20} />These controls never remove Studio projects, source media, downloaded AI models or any other stored data.</p>
          <Link prefetch={false} href="/privacy">Read the privacy notes <ArrowUpRight aria-hidden size={15} /></Link>
        </section>}
      </div>
    </div>
  </main>;
}

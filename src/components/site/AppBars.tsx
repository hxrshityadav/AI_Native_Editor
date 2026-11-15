"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Command, House, LayoutGrid, Moon, Search, Sun } from "lucide-react";
import { openCommandPalette } from "@/components/command-center/CommandPalette";

/** Desktop top bar: a wide search pill that opens the one command palette, the Command Center and the theme. */
export function TopBar() {
  return <div className="top-bar">
    <button type="button" className="search-pill" onClick={openCommandPalette} aria-label="Open command palette" aria-haspopup="dialog">
      <Search aria-hidden size={16} strokeWidth={1.75} /><span>Search tools, formats or tasks</span><kbd>Ctrl K</kbd>
    </button>
    <nav aria-label="Workspace" className="top-bar-cluster">
      <ThemeToggle />
      <Link prefetch={false} href="/command-center"><Command aria-hidden size={16} />Command Center</Link>
    </nav>
  </div>;
}

const TABS = [{ href: "/", label: "Home", icon: House }, { href: "/tools", label: "Tools", icon: LayoutGrid }, { href: "/command-center", label: "Command", icon: Command }];

/** Phone navigation: four thumb-reach tabs; Search opens the palette. The full tool list stays in the Menu drawer. */
export function BottomTabs() {
  const path = usePathname();
  return <nav aria-label="Primary" className="bottom-tabs">
    {TABS.map(({ href, label, icon: Icon }) => { const current = href === "/" ? path === "/" : path.startsWith(href); return <Link key={href} prefetch={false} href={href} aria-current={current ? "page" : undefined}><Icon aria-hidden size={22} strokeWidth={1.75} /><span>{label}</span></Link>; })}
    <button type="button" onClick={openCommandPalette} aria-haspopup="dialog"><Search aria-hidden size={22} strokeWidth={1.75} /><span>Search</span></button>
  </nav>;
}

export const THEME_KEY = "rf-site-theme";
/** Dark is the default. The choice is a per-browser convenience; the pre-paint script in SiteShell applies it. */
export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The attribute is set before paint by SiteShell; read it after hydration.
    setLight(document.documentElement.dataset.siteTheme === "light");
  }, []);
  function toggle() {
    const next = !light; setLight(next);
    if (next) document.documentElement.dataset.siteTheme = "light"; else delete document.documentElement.dataset.siteTheme;
    try { localStorage.setItem(THEME_KEY, next ? "light" : "dark"); } catch { /* not remembered */ }
  }
  const Icon = light ? Moon : Sun;
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={light ? "Switch to dark theme" : "Switch to light theme"} title={light ? "Switch to dark theme" : "Switch to light theme"}><Icon aria-hidden size={18} /></button>;
}

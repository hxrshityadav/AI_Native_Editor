"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
export function EditorHost() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [revision, setRevision] = useState(0);
  const requestReady = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: "reelfinisher:probe" }, location.origin);
  }, []);
  useEffect(() => {
    const message = (event: MessageEvent) => { if (event.origin === location.origin && event.source === frame.current?.contentWindow && event.data?.type === "reelfinisher:ready") setReady(true); };
    window.addEventListener("message", message);
    requestReady();
    const timer = setTimeout(() => setSlow(true), 30000);
    void navigator.serviceWorker?.register("/studio-sw.js", { scope: "/studio" }).catch(() => {});
    return () => { clearTimeout(timer); window.removeEventListener("message", message); };
  }, [revision, requestReady]);
  const focus = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]";
  return <main className="flex h-dvh flex-col bg-black">
    <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-edge bg-raised px-3 text-xs text-ink">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link href="/" className={"inline-flex min-h-8 items-center gap-1.5 rounded font-semibold " + focus}><span aria-hidden className="rounded-[4px] bg-accent px-1 py-px text-[0.7rem] font-bold leading-none text-accent-ink">RF</span>Reel Finisher</Link>
        <span className="hidden items-center gap-1 text-subtle sm:inline-flex"><ShieldCheck aria-hidden className="size-3.5 text-brand" />Local browser editor</span>
      </div>
      <a className={"inline-flex min-h-8 items-center rounded px-2 text-subtle underline-offset-4 hover:bg-sunken hover:text-ink hover:underline " + focus} href="/studio-legacy">Legacy editor</a>
    </header>
    {!ready && <div role="status" className="absolute inset-x-0 top-14 z-10 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-edge bg-raised px-4 py-3 text-sm text-ink shadow-panel">
      {!slow && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-edge-strong border-t-[var(--brand)] motion-reduce:animate-none" />}
      <span>{slow ? "The editor is taking longer to load. Retry, or open the legacy editor above." : "Loading the editor…"}</span>
      {slow && <button className={"min-h-10 rounded-[var(--radius-control)] border border-edge-strong px-3 font-semibold hover:bg-sunken " + focus} onClick={() => { setReady(false); setSlow(false); setRevision((n) => n + 1); }}>Retry</button>}
    </div>}
    <iframe key={revision} ref={frame} title="Reel Finisher video editor" src="/editor/index.html" onLoad={requestReady} allow="cross-origin-isolated; fullscreen; clipboard-read; clipboard-write" className="min-h-0 w-full flex-1 border-0" />
  </main>;
}

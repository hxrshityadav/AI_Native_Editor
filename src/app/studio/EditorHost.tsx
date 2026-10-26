"use client";
import { useEffect, useRef, useState } from "react";
export function EditorHost() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const message = (event: MessageEvent) => { if (event.origin === location.origin && event.source === frame.current?.contentWindow && event.data?.type === "reelfinisher:ready") setReady(true); };
    window.addEventListener("message", message);
    const timer = setTimeout(() => setSlow(true), 30000);
    void navigator.serviceWorker?.register("/studio-sw.js", { scope: "/studio" }).catch(() => {});
    return () => { clearTimeout(timer); window.removeEventListener("message", message); };
  }, [revision]);
  return <main className="flex h-dvh flex-col bg-black">
    <div className="flex h-8 shrink-0 items-center justify-between bg-panel px-3 text-xs text-foreground"><span>Reel Finisher · Local browser editor</span><a className="underline" href="/studio-legacy">Legacy editor</a></div>
    {!ready && <div role="status" className="absolute inset-x-0 top-10 z-10 mx-auto w-fit rounded bg-panel p-4 text-sm text-foreground">{slow ? "The editor is taking longer to load. Retry, or open the legacy editor above." : "Loading the editor…"}{slow && <button className="ml-3 min-h-10 rounded border px-3" onClick={() => { setReady(false); setSlow(false); setRevision((n) => n + 1); }}>Retry</button>}</div>}
    <iframe key={revision} ref={frame} title="Reel Finisher video editor" src="/editor/index.html" allow="cross-origin-isolated; fullscreen; clipboard-read; clipboard-write" className="min-h-0 w-full flex-1 border-0" />
  </main>;
}

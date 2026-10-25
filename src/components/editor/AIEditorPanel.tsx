"use client";
import { useEffect, useRef, useState } from "react";
import { applyOperations, editPlanSchema } from "@/lib/editor/operations";
import type { ReelSession } from "./useReelSession";
import { HumanCheck } from "./HumanCheck";

export function AIEditorPanel({ session: s, onSilence }: { session: ReelSession; onSilence: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState("");
  const [base, setBase] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [setup, setSetup] = useState<string | null>("Checking AI configuration…");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const revision = JSON.stringify([s.fingerprint, s.editing.settings, s.captionSegments]);
  useEffect(() => { let active = true; void fetch("/api/edit-plan").then((r) => r.json()).then((c) => { if (active) setSetup(c.setupError ?? null); }).catch(() => { if (active) setSetup("AI configuration is unavailable. Reload or edit manually."); }); return () => { active = false; abort.current?.abort(); }; }, []);
  const request = async () => {
    setBusy(true); setProblem(null); setPlan(""); const controller = new AbortController(); abort.current = controller;
    try {
      const response = await fetch("/api/edit-plan", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", ...(s.humanCheck.status === "on" && s.humanCheck.token ? { "x-turnstile-token": s.humanCheck.token } : {}) }, body: JSON.stringify({ prompt, context: { duration: s.probe?.durationSec, selection: s.selection, fontIds: s.fonts.map((font) => font.id), captions: s.captionSegments.map(({ id, start, end }) => ({ id, start, end })) } }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "AI request failed. Retry.");
      const parsed = editPlanSchema.parse(result); setBase(revision); setPlan(JSON.stringify(parsed, null, 2));
    } catch (error) { if (!controller.signal.aborted) setProblem(error instanceof Error ? error.message : "AI planning failed. Retry."); }
    finally { setBusy(false); s.resetHumanCheck(); }
  };
  const apply = () => {
    try {
      if (base !== revision) throw new Error("The project changed after this plan was created. Generate a new plan before applying.");
      const parsed = editPlanSchema.parse(JSON.parse(plan));
      applyOperations(s.editing.settings, s.captionSegments, parsed.operations, s.probe?.durationSec ?? 0, s.fonts.map((font) => font.id));
      if (!s.applyEdit(parsed.operations)) return;
      const silence = parsed.operations.find((op) => op.type === "detect_silence");
      if (silence?.type === "detect_silence") { void s.analyzeSilence({ ...s.silenceOptions, minimum: silence.minimum, threshold: silence.threshold }); onSilence(); }
      setPlan(""); setProblem(null);
    } catch (error) { setProblem(error instanceof SyntaxError ? "Plan JSON is invalid. Correct it or generate again." : error instanceof Error && !error.message.startsWith("[") ? error.message : "Plan contains unsupported or invalid operations. Nothing was changed."); }
  };
  const button = "min-h-10 rounded border border-line px-3 text-sm disabled:opacity-40";
  return <div className="flex flex-col gap-3 text-sm">
    <p>Describe an edit, review the structured plan, then apply it. Manual and AI edits use the same engine and Undo.</p>
    <p className="rounded border border-line p-2 text-xs">Sent to Groq: your instruction, selected item ID, clip duration, available font IDs and caption IDs/times. Video, audio, transcript text and fonts stay local. Text you type in your instruction is sent. <a className="underline" href="https://groq.com/privacy-policy/" target="_blank" rel="noreferrer">Groq privacy</a></p>
    {setup && <p role="status">{setup}</p>}
    <label>Editing instruction<textarea aria-label="AI editing instruction" maxLength={2000} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Use large yellow captions and switch to 9:16" className="mt-1 min-h-24 w-full rounded border bg-panel p-2" /></label>
    <HumanCheck session={s} />
    <button className={button} disabled={!!setup || busy || !prompt.trim() || !s.ready || !s.humanReady} onClick={() => void request()}>{busy ? "Creating plan…" : "Generate edit plan"}</button>
    {busy && <button className={button} onClick={() => abort.current?.abort()}>Cancel planning</button>}
    {problem && <p role="alert">{problem}</p>}
    {plan && <><label>Review & edit plan<textarea aria-label="AI edit plan" value={plan} onChange={(e) => setPlan(e.target.value)} className="mt-1 min-h-64 w-full rounded border bg-panel p-2 font-mono text-xs" /></label>{base !== revision && <p role="alert">Project changed. Generate a new plan.</p>}<button className={button} disabled={base !== revision} onClick={apply}>Apply reviewed plan</button><button className={button} onClick={() => setPlan("")}>Discard plan</button></>}
  </div>;
}

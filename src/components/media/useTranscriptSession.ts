"use client";
import { useState } from "react";
import { runMediaTask } from "@/lib/mediatools/client";
import type { MediaInfo } from "@/lib/mediatools/engine";
import { runSpeech, type Transcript } from "@/lib/localtools/speechClient";
import type { Cue } from "@/lib/localtools/text";
import { useLocalJob } from "./useLocalJob";

/** Shared local transcription input for creator tools; existing worker remains the sole ASR engine. */
export function useTranscriptSession(videoOnly = false) {
  const [file, setFile] = useState<File>(), [cues, setCues] = useState<Cue[]>([]), [language, setLanguage] = useState("auto"), [consent, setConsent] = useState(false), [error, setError] = useState("");
  const inspect = useLocalJob<MediaInfo>(), speech = useLocalJob<Transcript>();
  const busy = inspect.busy || speech.busy, info = inspect.result;
  function reset() { inspect.reset(); speech.reset(); setCues([]); setError(""); }
  function clear() { reset(); setFile(undefined); }
  async function load(files: FileList) {
    reset(); const selected = files[0];
    if (files.length !== 1 || !selected?.size || selected.size > 512 * 1048576) { setFile(undefined); setError("Choose one non-empty recording up to 512 MiB."); return; }
    setFile(selected);
    await inspect.run(signal => runMediaTask({ kind: "inspect", file: selected, expect: videoOnly ? "video" : "any" }, signal));
  }
  async function recognize() {
    if (!file || !info || !consent) return;
    setCues([]); setError("");
    const transcript = await speech.run((signal, status, progress) => runSpeech<Transcript>({ kind: "transcribe", file, language, translate: false, longRecording: true }, signal, status, progress));
    if (transcript) {
      if (transcript.cues.length > 1000) setError("This transcript has too many segments. Trim the recording and retry.");
      else setCues(transcript.cues);
    }
  }
  function edit(index: number, update: Partial<Cue>) { setCues(current => current.map((cue, i) => i === index ? { ...cue, ...update } : cue)); }
  function add() { if (!info || cues.length >= 1000) return; const start = cues.at(-1)?.end ?? 0; if (start < info.duration) setCues([...cues, { start, end: Math.min(info.duration, start + 5), text: "" }]); }
  function cancel() { if (inspect.busy) inspect.cancel(); else speech.cancel(); }
  return { file, info, cues, setCues, language, setLanguage, consent, setConsent, busy, load, recognize, edit, add, cancel, reset, clear,
    error: error || inspect.error || speech.error, notice: inspect.notice || speech.notice, progress: speech.progress, elapsed: inspect.busy ? inspect.elapsed : speech.elapsed };
}

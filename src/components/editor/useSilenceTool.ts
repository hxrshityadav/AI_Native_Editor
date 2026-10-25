"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AnalysisCanceledError, analyzeInWorker } from "@/lib/edit/analyzeInWorker";
import { DEFAULT_SILENCE_SETTINGS, detectSilence, type SilenceSettings } from "@/lib/edit/silence";
import { buildTimeMap, replaceOrigin, type EditDecisionList, type EditInterval } from "@/lib/edit/timeline";
import type { Problem } from "@/lib/media/errors";

export type SilenceAnalysis =
  | { status: "idle" }
  | { status: "running"; progress: number }
  | { status: "ready"; levels: Float32Array }
  | { status: "error"; problem: Problem };

/**
 * The Remove Silence tool: measure levels on this device, suggest cuts, let the user review them.
 * It never edits by itself: `apply` hands the reviewed intervals to the caller's undoable EDL.
 */
export function useSilenceTool({
  durationSec,
  applied,
  getSpeechAudio,
  onApply,
}: {
  durationSec: number;
  /** The EDL currently applied; a review shows it with this tool's suggestions swapped in. */
  applied: EditDecisionList;
  /** The speech audio extracted on this device (extracting it first if needed), or null if that failed. */
  getSpeechAudio: () => Promise<Blob | null>;
  onApply: (next: EditDecisionList) => void;
}) {
  const [analysis, setAnalysis] = useState<SilenceAnalysis>({ status: "idle" });
  const [settings, setSettingsState] = useState<SilenceSettings>(DEFAULT_SILENCE_SETTINGS);
  /** Indexes of suggestions the user chose to keep. Cleared when the settings change the suggestions. */
  const [kept, setKept] = useState<ReadonlySet<number>>(new Set());
  const [reviewing, setReviewing] = useState(false);
  const handle = useRef<{ cancel: () => void } | null>(null);

  const detection = useMemo(
    () => (analysis.status === "ready" ? detectSilence(analysis.levels, durationSec, settings) : null),
    [analysis, durationSec, settings],
  );
  const proposed: EditInterval[] = useMemo(
    () => (detection?.intervals ?? []).map((iv, i) => (kept.has(i) ? { ...iv, action: "keep" as const } : iv)),
    [detection, kept],
  );
  const proposedEdl = useMemo(() => replaceOrigin(applied, "silence", proposed), [applied, proposed]);
  const reviewMap = useMemo(
    () => (reviewing && durationSec > 0 ? buildTimeMap(durationSec, proposedEdl) : null),
    [reviewing, durationSec, proposedEdl],
  );

  async function analyze() {
    setAnalysis({ status: "running", progress: 0 });
    const audio = await getSpeechAudio();
    if (!audio) {
      return setAnalysis({
        status: "error",
        problem: { message: "Couldn't prepare the audio to analyse.", action: "Check the error above, then try again." },
      });
    }
    const job = analyzeInWorker(audio, (progress) => setAnalysis({ status: "running", progress }));
    handle.current = job;
    try {
      const levels = await job.result;
      setKept(new Set());
      setAnalysis({ status: "ready", levels });
      setReviewing(true);
    } catch (err) {
      setAnalysis(
        err instanceof AnalysisCanceledError
          ? { status: "idle" }
          : {
              status: "error",
              problem: {
                message: `Couldn't analyse the audio on this device (${err instanceof Error ? err.message : "unknown error"}).`,
                action: "Try again. If it keeps failing, use the latest Chrome.",
              },
            },
      );
    } finally {
      handle.current = null;
    }
  }

  const setSettings = useCallback((next: SilenceSettings) => {
    setSettingsState(next);
    setKept(new Set()); // indexes no longer match once the suggestions change
  }, []);

  return {
    analysis,
    analyze,
    cancelAnalysis: () => handle.current?.cancel(),
    settings,
    setSettings,
    resetSettings: () => setSettings(DEFAULT_SILENCE_SETTINGS),
    detection,
    proposed,
    toggle: (index: number) =>
      setKept((s) => {
        const next = new Set(s);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      }),
    reviewing,
    review: () => setReviewing(true),
    reviewMap,
    apply: () => {
      onApply(proposedEdl);
      setReviewing(false);
    },
    cancelReview: () => setReviewing(false),
    reset: () => {
      handle.current?.cancel();
      setAnalysis({ status: "idle" });
      setKept(new Set());
      setReviewing(false);
    },
  };
}

export type SilenceTool = ReturnType<typeof useSilenceTool>;

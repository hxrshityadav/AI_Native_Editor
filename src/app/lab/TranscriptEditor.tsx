"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import {
  mergeWithNext,
  NUDGE_SEC,
  removeWord,
  replaceWordText,
  shiftEdge,
  wordIndexAt,
  type Word,
} from "@/lib/captions";

type Props = {
  words: Word[];
  onChange: (words: Word[]) => void;
  onUndo: () => void;
  canUndo: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Video duration; word ends can't move past it. */
  maxEnd: number;
};

export function TranscriptEditor({ words, onChange, onUndo, canUndo, videoRef, maxEnd }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const playing = usePlayingWord(words, videoRef);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // After a keyboard action, keep focus on the selected word so the next key press still lands in
  // the editor. A layout effect runs in the same commit as the key event, so there is no window in
  // which focus sits on <body> (a deleted button would otherwise drop it there).
  const pendingFocus = useRef<number | null>(null);
  const focusWord = (k: number) => {
    pendingFocus.current = k;
  };
  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    listRef.current?.querySelectorAll<HTMLElement>('[data-testid="word"]')[pendingFocus.current]?.focus();
    pendingFocus.current = null;
  });

  const sel = selected !== null && selected < words.length ? selected : null;
  const word = sel !== null ? words[sel] : null;

  /** Selects word i (clamped), seeks the preview to it, and returns the selected index. */
  function select(i: number): number {
    const k = Math.max(0, Math.min(words.length - 1, i));
    setSelected(k);
    setDraft(null);
    const video = videoRef.current;
    if (video && words[k]) video.currentTime = words[k].start;
    return k;
  }

  /** Applies an edit, keeps the selection in range, and returns the new selected index. */
  function apply(next: Word[]): number | null {
    onChange(next);
    const k = next.length === 0 || sel === null ? null : Math.min(sel, next.length - 1);
    setSelected(k);
    return k;
  }

  function commitDraft() {
    if (sel === null || draft === null) return;
    if (draft !== word?.text) apply(replaceWordText(words, sel, draft));
    setDraft(null);
  }

  const nudge = (edge: "start" | "end", dir: -1 | 1) =>
    sel === null ? null : apply(shiftEdge(words, sel, edge, dir * NUDGE_SEC, maxEnd));

  function editText(i: number) {
    setDraft(words[i].text);
    requestAnimationFrame(() => inputRef.current?.select());
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target instanceof HTMLInputElement) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (canUndo) onUndo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Each handler returns the word index to keep focused, or null to leave focus alone.
    const video = videoRef.current;
    const handlers: Record<string, () => number | null> = {
      ArrowLeft: () => select(sel === null ? 0 : sel - 1),
      ArrowRight: () => select(sel === null ? 0 : sel + 1),
      " ": () => {
        if (video) void (video.paused ? video.play() : video.pause());
        return null;
      },
    };
    if (sel !== null) {
      Object.assign(handlers, {
        Enter: () => (editText(sel), null),
        Delete: () => apply(removeWord(words, sel)),
        Backspace: () => apply(removeWord(words, sel)),
        "[": () => nudge("start", -1),
        "]": () => nudge("start", 1),
        "{": () => nudge("end", -1),
        "}": () => nudge("end", 1),
        m: () => apply(mergeWithNext(words, sel)),
      });
    }
    const handler = handlers[e.key];
    if (!handler) return;
    e.preventDefault();
    const focusTarget = handler();
    if (focusTarget !== null) focusWord(focusTarget);
  }

  return (
    <div
      data-testid="transcript-editor"
      role="group"
      aria-label="Transcript editor"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex min-w-0 flex-col gap-3 outline-none"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {words.length} words. Select a word to fix its text or timing.
        </p>
        <button type="button" onClick={onUndo} disabled={!canUndo} className={smallBtn}>
          Undo
        </button>
      </div>

      {words.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-zinc-600">
          No words left. Use Undo to bring them back, or transcribe again.
        </p>
      ) : (
        <div
          ref={listRef}
          data-testid="word-list"
          className="max-h-64 overflow-y-auto rounded-md border p-2 leading-8 lg:max-h-[24rem]"
        >
          {words.map((w, i) => (
            <button
              key={`${i}-${w.start}`}
              type="button"
              data-testid="word"
              aria-pressed={i === sel}
              aria-label={`${w.text}, ${formatTime(w.start)} to ${formatTime(w.end)}`}
              onClick={() => select(i)}
              onDoubleClick={() => editText(select(i))}
              className={[
                "mr-1 rounded px-1 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600",
                i === sel ? "bg-foreground text-background" : "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                i === playing && i !== sel ? "underline decoration-amber-500 decoration-2 underline-offset-4" : "",
              ].join(" ")}
            >
              {w.text}
            </button>
          ))}
        </div>
      )}

      {word && sel !== null && (
        <div data-testid="word-panel" className="flex flex-col gap-3 rounded-md border p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commitDraft();
            }}
            className="flex flex-col gap-1"
          >
            <label htmlFor="word-text" className="text-sm font-medium">
              Word {sel + 1} of {words.length}
            </label>
            <input
              id="word-text"
              ref={inputRef}
              data-testid="word-text"
              value={draft ?? word.text}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDraft(null);
                  e.currentTarget.blur();
                }
              }}
              className="rounded-md border px-2 py-1.5 text-base"
            />
            <span className="text-xs text-zinc-500">
              Press Enter to save. Type a space to split into two words; clear the text to delete.
            </span>
          </form>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <TimeControl label="Start" value={word.start} onNudge={(d) => nudge("start", d)} />
            <TimeControl label="End" value={word.end} onNudge={(d) => nudge("end", d)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={smallBtn} onClick={() => apply(removeWord(words, sel))}>
              Delete word
            </button>
            <button
              type="button"
              className={smallBtn}
              disabled={sel >= words.length - 1}
              onClick={() => apply(mergeWithNext(words, sel))}
            >
              Merge with next
            </button>
          </div>
        </div>
      )}

      <details className="text-xs text-zinc-600 dark:text-zinc-400">
        <summary className="cursor-pointer">Keyboard shortcuts</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt>← →</dt>
          <dd>Previous or next word</dd>
          <dt>Enter</dt>
          <dd>Edit word text</dd>
          <dt>[ ]</dt>
          <dd>Move start 50 ms earlier or later</dd>
          <dt>Shift+[ Shift+]</dt>
          <dd>Move end 50 ms earlier or later</dd>
          <dt>M</dt>
          <dd>Merge with next word</dd>
          <dt>Delete</dt>
          <dd>Delete word</dd>
          <dt>Space</dt>
          <dd>Play or pause</dd>
          <dt>Ctrl/⌘+Z</dt>
          <dd>Undo</dd>
        </dl>
      </details>
    </div>
  );
}

function TimeControl({ label, value, onNudge }: { label: string; value: number; onNudge: (dir: -1 | 1) => void }) {
  const ms = Math.round(NUDGE_SEC * 1000);
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      <button
        type="button"
        className={smallBtn}
        aria-label={`Move ${label.toLowerCase()} ${ms} ms earlier`}
        onClick={() => onNudge(-1)}
      >
        −
      </button>
      <output data-testid={`word-${label.toLowerCase()}`} className="w-20 text-center text-sm tabular-nums">
        {formatTime(value)}
      </output>
      <button
        type="button"
        className={smallBtn}
        aria-label={`Move ${label.toLowerCase()} ${ms} ms later`}
        onClick={() => onNudge(1)}
      >
        +
      </button>
    </div>
  );
}

/** Index of the word under the playhead, updated only when it changes. */
function usePlayingWord(words: Word[], videoRef: RefObject<HTMLVideoElement | null>): number {
  const [index, setIndex] = useState(-1);
  useEffect(() => {
    let raf = 0;
    let last = -2;
    const tick = () => {
      const video = videoRef.current;
      const i = video ? wordIndexAt(words, video.currentTime) : -1;
      if (i !== last) setIndex((last = i));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [words, videoRef]);
  return index;
}

// min-h-10 gives a 40px touch target on phones; desktop keeps the compact size.
const smallBtn =
  "min-h-10 min-w-10 rounded-md border px-2.5 py-1 text-sm sm:min-h-0 sm:min-w-0 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2).padStart(5, "0");
  return `${m}:${s}`;
}

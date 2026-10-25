"use client";

import { useEffect, useRef, useState } from "react";
import type { ReelSession } from "./useReelSession";
import { btnSecondary, ProblemBox, Status } from "./parts";

/** The subset of Cloudflare's Turnstile API we use (explicit rendering). */
type Turnstile = {
  render(
    el: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      appearance?: "always" | "execute" | "interaction-only";
      size?: "normal" | "flexible" | "compact";
      callback(token: string): void;
      "expired-callback"(): void;
      "error-callback"(code: string): void;
    },
  ): string;
  reset(id: string): void;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptLoad: Promise<Turnstile> | null = null;

/** Loads Cloudflare's script once, only when a check is needed. */
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptLoad ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("no turnstile")));
    script.onerror = () => reject(new Error("script failed"));
    document.head.appendChild(script);
  }).catch((err) => {
    scriptLoad = null; // allow a retry
    document.querySelector(`script[src="${SCRIPT_URL}"]`)?.remove();
    throw err;
  });
  return scriptLoad;
}

/**
 * Cloudflare Turnstile before upload, when the server asks for it. Usually invisible: Cloudflare
 * shows a checkbox only when it needs one. Renders nothing when the check is off.
 */
export function HumanCheck({ session: s }: { session: ReelSession }) {
  const check = s.humanCheck;
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<{ turnstile: Turnstile; id: string } | null>(null);
  const [problem, setProblem] = useState<"load" | "widget" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const siteKey = check.status === "on" ? check.siteKey : null;
  const round = check.status === "on" ? check.round : 0;
  const setToken = s.setHumanCheckToken; // stable

  useEffect(() => {
    if (!siteKey || !box.current) return;
    const el = box.current;
    let gone = false;
    loadTurnstile().then(
      (turnstile) => {
        if (gone) return;
        const id = turnstile.render(el, {
          sitekey: siteKey,
          action: "transcribe",
          appearance: "interaction-only",
          size: "flexible",
          callback: (token) => {
            setProblem(null);
            setToken(token);
          },
          // A new token follows by itself (refresh-expired defaults to auto).
          "expired-callback": () => setToken(null),
          "error-callback": () => {
            setToken(null);
            setProblem("widget");
          },
        });
        widget.current = { turnstile, id };
      },
      () => !gone && setProblem("load"),
    );
    return () => {
      gone = true;
      if (widget.current) widget.current.turnstile.remove(widget.current.id);
      widget.current = null;
    };
  }, [siteKey, attempt, setToken]);

  // Each upload spends the token; ask for a fresh one.
  useEffect(() => {
    if (round > 0 && widget.current) widget.current.turnstile.reset(widget.current.id);
  }, [round]);

  if (check.status === "off") return null;
  if (check.status === "loading") return <Status testId="human-check-status">Getting ready to upload…</Status>;
  if (check.status === "error") {
    return (
      <div data-testid="human-check-error" className="space-y-2">
        <ProblemBox
          testId="human-check-config-error"
          problem={{ message: "Couldn't reach our server to prepare the upload.", action: "Check your connection, then retry." }}
        />
        <button type="button" className={btnSecondary} onClick={s.retryHumanCheck}>
          Retry
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div ref={box} data-testid="human-check-widget" />
      {problem ? (
        <div className="space-y-2">
          <ProblemBox
            testId="human-check-error"
            problem={
              problem === "load"
                ? {
                    message: "The anti-bot check couldn't load.",
                    action: "Check your connection, or allow challenges.cloudflare.com in your content blocker, then retry.",
                  }
                : { message: "The anti-bot check ran into a problem.", action: "Retry the check." }
            }
          />
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setProblem(null);
              setAttempt((n) => n + 1);
            }}
          >
            Retry check
          </button>
        </div>
      ) : (
        !check.token && <Status testId="human-check-status">Checking this browser isn&apos;t a bot…</Status>
      )}
    </div>
  );
}

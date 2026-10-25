"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

/** Fallback for an unexpected crash in the lab. Saved drafts and the brand kit live in IndexedDB and survive it. */
export default function LabError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // Name only: messages can carry details we don't want in logs.
    console.error("[lab] unexpected error:", error instanceof Error ? error.name : typeof error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-16">
      <h1 className="text-xl font-semibold">The lab hit an unexpected problem</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Your saved transcript, caption edits and brand kit are kept in this browser. Your video was never uploaded.
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={() => retry()} className="rounded-md bg-foreground px-4 py-2 text-sm text-background">
          Try again
        </button>
        <button type="button" onClick={() => window.location.reload()} className="rounded-md border px-4 py-2 text-sm">
          Reload the page
        </button>
      </div>
    </main>
  );
}

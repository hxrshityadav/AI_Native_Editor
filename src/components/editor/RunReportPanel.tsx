"use client";

import { useState } from "react";
import { toDeviceLogRow, type RunReport } from "@/lib/deviceReport";

/** Shows the device report for this run and copies it for docs/DEVICE_LOG.md. */
export function RunReportPanel({ report }: { report: RunReport }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const text = `${toDeviceLogRow(report)}\n\n${JSON.stringify(report, null, 2)}`;

  return (
    <details data-testid="run-report" className="rounded-lg border">
      <summary className="cursor-pointer px-4 py-3 font-medium">Device report (for testing)</summary>
      <div className="flex flex-col gap-3 border-t p-4 text-sm">
        <p className="text-zinc-600 dark:text-zinc-400">
          Your phone or computer, this clip&apos;s technical details and how long each step took. No file name, audio,
          transcript or video content. Copy it into <code>docs/DEVICE_LOG.md</code> or send it to the team.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="copy-report"
            className="rounded-md border px-3 py-1.5"
            onClick={() =>
              navigator.clipboard.writeText(text).then(
                () => setCopy("copied"),
                () => setCopy("failed"),
              )
            }
          >
            Copy device report
          </button>
          <span role="status">
            {copy === "copied" ? "Copied." : copy === "failed" ? "Couldn't copy here. Select the text below instead." : ""}
          </span>
        </div>
        <textarea
          data-testid="report-text"
          readOnly
          value={text}
          rows={8}
          aria-label="Device report text"
          className="w-full rounded-md border p-2 font-mono text-xs"
        />
      </div>
    </details>
  );
}

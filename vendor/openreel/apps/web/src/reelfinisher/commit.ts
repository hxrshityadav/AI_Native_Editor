import type { Project, ActionResult } from "@openreel/core";
import { editSnapshot } from "@openreel/core/actions/handlers/edit-snapshot";
import type { ProjectState } from "../stores/project-store";
import { removeOutputRange } from "./ripple";
import { normalizeCuts, sourceToEdited } from "../../../../../../src/lib/editor/timeline";
import { useTimelineStore } from "../stores/timeline-store";
import { toast } from "../stores/notification-store";
export const snapshotAction = (project: Project) => ({ type: "project/applyEditSnapshot", id: crypto.randomUUID(), timestamp: Date.now(), params: { snapshot: editSnapshot(project) } });
export async function synchronizedRemoval(state: ProjectState, start: number, end: number): Promise<ActionResult> {
  return synchronizedRemovalRanges(state, [{ start, end }]);
}
export async function synchronizedRemovalRanges(state: ProjectState, ranges: { start: number; end: number }[]): Promise<ActionResult> {
  try {
    let next = state.getFullProject();
    const normalized = normalizeCuts(ranges, next.timeline.duration);
    if (!normalized.length) throw new Error("Select a non-empty range first.");
    for (const range of [...normalized].reverse()) next = removeOutputRange(next, range.start, range.end);
    const time = useTimelineStore.getState().playheadPosition;
    const result = await state.executeAction(snapshotAction(next));
    if (result.success) useTimelineStore.getState().seekTo(sourceToEdited(time, normalized));
    else toast.error("Cannot synchronize edit", result.error?.message ?? "No changes were made.");
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot remove this range. No changes were made.";
    toast.error("Cannot synchronize edit", message);
    return { success: false, error: { code: "INVALID_PARAMS", message } };
  }
}

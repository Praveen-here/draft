import type { CanvasEvent, StepCheck } from "@/lib/contracts";

export type Trigger = "flag-wrong-line" | "offer-nudge" | "quiet-tick" | "none";

/** Idle time before offering a nudge (open question; tune on the tablet). */
export const IDLE_NUDGE_MS = 9000;

/** When should the brain act without being asked? (docs/AGENT_BRAIN.md §3, proactive table) */
export function decideTrigger(event: CanvasEvent, check?: StepCheck): Trigger {
  // TODO(B): refine (e.g. don't nudge twice in a row, stay quiet while the student is mid-line).
  if (event.type === "line" && check) return check.ok ? "quiet-tick" : "flag-wrong-line";
  if (event.type === "idle" && event.ms >= IDLE_NUDGE_MS) return "offer-nudge";
  return "none";
}

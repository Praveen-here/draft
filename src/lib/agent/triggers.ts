import type { CanvasEvent, StepCheck } from "@/lib/contracts";

export type Trigger = "flag-wrong-line" | "offer-nudge" | "quiet-tick" | "none";

/** Idle time before offering a nudge (the canvas sends "idle" after 8 s without pen activity; tune on the tablet). */
export const IDLE_NUDGE_MS = 8000;

/**
 * When should the brain act without being asked? (docs/AGENT_BRAIN.md §3, proactive table)
 * Only a definite "not-equivalent" flags a line: "unsure" and "unparseable" mean the engine can't tell, and a
 * false alarm is worse than staying quiet (D28).
 */
export function decideTrigger(event: CanvasEvent, check?: StepCheck): Trigger {
  if (event.type === "line" && check) {
    if (check.ok) return "quiet-tick";
    return check.reason === "not-equivalent" ? "flag-wrong-line" : "none";
  }
  if (event.type === "idle" && event.ms >= IDLE_NUDGE_MS) return "offer-nudge";
  return "none";
}

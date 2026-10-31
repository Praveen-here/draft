import type { Editor } from "tldraw";
import type { VisualAction } from "@/lib/contracts";

type CanvasAction = Extract<VisualAction, { type: "highlight" | "writeStep" | "mark" }>;

/** Draws one tutor action. Tutor shapes get meta { author: "tutor" } so they can be hidden or cleared. */
export function drawTutorInk(editor: Editor, action: CanvasAction): void {
  // TODO(A): highlight → translucent box; writeStep → animated handwriting text; mark → tick / cross / circle.
  void editor;
  console.log("[canvas] draw (not built yet)", action);
}

/** Removes every shape with meta.author === "tutor". */
export function clearTutorInk(editor: Editor): void {
  // TODO(A)
  void editor;
}

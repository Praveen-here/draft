import { createShapeId, type Editor } from "tldraw";
import type { VisualAction } from "@/lib/contracts";
import { shapeBox, targetBox } from "./context";
import { padded, placeBeside } from "./geometry";

type CanvasAction = Extract<VisualAction, { type: "highlight" | "writeStep" | "mark" }>;

/** Draws one tutor action. Tutor shapes get meta { author: "tutor" } so they can be hidden or cleared. */
export function drawTutorInk(editor: Editor, action: CanvasAction): void {
  const target = targetBox(editor, action.type === "writeStep" ? action.near : action.target);
  let box = padded(target, 4);
  if (action.type === "writeStep") {
    if (typeof action.latex !== "string" || !action.latex.trim() || action.latex.length > 4096) {
      throw new Error("The tutor's step could not be displayed.");
    }
    box = placeBeside(target, Math.min(560, Math.max(260, action.latex.length * 14)), 120,
      editor.getCurrentPageShapes().filter((shape) => shape.meta.kind !== "circle").map((shape) => shapeBox(editor, shape)));
  } else if (action.type === "mark" && action.kind !== "circle") {
    box = { x: target.x + target.w + 8, y: target.y, w: 32, h: 32 };
  }
  editor.run(() => editor.createShape({
    id: createShapeId(), type: "tutor-ink", x: box.x, y: box.y, isLocked: true,
    meta: { author: "tutor", kind: action.type === "writeStep" ? "step" : action.type },
    props: { w: box.w, h: box.h,
      kind: action.type === "mark" ? action.kind : action.type,
      colour: action.type === "highlight" ? action.colour : action.type === "mark" && action.kind === "cross" ? "red" : action.type === "mark" ? "green" : "blue",
      latex: action.type === "writeStep" ? action.latex : "",
    },
  }), { history: "ignore" });
}

/** Removes every shape with meta.author === "tutor". */
export function clearTutorInk(editor: Editor): void {
  editor.run(() => editor.deleteShapes(editor.getCurrentPageShapes().filter((shape) => shape.meta.author === "tutor")),
    { history: "ignore", ignoreShapeLock: true });
}

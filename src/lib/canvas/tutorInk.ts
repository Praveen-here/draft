import { createShapeId, type Editor } from "tldraw";
import type { VisualAction } from "@/lib/contracts";
import { targetBox } from "./context";
import { padded } from "./geometry";

/** Drawn as tutor-ink shapes on the page. Explain cards and written steps go in the lesson column (visualStore). */
type CanvasAction = Extract<VisualAction, { type: "highlight" | "mark" }>;

/** Draws one tutor action. Tutor shapes get meta { author: "tutor" } so they can be hidden or cleared. */
export function drawTutorInk(editor: Editor, action: CanvasAction): void {
  const target = targetBox(editor, action.target);
  let box = padded(target, 4);
  if (action.type === "mark" && action.kind !== "circle") {
    box = { x: target.x + target.w + 8, y: target.y, w: 32, h: 32 };
  }
  editor.run(() => editor.createShape({
    id: createShapeId(), type: "tutor-ink", x: box.x, y: box.y, isLocked: true,
    meta: { author: "tutor", kind: action.type },
    props: { w: box.w, h: box.h,
      kind: action.type === "mark" ? action.kind : action.type,
      colour: action.type === "highlight" ? action.colour : action.type === "mark" && action.kind === "cross" ? "red" : action.type === "mark" ? "green" : "blue",
      latex: "",
    },
  }), { history: "ignore" });
}

/** Removes every shape with meta.author === "tutor". */
export function clearTutorInk(editor: Editor): void {
  editor.run(() => editor.deleteShapes(editor.getCurrentPageShapes().filter((shape) => shape.meta.author === "tutor")),
    { history: "ignore", ignoreShapeLock: true });
}

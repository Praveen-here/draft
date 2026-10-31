import { Box, createShapeId, toRichText, type Editor, type TLShapeId } from "tldraw";
import type { InkColour, Target, VisualAction } from "@/lib/contracts";

/** Drawn as tldraw shapes on the page. Notes and written steps go in the lesson column instead (visualStore). */
type CanvasAction = Extract<VisualAction, { type: "highlight" | "mark" }>;

const TUTOR_META = { author: "tutor" } as const;

const HIGHLIGHT_COLOUR: Record<InkColour, "blue" | "green" | "red"> = {
  blue: "blue",
  green: "green",
  red: "red",
};

export function targetBox(editor: Editor, target: Target): Box | null {
  if ("bbox" in target) return new Box(target.bbox.x, target.bbox.y, target.bbox.w, target.bbox.h);
  return editor.getShapePageBounds(target.shapeId as TLShapeId) ?? null;
}

/** Draws one tutor action. Tutor shapes are locked, outside undo, and tagged meta.author = "tutor". */
export function drawTutorInk(editor: Editor, action: CanvasAction): Box | null {
  let drawn: Box | null = null;

  editor.run(
    () => {
      if (action.type === "highlight") {
        const b = targetBox(editor, action.target);
        if (!b) return;
        const pad = 4;
        editor.createShape({
          id: createShapeId(),
          type: "geo",
          x: b.x - pad,
          y: b.y - pad,
          opacity: 0.22,
          isLocked: true,
          meta: TUTOR_META,
          props: { geo: "rectangle", w: b.w + pad * 2, h: b.h + pad * 2, fill: "fill", color: HIGHLIGHT_COLOUR[action.colour], dash: "solid", size: "s" },
        });
        drawn = b;
      }

      if (action.type === "mark") {
        const b = targetBox(editor, action.target);
        if (!b) return;
        if (action.kind === "circle") {
          const pad = 8;
          editor.createShape({
            id: createShapeId(),
            type: "geo",
            x: b.x - pad,
            y: b.y - pad,
            isLocked: true,
            meta: TUTOR_META,
            props: { geo: "ellipse", w: b.w + pad * 2, h: b.h + pad * 2, fill: "none", color: "red", dash: "draw", size: "m" },
          });
        } else {
          editor.createShape({
            id: createShapeId(),
            type: "text",
            x: b.maxX + 6,
            y: b.y - 6,
            isLocked: true,
            meta: TUTOR_META,
            props: {
              richText: toRichText(action.kind === "tick" ? "✓" : "?"),
              color: action.kind === "tick" ? "green" : "red",
              size: "l",
              font: "draw",
              autoSize: true,
            },
          });
        }
        drawn = b;
      }
    },
    { history: "ignore" },
  );

  return drawn;
}

/** Removes every tutor shape. */
export function clearTutorInk(editor: Editor): void {
  const shapes = editor.getCurrentPageShapes().filter((s) => s.meta?.author === "tutor");
  if (!shapes.length) return;
  editor.run(
    () => {
      editor.updateShapes(shapes.map((s) => ({ id: s.id, type: s.type, isLocked: false })));
      editor.deleteShapes(shapes.map((s) => s.id));
    },
    { history: "ignore" },
  );
}

import { createShapeId, type Editor, type TLShapeId } from "tldraw";
import { shapeBox, studentInk } from "./context";
import { groupIntoLines, type InkLine } from "./lines";
import { union } from "./geometry";

function strokeKey(editor: Editor, id: string, origin = { x: 0, y: 0 }) {
  const shape = editor.getShape(id as TLShapeId);
  if (!shape) return null;
  const { a, b, c, d, e, f } = editor.getShapePageTransform(shape);
  // Ignore floating-point noise from reparenting, without hiding changes to the ink's layout.
  return [id, [a, b, c, d, e - origin.x, f - origin.y].map((value) => Math.round(value * 10000) / 10000), shape.props];
}

export function inkFingerprint(editor: Editor, line: InkLine): string {
  const ids = line.shapeIds.toSorted();
  const first = editor.getShape(ids[0] as TLShapeId);
  const origin = first ? editor.getShapePageTransform(first).point() : { x: 0, y: 0 };
  return JSON.stringify(ids.map((id) => strokeKey(editor, id, origin)));
}

export function snapshotEquations(editor: Editor) {
  return canvasLines(editor).map((line) => {
    const origin = editor.getShape(line.shapeIds[0] as TLShapeId)?.meta.equationFragmentOf;
    return { ...line, key: inkFingerprint(editor, line),
      fragmentOf: typeof origin === "string" && line.shapeIds.every((id) =>
        editor.getShape(id as TLShapeId)?.meta.equationFragmentOf === origin) ? origin : undefined,
      strokes: new Map(line.shapeIds.map((id) => [id, JSON.stringify(strokeKey(editor, id))])),
    };
  });
}
export type EquationMotion = ReturnType<typeof snapshotEquations>;

export function canvasLines(editor: Editor, motion?: EquationMotion): InkLine[] {
  const ink = studentInk(editor);
  if (motion && editor.inputs.getIsPointing()) {
    const known = new Set(motion.flatMap((line) => line.shapeIds));
    return [...motion.flatMap((line) => {
      const shapes = ink.filter((shape) => line.shapeIds.includes(shape.id));
      return shapes.length ? [{ shapeIds: shapes.map((shape) => shape.id), bbox: union(shapes.map((shape) => shapeBox(editor, shape))) }] : [];
    }), ...groupIntoLines(ink.filter((shape) => !known.has(shape.id)).map((shape) => ({ id: shape.id, bbox: shapeBox(editor, shape) })))];
  }
  const labels = new Map<string, string | undefined>();
  const previous = new Map<string, string>();
  const moves = (motion ?? []).map((line) => {
    const shapes = ink.filter((shape) => line.shapeIds.includes(shape.id));
    const box = shapes.length ? union(shapes.map((shape) => shapeBox(editor, shape))) : line.bbox;
    return { line, whole: inkFingerprint(editor, line) === line.key, dx: box.x - line.bbox.x, dy: box.y - line.bbox.y };
  });
  for (const move of moves) {
    const { line, whole, dx, dy } = move;
    const together = moves.some((other) => other !== move && other.whole && Math.abs(other.dx - dx) < 0.001 && Math.abs(other.dy - dy) < 0.001);
    const reattach = line.fragmentOf && !together;
    for (const id of line.shapeIds) {
      const stationary = JSON.stringify(strokeKey(editor, id)) === line.strokes.get(id);
      labels.set(id, (whole && !reattach) || stationary ? line.shapeIds.toSorted()[0] : undefined);
      previous.set(id, line.fragmentOf ?? line.shapeIds.toSorted()[0]);
    }
  }
  return groupIntoLines(ink.map((shape) => ({
    id: shape.id, bbox: shapeBox(editor, shape),
    previousEquationId: previous.get(shape.id),
    equationId: labels.has(shape.id) ? labels.get(shape.id)
      : typeof shape.meta.equationId === "string" ? shape.meta.equationId : undefined,
  })));
}

/** Save membership in the same undo step as the move or grouping operation. */
export function pinEquations(editor: Editor, equations: InkLine[], fragments = new Map<string, string>()) {
  editor.updateShapes(equations.flatMap((equation) => {
    const equationId = equation.shapeIds.toSorted()[0];
    return equation.shapeIds.flatMap((id) => {
      const shape = editor.getShape(id as TLShapeId);
      if (shape?.type !== "draw" || shape.meta.author === "tutor" ||
        (shape.meta.equationId === equationId && shape.meta.equationFragmentOf === fragments.get(id))) return [];
      const meta: typeof shape.meta = { ...shape.meta, equationId };
      if (fragments.has(id)) meta.equationFragmentOf = fragments.get(id)!;
      else delete meta.equationFragmentOf;
      return [{ id: shape.id, type: "draw" as const, meta }];
    });
  }));
}

export function finishEquationMotion(editor: Editor, motion: EquationMotion) {
  const equations = canvasLines(editor, motion);
  const origins = equations.map((line) => {
    const sources = motion.filter((before) => before.shapeIds.some((id) => line.shapeIds.includes(id)));
    if (sources.length === 1 && line.shapeIds.every((id) => sources[0].shapeIds.includes(id))) {
      return sources[0].fragmentOf ?? (line.shapeIds.length < sources[0].shapeIds.length ? sources[0].shapeIds.toSorted()[0] : undefined);
    }
    const origin = sources[0]?.fragmentOf;
    return origin && sources.every((source) => source.fragmentOf === origin) ? origin : undefined;
  });
  // Automatic split pieces can reconnect; complete equations and explicitly grouped layers stay distinct.
  const fragments = new Map(equations.flatMap((line, index) => {
    const origin = origins[index];
    return origin && origins.filter((value) => value === origin).length > 1
      ? line.shapeIds.map((id) => [id, origin] as const) : [];
  }));
  editor.run(() => {
    for (const line of equations) {
      const anchor = line.shapeIds.find((id) => motion.some((before) =>
        before.strokes.get(id) === JSON.stringify(strokeKey(editor, id))));
      const parent = anchor && editor.getShape(anchor as TLShapeId)?.parentId;
      // A symbol dropped into another equation follows that equation's native layer group.
      if (parent) editor.reparentShapes(line.shapeIds.filter((id) => editor.getShape(id as TLShapeId)?.parentId !== parent) as TLShapeId[], parent);
    }
    pinEquations(editor, equations, fragments);
  });
}

export function selectedInkIds(editor: Editor): TLShapeId[] {
  const selected = editor.getShapeAndDescendantIds(editor.getSelectedShapeIds());
  return studentInk(editor).filter((shape) => selected.has(shape.id)).map((shape) => shape.id);
}

/** Native grouping supplies movement and undo; equation labels preserve separate recognition. */
export function groupEquations(editor: Editor, equations: InkLine[]) {
  if (equations.length < 2) return;
  const id = createShapeId();
  editor.markHistoryStoppingPoint("group equations");
  editor.run(() => {
    pinEquations(editor, equations);
    editor.groupShapes(equations.flatMap((line) => line.shapeIds) as TLShapeId[], { groupId: id });
    editor.updateShape({ id, type: "group", meta: { author: "student", kind: "equation-block" } });
  });
}

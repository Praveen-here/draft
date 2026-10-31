import { Box, type Editor, type TLDrawShape, type TLShape } from "tldraw";
import type { CanvasApi, CanvasEvent, CircleContext } from "@/lib/contracts";
import { looksLikeCircle, type Point } from "./circleDetect";
import { readInk } from "./readInk";
import { clearTutorInk, drawTutorInk, targetBox } from "./tutorInk";
import { createVisualStore, type LessonColumn, type VisualStore } from "./visualStore";

/** Width of the lesson column (cards, graphs, steps) beside the circle, in page units. Graphs are this wide. */
export const VISUAL_W = 380;
export const VISUAL_H = 270;
/** Room the column needs on screen to be placed beside the circle rather than below it. */
const COLUMN_MIN_H = 220;

/** Longest side of the circled picture sent to Gemini, in pixels. */
const CROP_MAX_PX = 1024;

/** Screen space covered by floating UI (bars, tutor panel); tutor items are placed outside it. */
export type SafeArea = { top: number; right: number; bottom: number; left: number };

export type CanvasHandle = CanvasApi & { visuals: VisualStore; setSafeArea(area: SafeArea): void; dispose(): void };

/** Builds the canvas API on top of a tldraw editor. */
export function createCanvasApi(editor: Editor): CanvasHandle {
  const listeners = new Set<(event: CanvasEvent) => void>();
  const visuals = createVisualStore();
  let latestCircle: CircleContext | null = null;
  let pageRight = 0;
  let stepCount = 0;
  let safe: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

  const emit = (event: CanvasEvent) => listeners.forEach((fn) => fn(event));

  // Watch strokes as they finish: is this one a circle around something?
  const offStrokes = editor.sideEffects.registerAfterChangeHandler("shape", (prev, next) => {
    if (!isDraw(editor, next) || !isDraw(editor, prev)) return;
    if (!next.props.isComplete || prev.props.isComplete || next.meta?.author === "tutor") return;
    const points = pagePoints(editor, next);
    if (!looksLikeCircle(points)) return;
    void onCircle(next, points);
  });

  async function onCircle(stroke: TLDrawShape, points: Point[]) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const ring = new Box(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

    // It must surround something: PDF page or other ink.
    const inside = editor
      .getCurrentPageShapes()
      .filter((s) => s.id !== stroke.id && s.meta?.author !== "tutor")
      .filter((s) => {
        const b = editor.getShapePageBounds(s);
        return b && ring.collides(b);
      });
    if (!inside.length) return;

    // Show it was understood: the circle turns tutor blue.
    editor.run(
      () => editor.updateShape({ id: stroke.id, type: "draw", props: { color: "blue" }, meta: { ...stroke.meta, kind: "circle" } }),
      { history: "ignore" },
    );

    const bounds = ring.clone().expandBy(10);
    const scale = Math.min(2, CROP_MAX_PX / Math.max(bounds.w, bounds.h));
    const { url } = await editor.toImageDataUrl([...inside.map((s) => s.id), stroke.id], {
      bounds,
      scale,
      background: true,
      format: "png",
    });

    const page = inside.find((s) => s.meta?.kind === "page");
    pageRight = page ? (editor.getShapePageBounds(page)?.maxX ?? 0) : 0;

    // A new problem: the last problem's cards, graphs and ink go away.
    clearTutorInk(editor);
    visuals.clear();

    latestCircle = {
      cropImage: url,
      inkOnlyImage: "",
      pdfText: "",
      bbox: { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
      pageNo: typeof page?.meta?.page === "number" ? page.meta.page : 0,
      recentLines: [],
    };
    emit({ type: "circle", context: latestCircle });
  }

  /** The part of the canvas the student can see right now (not under the bars or the panel), in page units. */
  function visibleArea(): Box {
    const screen = editor.getViewportScreenBounds();
    const { x: cx, y: cy, z } = editor.getCamera();
    const left = safe.left / z - cx;
    const top = safe.top / z - cy;
    return new Box(left, top, (screen.w - safe.left - safe.right) / z, (screen.h - safe.top - safe.bottom) / z);
  }

  /**
   * Pick a spot for the tutor's items that is already on screen and doesn't cover the circle.
   * The canvas never moves: the student keeps looking at what they marked (no zoom, no pan).
   */
  function anchorColumn(): LessonColumn {
    const vis = visibleArea();
    const c = latestCircle ? new Box(latestCircle.bbox.x, latestCircle.bbox.y, latestCircle.bbox.w, latestCircle.bbox.h) : vis;
    const w = VISUAL_W;
    const h = Math.min(COLUMN_MIN_H, vis.h - 32);
    const gap = 16;
    const fits = (x: number, y: number) => x >= vis.x && y >= vis.y && x + w <= vis.maxX && y + h <= vis.maxY;
    const clampX = (x: number) => Math.min(Math.max(x, vis.x + gap), vis.maxX - w - gap);
    const top = Math.max(c.y, vis.y + gap); // level with the circle, but never under the top bar
    const candidates = [
      { x: Math.max(c.maxX, pageRight) + 40, y: top }, // beside the page, level with the circle
      { x: c.maxX + 24, y: top }, // right of the circle
      { x: c.x - w - 24, y: top }, // left of the circle
      { x: clampX(c.x), y: c.maxY + gap }, // below the circle
    ];
    const spot = candidates.find((p) => fits(p.x, p.y)) ?? { x: vis.maxX - w - gap, y: vis.y + gap };
    return { ...spot, w, minY: vis.y + gap, maxY: vis.maxY - gap };
  }

  const ensureColumn = () => {
    const current = visuals.get().column;
    if (current) return current;
    const column = anchorColumn();
    visuals.setColumn(column);
    return column;
  };

  return {
    visuals,
    onEvent(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getLatestCircle: () => latestCircle,
    readInk: (region) => readInk(editor, region),
    draw(action) {
      if (action.type === "note") {
        ensureColumn();
        const { type: _type, ...note } = action;
        const b = note.target ? targetBox(editor, note.target) : null;
        visuals.set({ id: `note:${note.id}`, kind: "note", note, anchor: b ? { x: b.x, y: b.y, w: b.w, h: b.h } : null });
        return;
      }
      if (action.type === "writeStep") {
        ensureColumn();
        visuals.set({ id: `step:${++stepCount}`, kind: "step", text: action.text });
        return;
      }
      drawTutorInk(editor, action);
    },
    clearTutorInk() {
      clearTutorInk(editor);
      visuals.clear();
    },
    mountVisual(id, _near, node) {
      ensureColumn();
      visuals.set({ id, kind: "node", node });
    },
    unmountVisual: (id) => visuals.remove(id),
    setSafeArea(area) {
      safe = area;
    },
    dispose() {
      offStrokes();
      listeners.clear();
    },
  };
}

function isDraw(editor: Editor, shape: TLShape): shape is TLDrawShape {
  return editor.isShapeOfType<TLDrawShape>(shape, "draw");
}

/** The stroke's points in page coordinates. */
function pagePoints(editor: Editor, shape: TLDrawShape): Point[] {
  const geometry = editor.getShapeGeometry(shape);
  return editor.getShapePageTransform(shape).applyToPoints(geometry.vertices);
}

import { Box, type Editor, type TLDrawShape, type TLShape } from "tldraw";
import type { CanvasApi, CanvasEvent, CircleContext } from "@/lib/contracts";
import { looksLikeCircle, type Point } from "./circleDetect";
import { readInk } from "./readInk";
import { clearTutorInk, drawTutorInk, type TutorColumn } from "./tutorInk";
import { createVisualStore, type VisualStore } from "./visualStore";

/** Size of a pinned graph on the canvas, in page units. */
export const VISUAL_W = 380;
export const VISUAL_H = 270;

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
  /** Where tutor graphs and steps go for the current circle; chosen when the first one arrives. */
  let column: TutorColumn | null = null;
  let pageRight = 0;
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
    column = null;

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
  function anchorColumn(): TutorColumn {
    const vis = visibleArea();
    const c = latestCircle ? new Box(latestCircle.bbox.x, latestCircle.bbox.y, latestCircle.bbox.w, latestCircle.bbox.h) : vis;
    const w = VISUAL_W;
    const h = Math.min(VISUAL_H, vis.h - 32);
    const gap = 16;
    const fits = (x: number, y: number) => x >= vis.x && y >= vis.y && x + w <= vis.maxX && y + h <= vis.maxY;
    const clampX = (x: number) => Math.min(Math.max(x, vis.x + gap), vis.maxX - w - gap);
    const candidates: TutorColumn[] = [
      { x: Math.max(c.maxX, pageRight) + 40, y: c.y }, // beside the page, level with the circle
      { x: c.maxX + 24, y: c.y }, // right of the circle
      { x: clampX(c.x), y: c.maxY + gap }, // below the circle
      { x: clampX(c.x), y: c.y - h - gap }, // above the circle
    ];
    return candidates.find((p) => fits(p.x, p.y)) ?? { x: vis.maxX - w - gap, y: vis.maxY - h - gap };
  }

  const ensureColumn = () => (column ??= anchorColumn());

  return {
    visuals,
    onEvent(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getLatestCircle: () => latestCircle,
    readInk: (region) => readInk(editor, region),
    draw(action) {
      drawTutorInk(editor, action, ensureColumn());
    },
    clearTutorInk() {
      clearTutorInk(editor);
      visuals.clear();
    },
    mountVisual(id, _near, node) {
      const existing = visuals.get().find((v) => v.id === id);
      const col = ensureColumn();
      const spot = existing ?? { x: col.x, y: col.y, w: VISUAL_W, h: VISUAL_H };
      if (!existing) col.y += VISUAL_H + 16;
      visuals.set({ id, ...spot, node });
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

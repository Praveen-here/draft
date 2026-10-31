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

/** Screen space covered by floating UI (e.g. the tutor panel), so revealed items aren't hidden behind it. */
export type SafeArea = { top: number; right: number; bottom: number; left: number };

export type CanvasHandle = CanvasApi & { visuals: VisualStore; setSafeArea(area: SafeArea): void; dispose(): void };

/** Builds the canvas API on top of a tldraw editor. */
export function createCanvasApi(editor: Editor): CanvasHandle {
  const listeners = new Set<(event: CanvasEvent) => void>();
  const visuals = createVisualStore();
  let latestCircle: CircleContext | null = null;
  let column: TutorColumn = { x: 0, y: 0 };
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
    const pageBounds = page ? editor.getShapePageBounds(page) : null;
    column = { x: Math.max(bounds.maxX, pageBounds?.maxX ?? 0) + 40, y: bounds.y };

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

  /**
   * Keep the circle and what the tutor just added in view, in the part of the screen the panel
   * doesn't cover. Zooms out only if needed, never in.
   */
  function reveal(box: Box | null) {
    if (!box) return;
    const c = latestCircle?.bbox;
    const all = (c ? Box.Common([box, new Box(c.x, c.y, c.w, c.h)]) : box.clone()).expandBy(24);
    const screen = editor.getViewportScreenBounds();
    const area = new Box(safe.left, safe.top, screen.w - safe.left - safe.right, screen.h - safe.top - safe.bottom);
    const { x: cx, y: cy, z } = editor.getCamera();
    const onScreen = new Box((all.x + cx) * z, (all.y + cy) * z, all.w * z, all.h * z);
    if (area.contains(onScreen)) return;

    const nz = Math.min(z, area.w / all.w, area.h / all.h);
    editor.setCamera(
      {
        x: (area.x + (area.w - all.w * nz) / 2) / nz - all.x,
        y: (area.y + Math.max(0, (area.h - all.h * nz) / 2)) / nz - all.y,
        z: nz,
      },
      { animation: { duration: 450 } },
    );
  }

  return {
    visuals,
    onEvent(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getLatestCircle: () => latestCircle,
    readInk: (region) => readInk(editor, region),
    draw(action) {
      reveal(drawTutorInk(editor, action, column));
    },
    clearTutorInk() {
      clearTutorInk(editor);
      visuals.clear();
    },
    mountVisual(id, _near, node) {
      const existing = visuals.get().find((v) => v.id === id);
      const spot = existing ?? { x: column.x, y: column.y, w: VISUAL_W, h: VISUAL_H };
      if (!existing) column.y += VISUAL_H + 16;
      visuals.set({ id, ...spot, node });
      reveal(new Box(spot.x, spot.y, spot.w, spot.h));
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

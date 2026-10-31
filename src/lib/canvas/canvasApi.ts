import { Box, type Editor, type TLShape, type TLShapeId } from "tldraw";
import type { BBox, CanvasApi, CanvasEvent, CircleContext } from "@/lib/contracts";
import { areaContext, circleContext, documentPages, enclosesContent, shapeBox, strokePoints, studentInk, targetBox } from "./context";
import { looksLikeCircle } from "./circleDetect";
import { overlap, padded, union, validBox } from "./geometry";
import type { InkLine } from "./lines";
import { canvasLines, finishEquationMotion, inkFingerprint, snapshotEquations, type EquationMotion } from "./equations";
import { readInk, requestInk, type InkRecognizer } from "./readInk";
import { clearTutorInk, drawTutorInk } from "./tutorInk";
import { createVisualStore, type LessonColumn, type VisualStore } from "./visualStore";

/** Width of the lesson column (lesson card, explain cards, graphs, steps) beside the circle, in page units. */
export const VISUAL_W = 380;
export const VISUAL_H = 270;
/** Room the column needs on screen to be placed beside the circle rather than below it. */
const COLUMN_MIN_H = 220;

/** Screen space covered by floating UI (bars, ask pill); the lesson column is placed outside it. */
export type SafeArea = { top: number; right: number; bottom: number; left: number };

export type CanvasOptions = {
  recogniseInk?: InkRecognizer;
  onError?: (message: string) => void;
  onReading?: (reading: boolean) => void;
  onContext?: (context: CircleContext | null) => void;
};
export type CanvasEquation = InkLine & { latex: string | null };
export type CanvasHandle = CanvasApi & {
  getEquations(): CanvasEquation[];
  /** The lesson column beside the circled problem, read by <TutorOverlay>. */
  visuals: VisualStore;
  setSafeArea(area: SafeArea): void;
  dispose(): void;
};

/** Call once from Canvas.onMount; dispose subscriptions when that editor unmounts. */
export function createCanvasApi(editor: Editor, options: CanvasOptions = {}): CanvasHandle {
  const listeners = new Set<(event: CanvasEvent) => void>();
  const visuals = createVisualStore();
  let safe: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
  let stepCount = 0;
  let latestCircle: CircleContext | null = null;
  let circleId: TLShapeId | null = null;
  let selectedIds: TLShapeId[] = [];
  let contextRevision = 0;
  let revision = 0;
  let disposed = false;
  let lastActivity = 0;
  let lineTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let activeRead: { key: string; controller: AbortController } | undefined;
  let readQueue: Promise<unknown> = Promise.resolve();
  const recognised = new Map<string, string>();
  const unreadable = new Set<string>();
  const pendingStrokes = new Set<TLShapeId>();
  let strokeQueued = false;
  let motion: EquationMotion | undefined;
  let reconciling = false;
  let membershipChanged = false;
  let operationQueued = false;

  const report = (error: unknown) => {
    if (disposed || (error instanceof DOMException && error.name === "AbortError")) return;
    options.onError?.(error instanceof Error ? error.message : "Couldn't update the selected area.");
  };
  const emit = (event: CanvasEvent) => { if (!disposed) listeners.forEach((listener) => listener(event)); };
  const lines = (region?: BBox) => canvasLines(editor, motion).filter((line) => !region || overlap(line.bbox, region) > 0);
  const fingerprint = (line: InkLine) => inkFingerprint(editor, line);
  const remember = (key: string, latex: string) => {
    recognised.delete(key);
    recognised.set(key, latex);
    // shortcut: retain 128 recent arrangements for undo; enlarge if long sessions need more history.
    if (recognised.size > 128) recognised.delete(recognised.keys().next().value!);
  };
  const finishMotion = () => {
    if (!motion || disposed || reconciling || membershipChanged || editor.inputs.getIsPointing()) return;
    const before = motion;
    motion = undefined;
    reconciling = true;
    try { finishEquationMotion(editor, before); }
    finally { reconciling = false; }
  };
  const recentLines = (region?: BBox) => lines().flatMap((line) => {
    const result = recognised.get(fingerprint(line));
    const selected = selectedIds.length ? editor.getShapeAndDescendantIds(selectedIds) : null;
    return result && (!region || overlap(line.bbox, padded(region, 80)) > 0) &&
      (!selected || line.shapeIds.some((id) => selected.has(id as TLShapeId))) ? [result] : [];
  }).slice(-5);

  const refreshCircle = async (selectionChanged = false) => {
    const request = ++contextRevision;
    const selected = editor.getShapeAndDescendantIds(selectedIds);
    const chosen = studentInk(editor).filter((shape) => selected.has(shape.id));
    const current = circleId && editor.getShape(circleId);
    if (!chosen.length && (!current || current.meta.kind !== "circle")) { latestCircle = null; options.onContext?.(null); return; }
    const at = revision;
    const bounds = chosen.length ? padded(union(chosen.map((shape) => shapeBox(editor, shape)))) : shapeBox(editor, current!);
    const context = chosen.length ? await areaContext(editor, bounds, recentLines(bounds), chosen)
      : await circleContext(editor, current!, recentLines(bounds));
    if (disposed || at !== revision || request !== contextRevision) return;
    latestCircle = { ...context, recentLines: recentLines(context.bbox) };
    options.onContext?.(latestCircle);
    if (selectionChanged) {
      clearTutorInk(editor);
      visuals.clear();
      emit({ type: "circle", context: latestCircle });
    }
  };

  const queueRead = (region?: BBox, retryUnreadable = false): Promise<string[]> => {
    if (region && !validBox(region)) return Promise.reject(new Error("Please select a valid area of writing."));
    const job = readQueue.catch(() => undefined).then(async () => {
      if (disposed || editor.inputs.getIsPointing()) throw new DOMException("Writing is still moving", "AbortError");
      finishMotion();
      const result: string[] = [];
      try {
        for (const line of lines(region)) {
          const key = fingerprint(line);
          if (unreadable.has(key) && !retryUnreadable) continue;
          let cached = recognised.get(key);
          if (cached === undefined) {
            if (disposed || editor.inputs.getIsPointing()) break;
            const current = lines().find((candidate) => fingerprint(candidate) === key);
            if (!current) continue;
            const controller = new AbortController();
            activeRead = { key, controller };
            options.onReading?.(true);
            try {
              const read = await readInk(editor, current, (image, signal) => {
                const now = lines().find((candidate) => fingerprint(candidate) === key);
                // A move during PNG export needs a fresh crop, before spending a provider call.
                if (!now || editor.inputs.getIsPointing() ||
                  Object.keys(current.bbox).some((axis) => Math.abs(current.bbox[axis as keyof BBox] - now.bbox[axis as keyof BBox]) > 0.001)) {
                  throw new DOMException("Writing moved during capture", "AbortError");
                }
                return (options.recogniseInk ?? requestInk)(image, signal);
              }, controller.signal);
              cached = read.latex;
            } catch (error) {
              controller.signal.throwIfAborted();
              // Unclear old writing must not block new lines; transport/quota errors still stop the queue.
              if (!(error instanceof Error) || error.cause !== 422) throw error;
              unreadable.add(key);
              if (unreadable.size > 128) unreadable.delete(unreadable.values().next().value!);
              report(error);
              continue;
            }
            controller.signal.throwIfAborted();
            const now = lines().find((candidate) => fingerprint(candidate) === key);
            if (disposed || !now) throw new DOMException("Writing changed", "AbortError");
            unreadable.delete(key);
            remember(key, cached);
            emit({ type: "line", latex: cached, target: { bbox: now.bbox } });
            activeRead = undefined;
          } else {
            remember(key, cached);
          }
          result.push(cached);
        }
        if (latestCircle) {
          latestCircle = { ...latestCircle, recentLines: recentLines(latestCircle.bbox) };
          options.onContext?.(latestCircle);
        }
        return result;
      } finally {
        activeRead = undefined;
        if (!disposed) options.onReading?.(false);
      }
    });
    readQueue = job;
    return job;
  };

  const idle = () => {
    if (disposed) return;
    if (editor.inputs.getIsPointing()) { idleTimer = setTimeout(idle, 1000); return; }
    emit({ type: "idle", ms: Math.round(performance.now() - lastActivity) });
  };
  const settled = () => {
    if (disposed) return;
    if (editor.inputs.getIsPointing()) { lineTimer = setTimeout(settled, 300); return; }
    finishMotion();
    void queueRead().catch(report);
  };

  const activity = () => {
    revision++;
    latestCircle = null;
    options.onContext?.(null);
    lastActivity = performance.now();
    clearTimeout(lineTimer);
    clearTimeout(idleTimer);
    lineTimer = setTimeout(settled, 1200);
    idleTimer = setTimeout(idle, 8000);
  };

  const watchStroke = (shape: TLShape) => {
    if (disposed || (shape.type !== "draw" && shape.type !== "highlight") || shape.meta.author === "tutor") return;
    if (editor.getCurrentToolId() !== "select") selectedIds = [];
    activity();
    if (!shape.props.isComplete) return;
    if (shape.type === "highlight") { void refreshCircle().catch(report); return; }
    pendingStrokes.add(shape.id);
    if (strokeQueued) return;
    strokeQueued = true;
    queueMicrotask(() => {
      strokeQueued = false;
      if (disposed) return;
      let selectionChanged = false;
      for (const id of pendingStrokes) {
        const current = editor.getShape(id);
        if (!current || current.type !== "draw" || !current.props.isComplete) continue;
        try {
          const points = strokePoints(editor, current);
          const isCircle = !current.meta.equationId && looksLikeCircle(points) && enclosesContent(editor, current, points);
          editor.run(() => editor.updateShape({
            id, type: "draw", meta: { ...current.meta, author: "student", kind: isCircle ? "circle" : "ink" },
          }), { history: "ignore" });
          if (isCircle) { circleId = id; selectionChanged = true; }
          else if (circleId === id) circleId = null;
        } catch (error) { report(error); }
      }
      pendingStrokes.clear();
      void refreshCircle(selectionChanged).catch(report);
    });
  };

  const offs = [
    editor.sideEffects.registerBeforeCreateHandler("shape", (shape) =>
      (shape.type === "draw" || shape.type === "highlight") && shape.meta.author !== "tutor"
        ? { ...shape, meta: { ...shape.meta, author: "student", kind: shape.meta.kind ?? "ink" } } : shape),
    editor.sideEffects.registerAfterCreateHandler("shape", watchStroke),
    editor.sideEffects.registerBeforeChangeHandler("shape", (before, after) => {
      // Grouping and undo/redo restore membership directly in the same atomic operation.
      if (!reconciling && before.meta.equationId !== after.meta.equationId) {
        motion = undefined;
        membershipChanged = true;
      }
      const changed = before.props !== after.props || before.x !== after.x || before.y !== after.y ||
        before.rotation !== after.rotation || before.parentId !== after.parentId;
      if (!motion && !reconciling && !membershipChanged && changed && before.meta.author !== "tutor" &&
        (before.type === "group" || (before.type === "draw" && before.props.isComplete && after.type === "draw" &&
          after.props.isComplete && before.meta.kind !== "circle"))) motion = snapshotEquations(editor);
      return after;
    }),
    editor.sideEffects.registerAfterChangeHandler("shape", (before, after) => {
      if (before.meta.equationId !== after.meta.equationId) { activity(); return; }
      if (before.props === after.props && before.x === after.x && before.y === after.y &&
        before.rotation === after.rotation && before.parentId === after.parentId) return;
      if (after.type === "group") {
        const children = editor.getShapeAndDescendantIds([after.id]);
        if (studentInk(editor).some((shape) => children.has(shape.id))) {
          activity();
          queueMicrotask(() => { if (!disposed) void refreshCircle().catch(report); });
        }
        return;
      }
      if (motion && after.type === "draw") {
        activity();
        queueMicrotask(() => { if (!disposed) void refreshCircle().catch(report); });
        return;
      }
      watchStroke(after);
    }),
    editor.sideEffects.registerAfterChangeHandler("instance_page_state", (before, after) => {
      if (before.selectedShapeIds === after.selectedShapeIds || editor.getCurrentToolId() !== "select") return;
      selectedIds = [...after.selectedShapeIds];
      circleId = null;
      latestCircle = null;
      options.onContext?.(null);
      queueMicrotask(() => { if (!disposed) void refreshCircle(true).catch(report); });
    }),
    editor.sideEffects.registerAfterDeleteHandler("shape", (shape) => {
      if ((shape.type !== "draw" && shape.type !== "highlight") || shape.meta.author === "tutor") return;
      if (circleId === shape.id) circleId = null;
      activity();
      queueMicrotask(() => { if (!disposed) void refreshCircle().catch(report); });
    }),
    editor.sideEffects.registerOperationCompleteHandler(() => {
      if (disposed || reconciling || operationQueued) return;
      operationQueued = true;
      // A multi-stroke move may update several records before its final layout is ready.
      queueMicrotask(() => {
        operationQueued = false;
        if (disposed) return;
        finishMotion();
        membershipChanged = false;
        if (activeRead && !lines().some((line) => fingerprint(line) === activeRead!.key)) activeRead.controller.abort();
      });
    }),
  ];
  editor.on("event", finishMotion);
  offs.push(() => { editor.off("event", finishMotion); });

  /** The part of the canvas the student can see right now (not under the bars), in page units. */
  function visibleArea(): Box {
    const screen = editor.getViewportScreenBounds();
    const { x: cx, y: cy, z } = editor.getCamera();
    return new Box(safe.left / z - cx, safe.top / z - cy, (screen.w - safe.left - safe.right) / z, (screen.h - safe.top - safe.bottom) / z);
  }

  /**
   * Pick a spot for the lesson column that is already on screen and doesn't cover the circle.
   * The canvas never moves: the student keeps looking at what they marked (no zoom, no pan).
   */
  function anchorColumn(): LessonColumn {
    const vis = visibleArea();
    const c = latestCircle ? new Box(latestCircle.bbox.x, latestCircle.bbox.y, latestCircle.bbox.w, latestCircle.bbox.h) : vis;
    const pageRight = Math.max(0, ...documentPages(editor).map((page) => shapeBox(editor, page))
      .filter((page) => overlap(page, c) > 0).map((page) => page.x + page.w));
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

  const api: CanvasHandle = {
    visuals,
    setSafeArea(area) {
      safe = area;
    },
    getEquations: () => lines().map((line) => ({ ...line, latex: recognised.get(fingerprint(line)) ?? null })),
    onEvent(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getLatestCircle: () => latestCircle,
    readInk: (region) => queueRead(region, true),
    draw(action) {
      if (disposed) return;
      try {
        // Explain cards and written steps go in the lesson column; highlights and marks go on the page.
        if (action.type === "note") {
          ensureColumn();
          const { type: _type, ...note } = action;
          let anchor: BBox | null = null;
          try { anchor = note.target ? targetBox(editor, note.target) : null; } catch { anchor = null; }
          visuals.set({ id: `note:${note.id}`, kind: "note", note, anchor });
          return;
        }
        if (action.type === "writeStep") {
          ensureColumn();
          visuals.set({ id: `step:${++stepCount}`, kind: "step", text: action.text });
          return;
        }
        drawTutorInk(editor, action);
      } catch (error) { report(error); }
    },
    clearTutorInk() {
      if (disposed) return;
      clearTutorInk(editor);
      visuals.clear();
    },
    mountVisual(id, _near, node) {
      if (disposed) return;
      if (!id.trim() || id.length > 128) { report(new Error("The visual has an invalid ID.")); return; }
      // Graphs and the lesson card join the lesson column; the same id replaces in place.
      ensureColumn();
      visuals.set({ id, kind: "node", node });
    },
    unmountVisual(id) {
      if (disposed) return;
      visuals.remove(id);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      revision++;
      activeRead?.controller.abort();
      clearTimeout(lineTimer);
      clearTimeout(idleTimer);
      offs.forEach((off) => off());
      listeners.clear();
      pendingStrokes.clear();
      recognised.clear();
      unreadable.clear();
      latestCircle = null;
      visuals.clear();
    },
  };
  return api;
}

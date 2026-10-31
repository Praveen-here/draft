import type { Editor } from "tldraw";
import type { CanvasApi, CanvasEvent, CircleContext } from "@/lib/contracts";
import { readInk } from "./readInk";
import { clearTutorInk, drawTutorInk } from "./tutorInk";

/** Builds the canvas API on top of a tldraw editor. Call from Canvas.tsx onMount. */
export function createCanvasApi(editor: Editor): CanvasApi {
  const listeners = new Set<(event: CanvasEvent) => void>();
  // eslint-disable-next-line prefer-const -- set by the stroke watcher (TODO below)
  let latestCircle: CircleContext | null = null;

  // TODO(A): watch finished strokes → looksLikeCircle / lines → emit events to `listeners`.

  return {
    onEvent(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getLatestCircle: () => latestCircle,
    readInk: (region) => readInk(editor, region),
    draw: (action) => drawTutorInk(editor, action),
    clearTutorInk: () => clearTutorInk(editor),
    mountVisual() {
      // TODO(A): custom tldraw shape that renders the React node near the target.
    },
    unmountVisual() {
      // TODO(A)
    },
  };
}

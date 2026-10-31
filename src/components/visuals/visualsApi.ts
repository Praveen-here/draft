"use client";

import { createElement, useSyncExternalStore } from "react";
import type { CanvasApi, Target, VisualsApi } from "@/lib/contracts";
import { TeachingVisual, VisualError } from "./Graph";
import { VisualStore, type AnimationClock } from "./animation";
import { finite, paramName, visualId, visualSpec, type GraphAction } from "./model";

export type VisualsController = VisualsApi & {
  /** Freeze values at their current position, for pause/barge-in. */
  stop(): void;
  /** Cancel animations and unmount only this instance's visuals when its document closes. */
  dispose(): void;
};
export type VisualsOptions = { clock?: AnimationClock; onError?: (message: string) => void; onInteraction?: () => void };
let instanceNumber = 0;

function ManagedVisual({ store, onInteraction }: { store: VisualStore; onInteraction?: () => void }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return createElement(TeachingVisual, { ...snapshot, onParamChange: store.setParam,
    onInteractionStart: () => { store.stop(); onInteraction?.(); },
  });
}
function validTarget(target: Target): boolean {
  if (!target || typeof target !== "object") return false;
  if ("shapeId" in target) return typeof target.shapeId === "string" && target.shapeId.length > 0;
  if (!("bbox" in target) || !target.bbox) return false;
  return [target.bbox.x, target.bbox.y, target.bbox.w, target.bbox.h].every(Number.isFinite) && target.bbox.w > 0 && target.bbox.h > 0;
}

/** Implements the existing shared contract. The extra lifecycle methods do not change that contract. */
export function createVisualsApi(canvas: CanvasApi, options: VisualsOptions = {}): VisualsController {
  const stores = new Map<string, VisualStore>();
  const mounted = new Set<string>();
  const prefix = "math-" + (++instanceNumber) + "-";
  let sequence = 0;
  let disposed = false;

  const report = (error: unknown) => options.onError?.(error instanceof Error ? error.message : "Unable to draw this visual.");
  return {
    run(action: GraphAction) {
      if (disposed) return;
      if (!action || typeof action !== "object") { report(new Error("A visual action is needed.")); return; }
      try {
        if (action.type === "animateParam") {
          const id = visualId(action.plotId);
          const store = id && stores.get(id);
          if (!store) throw new Error("Draw the visual before changing one of its values.");
          if (!paramName(action.param)) throw new Error("Unsupported parameter name.");
          const from = finite(action.from, "Animation start"), to = finite(action.to, "Animation end");
          const ms = finite(action.ms, "Animation time");
          if (ms < 0 || ms > 60000) throw new Error("Animation time must be between 0 and 60000 milliseconds.");
          if (store.getSnapshot().spec.kind === "numberLine") throw new Error("Use a new number-line action to move its points.");
          store.animate(action.param, from, to, ms);
          return;
        }
        if (!validTarget(action.near)) throw new Error("A valid canvas position is needed.");
        if (action.type === "plot" && !visualId(action.id)) throw new Error("Give the plot an id so its values can change.");
        const spec = visualSpec(action);
        const id = (action.type === "plot" ? visualId(action.id) : visualId(action.args.id)) ?? (prefix + (++sequence));
        if (!mounted.has(id) && mounted.size >= 24) throw new Error("Clear the document's visuals before adding more.");
        stores.get(id)?.dispose();
        const store = new VisualStore(spec, options.clock);
        stores.set(id, store);
        mounted.add(id);
        canvas.mountVisual(id, action.near, createElement(ManagedVisual, { store, onInteraction: options.onInteraction }));
      } catch (error) {
        report(error);
        if (action.type !== "animateParam" && validTarget(action.near)) {
          try {
            const id = prefix + "error";
            mounted.add(id);
            canvas.mountVisual(id, action.near, createElement(VisualError));
          } catch (mountError) { report(mountError); }
        }
      }
    },
    stop() { stores.forEach((store) => store.stop()); },
    dispose() {
      if (disposed) return;
      disposed = true;
      stores.forEach((store) => store.dispose());
      mounted.forEach((id) => canvas.unmountVisual(id));
      stores.clear();
      mounted.clear();
    },
  };
}

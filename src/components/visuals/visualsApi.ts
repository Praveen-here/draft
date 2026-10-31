import { createElement } from "react";
import type { CanvasApi, VisualsApi } from "@/lib/contracts";
import { Graph } from "./Graph";

/** Turns graph-side visual actions into components placed on the canvas. */
export function createVisualsApi(canvas: CanvasApi): VisualsApi {
  const plots = new Map<string, { fn: string; xRange: [number, number]; params: Record<string, number> }>();

  return {
    run(action) {
      switch (action.type) {
        case "plot": {
          const plot = { fn: action.fn, xRange: action.xRange, params: action.params ?? {} };
          plots.set(action.id, plot);
          canvas.mountVisual(action.id, action.near, createElement(Graph, plot));
          break;
        }
        case "animateParam":
          // TODO(D): animate plots.get(action.plotId).params[action.param] from → to over ms.
          break;
        case "showVisual":
          // TODO(D): tangent / area / numberLine / table.
          break;
      }
    },
  };
}

import { parse } from "mathjs";
import { createElement } from "react";
import type { CanvasApi, VisualsApi } from "@/lib/contracts";
import { Graph } from "./Graph";
import { createPlotState, type PlotState } from "./plotState";

const RESERVED = new Set(["x", "e", "pi"]);

/** Turns graph-side visual actions into live graphs placed on the canvas. */
export function createVisualsApi(canvas: CanvasApi): VisualsApi {
  const plots = new Map<string, PlotState>();

  return {
    run(action) {
      switch (action.type) {
        case "plot": {
          const params = { ...paramsIn(action.fn), ...(action.params ?? {}) };
          const state = createPlotState({ fn: action.fn, xRange: action.xRange, yRange: action.yRange, params });
          plots.set(action.id, state);
          canvas.mountVisual(action.id, action.near, createElement(Graph, { state }));
          break;
        }
        case "animateParam": {
          const plot = plots.get(action.plotId);
          if (!plot) return;
          plot.animate(action.param, action.from, action.to, action.ms);
          break;
        }
        case "showVisual": {
          const plot = plots.get(String(action.args.plotId ?? ""));
          if (!plot) return;
          if (action.kind === "tangent") {
            const param = String(action.args.param ?? "t");
            const [x0, x1] = plot.get().xRange;
            const params = plot.get().params;
            plot.set({ tangentParam: param, params: { ...params, [param]: params[param] ?? (x0 + x1) / 2 } });
          }
          if (action.kind === "area") {
            plot.set({ area: [Number(action.args.from ?? 0), Number(action.args.to ?? 1)] });
          }
          break;
        }
      }
    },
  };
}

/** Every free variable in the formula besides x gets a default of 1 (Gemini sometimes forgets params). */
function paramsIn(fn: string): Record<string, number> {
  const out: Record<string, number> = {};
  try {
    parse(fn).traverse((node) => {
      const n = node as { isSymbolNode?: boolean; name?: string };
      if (n.isSymbolNode && n.name && !RESERVED.has(n.name) && !(n.name in Math)) out[n.name] = 1;
    });
  } catch {
    // unparseable: the graph shows nothing rather than crashing
  }
  return out;
}

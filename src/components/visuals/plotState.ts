/** Live state of one graph. Parameters change over time (animateParam); <Graph> re-renders on change. */
export type PlotSnapshot = {
  fn: string;
  xRange: [number, number];
  yRange?: [number, number];
  params: Record<string, number>;
  /** Draw the tangent at x = params[tangentParam]. */
  tangentParam?: string;
  /** Shade the area under the curve between these x values. */
  area?: [number, number];
};

export function createPlotState(initial: PlotSnapshot) {
  let snap = initial;
  const listeners = new Set<() => void>();
  let anims = 0;

  const set = (patch: Partial<PlotSnapshot>) => {
    snap = { ...snap, ...patch };
    listeners.forEach((fn) => fn());
  };

  return {
    get: () => snap,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    set,
    /** Smoothly move one parameter (ease in-out). Jumps straight there with reduced motion. */
    animate(param: string, from: number, to: number, ms: number) {
      const id = ++anims;
      const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce || ms <= 0) return set({ params: { ...snap.params, [param]: to } });
      const start = performance.now();
      const step = (now: number) => {
        if (id !== anims) return; // a newer animation took over
        const t = Math.min(1, (now - start) / ms);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        set({ params: { ...snap.params, [param]: from + (to - from) * e } });
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
  };
}

export type PlotState = ReturnType<typeof createPlotState>;

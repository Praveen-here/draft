import type { VisualAction } from "@/lib/contracts";

export type Range = [number, number];
export type CurveSpec = {
  kind: "plot" | "tangent" | "area";
  fn: string;
  xRange: Range;
  yRange: Range;
  params: Record<string, number>;
};
export type VisualSpec = CurveSpec
  | { kind: "numberLine"; range: Range; values: number[]; params: Record<string, number> }
  | { kind: "table"; fn: string; xs: number[]; params: Record<string, number> };
export type GraphAction = Extract<VisualAction, { type: "plot" | "animateParam" | "showVisual" }>;

export function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1e6)
    throw new Error(label + " must be a finite number between -1000000 and 1000000.");
  return value;
}
export function range(value: unknown, fallback: Range): Range {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.length !== 2) throw new Error("Use two numbers for the range.");
  const a = finite(value[0], "Range start"), b = finite(value[1], "Range end");
  if (b - a < 0.0001 || b - a > 10000) throw new Error("The range must increase and have a useful width.");
  return [a, b];
}
export function paramName(name: unknown): name is string {
  return typeof name === "string" && /^(?:[a-zA-Z]|alpha|beta|theta|phi|omega|at|from|to)$/.test(name) &&
    !["x", "e", "pi"].includes(name);
}
export function parameters(value: unknown): Record<string, number> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Parameters must be named numbers.");
  const entries = Object.entries(value);
  if (entries.length > 8) throw new Error("Use at most eight parameters.");
  return Object.fromEntries(entries.map(([key, number]) => {
    if (!paramName(key)) throw new Error("Unsupported parameter name.");
    return [key, finite(number, "Parameter")];
  }));
}
function formula(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 1500) throw new Error("A function is needed for this visual.");
  return value.trim();
}
function numbers(value: unknown, fallback: number[]): number[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || !value.length || value.length > 21) throw new Error("Use between 1 and 21 values.");
  return value.map((item) => finite(item, "Value"));
}
export function visualId(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new Error("Unsupported visual id.");
  return value;
}

export function visualSpec(action: Exclude<GraphAction, { type: "animateParam" }>): VisualSpec {
  if (action.type === "plot") return {
    kind: "plot", fn: formula(action.fn), xRange: range(action.xRange, [-4, 4]),
    yRange: [-4, 8], params: parameters(action.params),
  };
  const args = action.args;
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Visual arguments are missing.");
  if (action.kind === "numberLine") return {
    kind: "numberLine", range: range(args.range, [-5, 5]),
    values: numbers(args.values, [-2, 0, 2]), params: {},
  };
  if (action.kind === "table") return {
    kind: "table", fn: formula(args.fn), xs: numbers(args.xs, [-2, -1, 0, 1, 2]), params: parameters(args.params),
  };
  if (action.kind !== "tangent" && action.kind !== "area") throw new Error("This visual is not supported.");
  const params = parameters(args.params);
  if (action.kind === "tangent") params.at = finite(args.at ?? params.at ?? 1, "Tangent position");
  else {
    params.from = finite(args.from ?? params.from ?? 0, "Area start");
    params.to = finite(args.to ?? params.to ?? 2, "Area end");
  }
  return {
    kind: action.kind, fn: formula(args.fn), xRange: range(args.xRange, [-4, 4]),
    yRange: range(args.yRange, [-4, 8]), params,
  };
}

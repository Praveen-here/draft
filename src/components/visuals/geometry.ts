import type { Expr } from "@/lib/math";
import type { Range } from "./model";

export type Point2 = [number, number];

/** Split at undefined values and asymptotes instead of drawing a line across the gap. */
export function sampleCurve(evaluate: (x: number) => number, xRange: Range, yRange: Range, count = 384): Point2[][] {
  const segments: Point2[][] = [];
  let current: Point2[] = [];
  const span = yRange[1] - yRange[0];
  const flush = () => {
    if (current.length > 1) segments.push(current);
    current = [];
  };
  for (let index = 0; index <= count; index++) {
    const x = xRange[0] + (xRange[1] - xRange[0]) * index / count;
    const y = evaluate(x);
    if (!Number.isFinite(y) || y < yRange[0] - span * 3 || y > yRange[1] + span * 3) {
      flush();
      continue;
    }
    if (current.length && Math.abs(y - current[current.length - 1][1]) > span * 1.5) flush();
    current.push([x, y]);
  }
  flush();
  return segments;
}

export function areaPolygons(evaluate: (x: number) => number, from: number, to: number, yRange: Range): Point2[][] {
  if (from === to) return [];
  return sampleCurve(evaluate, [Math.min(from, to), Math.max(from, to)], yRange, 192).map((segment) => [
    [segment[0][0], 0], ...segment, [segment[segment.length - 1][0], 0],
  ]);
}

export function tangentAt(expression: Expr, derivative: Expr | null, at: number, params: Record<string, number>):
  { point: Point2; slope: number } | null {
  const y = expression.evaluate({ ...params, x: at });
  const slope = derivative?.evaluate({ ...params, x: at }) ?? NaN;
  if (!Number.isFinite(y) || !Number.isFinite(slope)) return null;
  // Reject cusps and domain edges even if a symbolic sign function supplies a value at the corner.
  const h = 1e-5 * Math.max(1, Math.abs(at));
  const before = expression.evaluate({ ...params, x: at - h });
  const after = expression.evaluate({ ...params, x: at + h });
  const left = (y - before) / h, right = (after - y) / h;
  if (!Number.isFinite(left) || !Number.isFinite(right) ||
      Math.abs(left - right) > 0.002 * Math.max(1, Math.abs(left), Math.abs(right))) return null;
  return { point: [at, y], slope };
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "undefined";
  if (Math.abs(value) < 1e-10) return "0";
  return String(Number(value.toPrecision(4)));
}

export function tickStep(span: number): number {
  const rough = span / 8;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 5, 10].find((step) => step * magnitude >= rough)! * magnitude;
}

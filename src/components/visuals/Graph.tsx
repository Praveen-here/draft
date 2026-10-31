"use client";

import { compile, parse, type EvalFunction } from "mathjs";
import { useId, useMemo, useSyncExternalStore } from "react";
import type { PlotState } from "./plotState";

const W = 380;
const H = 270;
const PAD = { l: 14, r: 14, t: 40, b: 16 };
const SAMPLES = 260;

const INK = "#2547d0";
const GREEN = "#168a52";

/** Graph of a function whose parameters can change live while ∂raft talks. */
export function Graph({ state }: { state: PlotState }) {
  const snap = useSyncExternalStore(state.subscribe, state.get, state.get);
  const f = useMemo(() => compileFn(snap.fn), [snap.fn]);
  const clipId = `clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // Fix the y-range when the graph appears, so axes stay still while values slide.
  const yRange = useMemo(
    () => snap.yRange ?? autoRange(f, snap.xRange, snap.params),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally computed once per function
    [f, snap.xRange[0], snap.xRange[1], snap.yRange?.[0], snap.yRange?.[1]],
  );

  const [x0, x1] = snap.xRange;
  const [y0, y1] = yRange;
  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + (1 - (y - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
  const at = (x: number) => evaluate(f, x, snap.params);

  const curve = pathFor(at, x0, x1, sx, sy, y0, y1);

  let areaPath = "";
  if (snap.area) {
    const [a, b] = [Math.max(x0, Math.min(snap.area[0], snap.area[1])), Math.min(x1, Math.max(snap.area[0], snap.area[1]))];
    const pts: string[] = [`M${sx(a)},${sy(clampY(0, y0, y1))}`];
    for (let i = 0; i <= 80; i++) {
      const x = a + ((b - a) * i) / 80;
      const y = at(x);
      if (Number.isFinite(y)) pts.push(`L${sx(x)},${sy(clampY(y, y0, y1))}`);
    }
    pts.push(`L${sx(b)},${sy(clampY(0, y0, y1))}Z`);
    areaPath = pts.join(" ");
  }

  let tangent: { x: number; y: number; slope: number } | null = null;
  if (snap.tangentParam && snap.params[snap.tangentParam] !== undefined) {
    const x = snap.params[snap.tangentParam];
    const h = (x1 - x0) / 1000;
    const y = at(x);
    const slope = (at(x + h) - at(x - h)) / (2 * h);
    if (Number.isFinite(y) && Number.isFinite(slope)) tangent = { x, y, slope };
  }

  const label = prettify(snap.fn);
  const chips = Object.entries(snap.params).map(([k, v]) => `${k} = ${round(v)}`);
  if (tangent) chips.push(`slope = ${round(tangent.slope)}`);

  return (
    <div className="h-full w-full overflow-hidden rounded-[18px] border border-[rgba(15,23,42,0.08)] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_16px_40px_-16px_rgba(23,37,110,0.28)]">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Graph of y = ${label}`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} />
          </clipPath>
        </defs>

        <text x={PAD.l} y={24} fontSize={15} fontWeight={600} fill="#0b0d12" letterSpacing="-0.01em">
          y = {label}
        </text>
        <text x={W - PAD.r} y={24} fontSize={13} fontWeight={600} fill={INK} textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>
          {chips.join("   ")}
        </text>

        <g clipPath={`url(#${clipId})`}>
          <Grid x0={x0} x1={x1} y0={y0} y1={y1} sx={sx} sy={sy} />
          {areaPath && <path d={areaPath} fill="rgba(37,71,208,0.14)" />}
          <path d={curve} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          {tangent && (
            <>
              <line
                x1={sx(x0)}
                y1={sy(tangent.y + tangent.slope * (x0 - tangent.x))}
                x2={sx(x1)}
                y2={sy(tangent.y + tangent.slope * (x1 - tangent.x))}
                stroke={GREEN}
                strokeWidth={2}
                strokeDasharray="6 5"
              />
              <circle cx={sx(tangent.x)} cy={sy(tangent.y)} r={5} fill={GREEN} stroke="#fff" strokeWidth={2} />
            </>
          )}
        </g>
      </svg>
    </div>
  );
}

function Grid({ x0, x1, y0, y1, sx, sy }: { x0: number; x1: number; y0: number; y1: number; sx: (x: number) => number; sy: (y: number) => number }) {
  const xs = ticks(x0, x1);
  const ys = ticks(y0, y1);
  return (
    <g>
      {xs.map((x) => (
        <line key={`x${x}`} x1={sx(x)} x2={sx(x)} y1={0} y2={H} stroke="rgba(60,60,67,0.08)" />
      ))}
      {ys.map((y) => (
        <line key={`y${y}`} y1={sy(y)} y2={sy(y)} x1={0} x2={W} stroke="rgba(60,60,67,0.08)" />
      ))}
      {y0 < 0 && y1 > 0 && <line x1={0} x2={W} y1={sy(0)} y2={sy(0)} stroke="rgba(60,60,67,0.45)" strokeWidth={1.2} />}
      {x0 < 0 && x1 > 0 && <line y1={0} y2={H} x1={sx(0)} x2={sx(0)} stroke="rgba(60,60,67,0.45)" strokeWidth={1.2} />}
      {xs.filter((x) => x !== 0).map((x) => (
        <text key={`lx${x}`} x={sx(x)} y={Math.min(H - PAD.b + 12, Math.max(PAD.t + 12, sy(0) + 13))} fontSize={10} fill="#8a8f9c" textAnchor="middle">
          {round(x)}
        </text>
      ))}
    </g>
  );
}

function compileFn(fn: string): EvalFunction | null {
  try {
    return compile(fn.replace(/\*\*/g, "^"));
  } catch {
    return null;
  }
}

function evaluate(f: EvalFunction | null, x: number, params: Record<string, number>): number {
  if (!f) return NaN;
  try {
    const y = f.evaluate({ ...params, x, e: Math.E, pi: Math.PI });
    return typeof y === "number" ? y : NaN;
  } catch {
    return NaN;
  }
}

function autoRange(f: EvalFunction | null, [x0, x1]: [number, number], params: Record<string, number>): [number, number] {
  const ys: number[] = [];
  for (let i = 0; i <= 120; i++) {
    const y = evaluate(f, x0 + ((x1 - x0) * i) / 120, params);
    if (Number.isFinite(y)) ys.push(y);
  }
  if (!ys.length) return [-5, 5];
  ys.sort((a, b) => a - b);
  let lo = ys[Math.floor(ys.length * 0.03)];
  let hi = ys[Math.ceil(ys.length * 0.97) - 1];
  lo = Math.min(lo, 0);
  hi = Math.max(hi, 0);
  if (hi - lo < 1e-6) [lo, hi] = [lo - 1, hi + 1];
  const pad = (hi - lo) * 0.12;
  return [lo - pad, hi + pad];
}

function pathFor(at: (x: number) => number, x0: number, x1: number, sx: (x: number) => number, sy: (y: number) => number, y0: number, y1: number) {
  const span = y1 - y0;
  let d = "";
  let pen = false;
  for (let i = 0; i <= SAMPLES; i++) {
    const x = x0 + ((x1 - x0) * i) / SAMPLES;
    const y = at(x);
    if (!Number.isFinite(y) || y < y0 - span * 4 || y > y1 + span * 4) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${sx(x).toFixed(2)},${sy(y).toFixed(2)}`;
    pen = true;
  }
  return d;
}

function ticks(a: number, b: number): number[] {
  const step = niceStep((b - a) / 6);
  const out: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}

const clampY = (y: number, y0: number, y1: number) => Math.min(y1, Math.max(y0, y));
const round = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Number(v.toFixed(2)).toString());

/** "a*x^2" → "a·x²", readable on the graph label. */
function prettify(fn: string) {
  const sup: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  try {
    parse(fn);
  } catch {
    return fn;
  }
  return fn
    .replace(/\s+/g, "")
    .replace(/\^(\d)/g, (_, d: string) => sup[d])
    .replace(/exp\(x\)/g, "eˣ")
    .replace(/\*/g, "·")
    .replace(/sqrt/g, "√");
}

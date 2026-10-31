"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { parseLatex } from "@/lib/math";
import { TeachingVisual } from "./Graph";
import { parameters, range, type CurveSpec, type Range } from "./model";
import styles from "./explorer.module.css";

type Preset = { name: string; fn: string; params: Record<string, number>; x: Range; y: Range; path: string };
const presets: Preset[] = [
  { name: "Wave", fn: "a*sin(b*x+c)", params: { a: 1.5, b: 1, c: 0 }, x: [-6.3, 6.3], y: [-3, 3], path: "M2 16 C8 -2 14 -2 20 16 S32 34 38 16 S50 -2 56 16" },
  { name: "Parabola", fn: "a*x^2+b*x+c", params: { a: 1, b: 0, c: 0 }, x: [-3, 3], y: [-2, 9], path: "M4 2 Q29 60 54 2" },
  { name: "Cubic", fn: "a*x^3+b*x", params: { a: 0.5, b: -1 }, x: [-3, 3], y: [-5, 5], path: "M5 30 C14 0 24 4 29 16 S44 32 53 2" },
  { name: "Reciprocal", fn: "a/(x-b)", params: { a: 1, b: 0 }, x: [-5, 5], y: [-4, 4], path: "M2 19 C18 19 23 22 25 31 M33 1 C35 12 40 14 56 14" },
];
const clamp = (value: number, bounds: Range) => Math.max(bounds[0], Math.min(bounds[1], value));

function makeSpec(fn: string, kind: CurveSpec["kind"], values: Record<string, number>, xRange: Range, yRange: Range): CurveSpec {
  const expression = parseLatex(fn);
  if (!expression || expression.integralVariables.length) throw new Error("Try a function such as sin(x), x^3 - x, or a*x^2. Check brackets and notation.");
  const params = parameters(Object.fromEntries(expression.variables.filter((name) => name !== "x")
    .map((name) => [name, values[name] ?? (name === "c" ? 0 : 1)])));
  if (kind === "tangent") params.at = clamp(values.at ?? 1, xRange);
  if (kind === "area") {
    params.from = clamp(values.from ?? 0, xRange);
    params.to = clamp(values.to ?? 2, xRange);
  }
  return { kind, fn: fn.trim(), params, xRange, yRange };
}
const first = presets[0];

/** Optional exploration UI for a student's own function; uses the same real teaching components. */
export function FunctionExplorer() {
  const id = useId();
  const [draft, setDraft] = useState(first.fn);
  const [spec, setSpec] = useState(() => makeSpec(first.fn, "plot", first.params, first.x, first.y));
  const [error, setError] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [rangeDraft, setRangeDraft] = useState([String(first.x[0]), String(first.x[1]), String(first.y[0]), String(first.y[1])]);
  const resetParams = useRef(first.params);
  const updateRanges = (x: Range, y: Range) => setRangeDraft([...x, ...y].map(String));
  const choose = (preset: Preset) => {
    setDraft(preset.fn); setError(""); setRangeError(""); resetParams.current = preset.params;
    setSpec(makeSpec(preset.fn, spec.kind, preset.params, preset.x, preset.y));
    updateRanges(preset.x, preset.y);
  };
  const draw = (event: FormEvent) => {
    event.preventDefault();
    try {
      const next = makeSpec(draft, spec.kind, spec.params, spec.xRange, spec.yRange);
      resetParams.current = { ...next.params };
      setSpec(next); setError("");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Check the function and try again."); }
  };
  const applyRange = (event: FormEvent) => {
    event.preventDefault();
    try {
      if (rangeDraft.some((value) => !value.trim())) throw new Error("Enter all four range limits.");
      const limits = rangeDraft.map(Number);
      const x = range(limits.slice(0, 2), spec.xRange), y = range(limits.slice(2), spec.yRange);
      setSpec(makeSpec(spec.fn, spec.kind, spec.params, x, y));
      setRangeError("");
    } catch (problem) { setRangeError(problem instanceof Error ? problem.message : "Check the range limits."); }
  };
  return <div className={styles.explorer} data-testid="function-explorer">
    <div className={styles.editor}>
      <p className={styles.eyebrow}>FUNCTION LAB</p>
      <h2>Make the graph yours.</h2>
      <p className={styles.intro}>Start with a shape, or write your own. Grab a point and see what the maths is doing.</p>
      <div className={styles.presets} aria-label="Function examples">
        {presets.map((preset) => <button type="button" key={preset.name} aria-pressed={spec.fn === preset.fn}
          onClick={() => choose(preset)}>
          <svg viewBox="0 0 58 32" width="44" height="28" aria-hidden="true"><path d={preset.path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          {preset.name}
        </button>)}
      </div>
      <form onSubmit={draw} className={styles.functionForm}>
        <label htmlFor={id + "-function"}>Your function</label>
        <div className={styles.functionField}><span aria-hidden="true">f(x) =</span>
          <input id={id + "-function"} value={draft} maxLength={1500} spellCheck={false}
            aria-describedby={id + "-help"} aria-invalid={!!error}
            onChange={(event) => { setDraft(event.target.value); setError(""); }} />
        </div>
        <p id={id + "-help"} className={styles.help}>Use x for the input. Letters like a, b and c become sliders.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="submit" className={styles.draw}>Draw function <span aria-hidden="true">↗</span></button>
      </form>
      <div className={styles.modeLabel}>Explore it as</div>
      <div className={styles.modes} role="group" aria-label="Function view">
        {(["plot", "tangent", "area"] as const).map((kind) => <button key={kind} type="button" aria-pressed={spec.kind === kind}
          onClick={() => setSpec(makeSpec(spec.fn, kind, spec.params, spec.xRange, spec.yRange))}>
          {kind === "plot" ? "Curve" : kind === "tangent" ? "Tangent" : "Area"}
        </button>)}
      </div>
      <details className={styles.viewRange}>
        <summary>View range</summary>
        <form onSubmit={applyRange}>
          <div className={styles.ranges}>{["x minimum", "x maximum", "y minimum", "y maximum"].map((label, index) =>
            <label key={label} htmlFor={id + "-range-" + index}>{label}<input id={id + "-range-" + index}
              type="number" step="any" value={rangeDraft[index]} onChange={(event) => {
                setRangeDraft((current) => current.map((value, at) => at === index ? event.target.value : value)); setRangeError("");
              }} /></label>)}</div>
          {rangeError && <p className={styles.error} role="alert">{rangeError}</p>}
          <button className={styles.applyRange} type="submit">Apply range</button>
        </form>
      </details>
    </div>
    <div className={styles.workspace}>
      <div className={styles.workspaceHeader}><span><i />LIVE EXPLORATION</span>
        <button type="button" onClick={() => setSpec(makeSpec(spec.fn, spec.kind, resetParams.current, spec.xRange, spec.yRange))}>Reset values</button>
      </div>
      <TeachingVisual spec={spec} onParamChange={(name, value) =>
        setSpec((current) => ({ ...current, params: { ...current.params, [name]: value } }))} />
      <p className={styles.footnote}>Follow a point, compare slopes, or reshape an area. Change one thing and notice what happens.</p>
    </div>
  </div>;
}

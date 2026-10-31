"use client";

import { useId, useMemo, useState, type SVGProps } from "react";
import { Coordinates, Line, Mafs, Point, Polygon, Polyline } from "mafs";
import { differentiateExpression, parseLatex } from "@/lib/math";
import { MathText } from "./MathText";
import { DragHandle } from "./DragHandle";
import { areaPolygons, formatNumber, sampleCurve, tangentAt, tickStep } from "./geometry";
import type { CurveSpec, Range, VisualSpec } from "./model";
import "mafs/core.css";
import styles from "./visuals.module.css";

const BLUE = "#2547d0";
const GREEN = "#168a52";
function svgMarker<T extends SVGElement>(id: string): SVGProps<T> & { "data-testid": string } {
  return { "data-testid": id };
}
type Controls = { onParamChange?: (param: string, value: number) => void; onInteractionStart?: () => void; animating?: boolean };

export function VisualError({ message = "I couldn't draw this expression yet. Check the function and its values." }: { message?: string }) {
  return <div className={styles.error} role="status"><span aria-hidden="true">∿</span><p>{message}</p></div>;
}

function ParamControls({ spec, onParamChange, onInteractionStart }: { spec: CurveSpec } & Controls) {
  const id = useId();
  if (!onParamChange || !Object.keys(spec.params).length) return null;
  return <div className={styles.controls} onPointerDown={(event) => { event.stopPropagation(); onInteractionStart?.(); }}>
    {Object.entries(spec.params).map(([name, value]) => {
      const position = name === "at" || name === "from" || name === "to";
      const label = name === "at" ? "Tangent position" : name === "from" ? "Area start"
        : name === "to" ? "Area end" : "Parameter " + name;
      const min = position ? spec.xRange[0] : Math.min(-5, Math.floor(value));
      const max = position ? spec.xRange[1] : Math.max(5, Math.ceil(value));
      return <div className={styles.control} key={name}>
        <div className={styles.controlLabel}>
          <label htmlFor={id + name}>{label}</label>
          <output htmlFor={id + name}><MathText latex={formatNumber(value)} /></output>
        </div>
        <input id={id + name} type="range" min={min} max={max} step={(max - min) / 200}
          value={value} aria-label={label} aria-valuetext={formatNumber(value)}
          onChange={(event) => { onInteractionStart?.(); onParamChange(name, Number(event.target.value)); }} />
      </div>;
    })}
  </div>;
}

function Curve({ spec, onParamChange, onInteractionStart, animating = false }: { spec: CurveSpec } & Controls) {
  const [traceAt, setTraceAt] = useState(1);
  const expression = useMemo(() => parseLatex(spec.fn), [spec.fn]);
  const derivative = useMemo(() => expression && spec.kind === "tangent"
    ? differentiateExpression(expression) : null, [expression, spec.kind]);
  const geometry = useMemo(() => {
    if (!expression) return null;
    const missing = expression.variables.filter((name) => name !== "x" && !Object.hasOwn(spec.params, name));
    if (missing.length) return { error: "Give a value for " + missing.join(", ") + " to draw this curve." };
    const evaluate = (x: number) => expression.evaluate({ ...spec.params, x });
    return {
      segments: sampleCurve(evaluate, spec.xRange, spec.yRange),
      tangent: spec.kind === "tangent" ? tangentAt(expression, derivative, spec.params.at, spec.params) : null,
      areas: spec.kind === "area" ? areaPolygons(evaluate, spec.params.from, spec.params.to, spec.yRange) : [],
    };
  }, [expression, derivative, spec]);
  const at = spec.kind === "tangent" ? spec.params.at : Math.max(spec.xRange[0], Math.min(spec.xRange[1], traceAt));
  const value = expression?.evaluate({ ...spec.params, x: at }) ?? NaN;
  const inView = Number.isFinite(value) && value >= spec.yRange[0] && value <= spec.yRange[1];
  const baseline = Math.max(spec.yRange[0], Math.min(spec.yRange[1], 0));
  const movable = spec.kind === "plot" || !!onParamChange;
  const title = spec.kind === "tangent" ? "The slope at a point" : spec.kind === "area" ? "Area under the curve" : "A function, in view";
  return <figure className={styles.card} data-visual-kind={spec.kind}>
    <figcaption className={styles.header}>
      <div><p className={styles.eyebrow}>{spec.kind === "plot" ? "Function graph" : spec.kind === "tangent" ? "Tangent line" : "Signed area"}</p>
        <h3>{title}</h3>
        <div className={styles.formula}><MathText latex={"f(x)=" + (expression?.latex || spec.fn)} /></div>
      </div>
      <span className={animating ? styles.live : styles.badge}>{animating ? "● Live" : "Explore"}</span>
    </figcaption>
    {!geometry || "error" in geometry ? <VisualError message={geometry && "error" in geometry ? geometry.error : undefined} /> :
      <>
        <div className={styles.plot} role="group" aria-label={title + " for " + spec.fn}>
          <Mafs height={270} pan={false} zoom={false} preserveAspectRatio={false}
            viewBox={{ x: spec.xRange, y: spec.yRange, padding: 0.3 }}>
            <Coordinates.Cartesian
              xAxis={{ lines: tickStep(spec.xRange[1] - spec.xRange[0]) }}
              yAxis={{ lines: tickStep(spec.yRange[1] - spec.yRange[0]) }} />
            {geometry.areas.map((points, index) =>
              <Polygon key={"area" + index} points={points} color={GREEN} fillOpacity={0.18} strokeOpacity={0}
                svgPolygonProps={svgMarker<SVGPolygonElement>("shaded-area")} />)}
            {geometry.segments.map((points, index) =>
              <Polyline key={index} points={points} color={BLUE} weight={2.5}
                svgPolylineProps={svgMarker<SVGPolylineElement>("function-curve")} />)}
            {geometry.tangent && <>
              <Line.PointSlope point={geometry.tangent.point} slope={geometry.tangent.slope} color={GREEN} weight={2} />
              <Line.Segment point1={[geometry.tangent.point[0], 0]} point2={geometry.tangent.point}
                color={GREEN} opacity={0.4} style="dashed" />
              {!onParamChange && <Point x={geometry.tangent.point[0]} y={geometry.tangent.point[1]} color={GREEN}
                svgCircleProps={svgMarker<SVGCircleElement>("tangent-point")} />}
            </>}
            {spec.kind !== "area" && movable && <>
              {spec.kind === "plot" && inView && <Line.Segment point1={[at, baseline]} point2={[at, value]}
                color={GREEN} opacity={0.4} style="dashed" />}
              <DragHandle point={[at, inView ? value : baseline]} range={spec.xRange} color={GREEN}
                label={spec.kind === "tangent" ? "Drag tangent point" : "Point on curve"}
                marker={spec.kind === "tangent" ? "tangent-point" : "trace-point"}
                onChange={(x) => spec.kind === "tangent" ? onParamChange?.("at", x) : setTraceAt(x)}
                onInteractionStart={onInteractionStart} />
            </>}
            {spec.kind === "area" && onParamChange && (["from", "to"] as const).map((boundary) => {
              const x = spec.params[boundary];
              return <g key={boundary}>
                <Line.Segment point1={[x, spec.yRange[0]]} point2={[x, spec.yRange[1]]}
                  color={GREEN} style="dashed" opacity={0.35} />
                <DragHandle point={[x, baseline]} range={spec.xRange} color={boundary === "from" ? BLUE : GREEN}
                  label={boundary === "from" ? "Drag area start" : "Drag area end"}
                  marker={"area-" + boundary} caption={boundary === "from" ? "start" : "end"}
                  onChange={(next) => onParamChange(boundary, next)} onInteractionStart={onInteractionStart} />
              </g>;
            })}
          </Mafs>
        </div>
        {movable && <p className={styles.dragHint}>{spec.kind === "area"
          ? "Drag start and end to reshape the shaded region."
          : "Drag the green point. Use ← → for a precise move."}</p>}
        <div className={styles.legend}><span><i style={{ background: BLUE }} />Function</span>
          {spec.kind !== "plot" && <span><i style={{ background: GREEN }} />{spec.kind === "tangent" ? "Tangent" : "Area"}</span>}
          <span className={styles.range}><MathText latex={formatNumber(spec.xRange[0]) + "\\leq x\\leq" + formatNumber(spec.xRange[1])} /></span>
        </div>
        {spec.kind === "tangent" && <div className={styles.readout}>
          <span>At <MathText latex={"x=" + formatNumber(spec.params.at)} /></span>
          <span className={styles.slope} data-testid="slope-value">{geometry.tangent
            ? <>Slope <MathText latex={formatNumber(geometry.tangent.slope)} /></>
            : "No finite tangent here"}</span>
        </div>}
        {spec.kind === "area" && <div className={styles.readout}>
          <span>Shaded between <MathText latex={"x=" + formatNumber(spec.params.from)} /> and <MathText latex={"x=" + formatNumber(spec.params.to)} /></span>
        </div>}
        {spec.kind === "plot" && <div className={styles.traceReadout} data-testid="trace-value">
          <span><MathText latex={"x=" + formatNumber(at)} /></span>
          <span><MathText latex={"f(x)=" + (Number.isFinite(value) ? formatNumber(value) : "\\text{undefined}")} /></span>
        </div>}
        {spec.kind !== "area" && !inView && <p className={styles.note}>{Number.isFinite(value)
          ? "The curve is outside this view at the selected x. Drag the handle along the axis."
          : "The function is undefined at this x. Drag the handle along the axis."}</p>}
        {spec.kind === "plot" && Object.keys(spec.params).length > 0 && <div className={styles.readout}>
          {Object.entries(spec.params).map(([name, value]) =>
            <span key={name} data-param={name}><MathText latex={name + "=" + formatNumber(value)} /></span>)}
        </div>}
        {!geometry.segments.length && <p className={styles.note}>No finite curve is visible in this range.</p>}
      </>}
    <ParamControls spec={spec} onParamChange={onParamChange} onInteractionStart={onInteractionStart} />
  </figure>;
}

/** Public standalone plot. Pass updated params, or onParamChange to show its sliders. */
export function Graph({ fn, xRange, params = {}, yRange = [-4, 8], onParamChange, onInteractionStart, animating }: {
  fn: string; xRange: Range; params?: Record<string, number>; yRange?: Range;
} & Controls) {
  const spec = useMemo<CurveSpec>(() => ({ kind: "plot", fn, xRange, yRange, params }), [fn, xRange, yRange, params]);
  return <Curve spec={spec} onParamChange={onParamChange} onInteractionStart={onInteractionStart} animating={animating} />;
}

function NumberLine({ spec }: { spec: Extract<VisualSpec, { kind: "numberLine" }> }) {
  const width = 420, pad = 28;
  const position = (value: number) => pad + (value - spec.range[0]) / (spec.range[1] - spec.range[0]) * (width - 2 * pad);
  const step = tickStep(spec.range[1] - spec.range[0]);
  const ticks: number[] = [];
  for (let value = Math.ceil(spec.range[0] / step) * step; value <= spec.range[1] + step * 0.001; value += step) ticks.push(value);
  const visible = spec.values.filter((value) => value >= spec.range[0] && value <= spec.range[1]);
  return <figure className={styles.card} data-visual-kind="numberLine">
    <figcaption className={styles.header}><div><p className={styles.eyebrow}>Number line</p><h3>Where the values belong</h3></div></figcaption>
    <svg className={styles.numberLine} viewBox={"0 0 " + width + " 110"} role="img"
      aria-label={"Number line from " + spec.range[0] + " to " + spec.range[1] + ", with points " + visible.join(", ")}>
      <line x1={pad} y1={53} x2={width - pad} y2={53} stroke="#8a8f9c" strokeWidth={1.5} />
      {ticks.map((value) => <g key={value}>
        <line x1={position(value)} y1={47} x2={position(value)} y2={59} stroke="#8a8f9c" />
        <text x={position(value)} y={82} textAnchor="middle" fill="#5b6170" fontSize={12}>{formatNumber(value)}</text>
      </g>)}
      {visible.map((value, index) => <g key={index}>
        <circle cx={position(value)} cy={53} r={6} fill={BLUE} />
        <text x={position(value)} y={29} textAnchor="middle" fill={BLUE} fontSize={13} fontWeight={600}>{formatNumber(value)}</text>
      </g>)}
    </svg>
    <p className={styles.note}>Further right means greater. Compare the distance from zero.</p>
  </figure>;
}

function ValueTable({ spec }: { spec: Extract<VisualSpec, { kind: "table" }> }) {
  const expression = useMemo(() => parseLatex(spec.fn), [spec.fn]);
  return <figure className={styles.card} data-visual-kind="table">
    <figcaption className={styles.header}><div><p className={styles.eyebrow}>Table of values</p><h3>Look for the pattern</h3>
      <div className={styles.formula}><MathText latex={"f(x)=" + (expression?.latex || spec.fn)} /></div>
    </div></figcaption>
    {!expression ? <VisualError /> : <div className={styles.tableWrap}><table>
      <thead><tr><th scope="col"><MathText latex="x" /></th><th scope="col"><MathText latex="f(x)" /></th></tr></thead>
      <tbody>{spec.xs.map((x, index) => {
        const value = expression.evaluate({ ...spec.params, x });
        return <tr key={index}><th scope="row"><MathText latex={formatNumber(x)} /></th><td>
          {Number.isFinite(value) ? <MathText latex={formatNumber(value)} /> : <span className={styles.undefined}>undefined</span>}
        </td></tr>;
      })}</tbody>
    </table></div>}
  </figure>;
}

export function TeachingVisual({ spec, ...controls }: { spec: VisualSpec } & Controls) {
  if (spec.kind === "numberLine") return <NumberLine spec={spec} />;
  if (spec.kind === "table") return <ValueTable spec={spec} />;
  return <Curve spec={spec} {...controls} />;
}

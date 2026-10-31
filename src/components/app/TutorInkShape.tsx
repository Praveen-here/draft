"use client";

import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BaseBoxShapeUtil, HTMLContainer, T, type TLShape } from "tldraw";
import katex from "katex";
import "katex/dist/katex.min.css";

type InkProps = {
  w: number; h: number; kind: "highlight" | "writeStep" | "tick" | "cross" | "circle";
  latex: string; colour: "blue" | "green" | "red";
};

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap { "tutor-ink": InkProps }
}

type TutorInkShape = TLShape<"tutor-ink">;
const colours = { blue: "#2547d0", green: "#16824b", red: "#c43c4b" };

export class TutorInkShapeUtil extends BaseBoxShapeUtil<TutorInkShape> {
  static override type = "tutor-ink" as const;
  static override props = {
    w: T.positiveNumber, h: T.positiveNumber, latex: T.string,
    kind: T.literalEnum("highlight", "writeStep", "tick", "cross", "circle"),
    colour: T.literalEnum("blue", "green", "red"),
  };
  override getDefaultProps(): InkProps { return { w: 200, h: 80, kind: "highlight", latex: "", colour: "blue" }; }
  override canEdit() { return false; }
  override canResize() { return false; }
  override getIndicatorPath() { return undefined; }
  override getText(shape: TutorInkShape) { return shape.props.kind === "writeStep" ? shape.props.latex : "Tutor " + shape.props.kind; }
  override component(shape: TutorInkShape) { return <TutorInk shape={shape} />; }
}

function TutorInk({ shape }: { shape: TutorInkShape }) {
  const { w, h, kind, latex, colour } = shape.props;
  const reduced = useReducedMotion();
  const id = useId();
  const html = useMemo(() => kind === "writeStep"
    ? katex.renderToString(latex, { throwOnError: false, trust: false, maxExpand: 100, maxSize: 10, displayMode: true })
    : "", [kind, latex]);
  const path = kind === "tick" ? "M5 19 L15 29 L34 6"
    : kind === "cross" ? "M8 8 L30 30 M30 8 L8 30"
    : "M2 20 C2 -3 38 -3 38 20 C38 43 2 43 2 20";
  return (
    <HTMLContainer style={{ width: w, height: h, color: colours[colour], overflow: "visible", pointerEvents: "none" }}>
      <svg width={w} height={h} role="img" aria-label={kind === "writeStep" ? "Tutor step: " + latex : "Tutor " + kind}>
        {kind === "highlight" ? (
          <rect width={w} height={h} rx={5} fill="currentColor" fillOpacity={0.14} stroke="currentColor" strokeOpacity={0.4} />
        ) : kind === "writeStep" ? (
          <>
            <defs>
              <mask id={id}>
                <motion.path d={"M0 " + h / 2 + " H" + w} stroke="white" strokeWidth={h * 2} pathLength={1}
                  strokeDasharray="1" initial={reduced ? false : { strokeDashoffset: 1 }}
                  animate={{ strokeDashoffset: 0 }} transition={{ duration: 0.85, ease: "linear" }} />
              </mask>
            </defs>
            <foreignObject width={w} height={h} mask={"url(#" + id + ")"}>
              <div className="canvas-tutor-step">
                <span className="hand text-sm">One step</span>
                <div className="canvas-equation" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            </foreignObject>
          </>
        ) : (
          <svg width={w} height={h} viewBox="0 0 40 40" preserveAspectRatio="none">
            <motion.path d={path} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
              vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray="1"
              initial={reduced ? false : { strokeDashoffset: 1 }} animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.3 }} />
          </svg>
        )}
      </svg>
    </HTMLContainer>
  );
}

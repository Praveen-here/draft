"use client";

import { useRef } from "react";
import { useMovable, useTransformContext, vec } from "mafs";
import { formatNumber, type Point2 } from "./geometry";
import type { Range } from "./model";
import styles from "./visuals.module.css";

/** A labelled, keyboard-accessible handle that follows the pointer in graph coordinates. */
export function DragHandle({ point, range, label, color, marker, caption, onChange, onInteractionStart }: {
  point: Point2; range: Range; label: string; color: string; marker: string; caption?: string;
  onChange: (x: number) => void; onInteractionStart?: () => void;
}) {
  const target = useRef<SVGGElement>(null!);
  const clamp = (x: number) => Math.max(range[0], Math.min(range[1], x));
  const { dragging } = useMovable({
    gestureTarget: target, point,
    constrain: ([x]) => [clamp(x), point[1]],
    onMove: ([x]) => onChange(Number(x.toPrecision(10))),
  });
  const { viewTransform, userTransform } = useTransformContext();
  const [cx, cy] = vec.transform(point, vec.matrixMult(viewTransform, userTransform));
  return <g ref={target} className={styles.dragHandle} data-dragging={dragging} data-testid={marker + "-handle"}
    role="slider" tabIndex={0} aria-label={label} aria-orientation="horizontal"
    aria-valuemin={range[0]} aria-valuemax={range[1]} aria-valuenow={point[0]}
    aria-valuetext={"x = " + formatNumber(point[0])}
    onPointerDownCapture={() => onInteractionStart?.()}
    onKeyDownCapture={(event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      onInteractionStart?.();
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault(); event.stopPropagation(); onChange(event.key === "Home" ? range[0] : range[1]);
      }
    }}>
    <circle cx={cx} cy={cy} r={24} fill="transparent" />
    <circle className={styles.handleHalo} cx={cx} cy={cy} r={15} fill={color} fillOpacity={0.13} stroke={color} strokeOpacity={0.3} />
    <circle className={styles.handleFocus} cx={cx} cy={cy} r={19} fill="none" stroke={color} strokeWidth={2} />
    <circle data-testid={marker} cx={cx} cy={cy} r={6} fill={color} stroke="white" strokeWidth={2} />
    {caption && <text x={cx} y={cy - 23} textAnchor="middle" fill={color} className={styles.handleCaption}>{caption}</text>}
  </g>;
}

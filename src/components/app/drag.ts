import { animate } from "motion/react";

export type Pt = { x: number; y: number };
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Where a flick would come to rest (Apple's projection; 0.99 = a short, snappy throw). */
const project = (velocity: number, rate = 0.99) => ((velocity / 1000) * rate) / (1 - rate);

/** Past an edge the element follows less and less: it resists instead of stopping dead. */
const rubber = (over: number, dim: number, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
const band = (v: number, lo: number, hi: number, dim = 300) =>
  v < lo ? lo - rubber(lo - v, dim) : v > hi ? hi + rubber(v - hi, dim) : v;

/**
 * Drag something by a handle, the fluid way: it tracks the pointer 1:1 from where it was grabbed, resists
 * past the edges, and on release carries the pointer's velocity into a spring towards where the flick
 * would land (inside the bounds). Positions are in `root`'s coordinates.
 *
 * - threshold: pixels to move before it counts as a drag, so a plain tap stays a click (0 = drag at once).
 * - snap: may move the landing spot (e.g. back into a dock).
 */
export function dragWithMomentum(e: PointerEvent, o: {
  handle: HTMLElement;
  root: HTMLElement;
  start: Pt;
  bounds: () => Bounds;
  onMove: (p: Pt) => void;
  onStart?: () => void;
  snap?: (landing: Pt) => Pt;
  onSettle?: (p: Pt) => void;
  threshold?: number;
  reduce?: boolean;
}) {
  const r = o.root.getBoundingClientRect();
  const local = (ev: PointerEvent): Pt => ({ x: ev.clientX - r.left, y: ev.clientY - r.top });
  const p0 = local(e);
  const grab = { x: p0.x - o.start.x, y: p0.y - o.start.y };
  const threshold = o.threshold ?? 0;
  let dragging = false;
  let cur = { ...o.start };
  const trail: (Pt & { t: number })[] = [{ ...p0, t: e.timeStamp }];

  const begin = () => {
    dragging = true;
    o.onStart?.();
  };
  if (threshold === 0) begin();
  o.handle.setPointerCapture(e.pointerId);

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return;
    const p = local(ev);
    if (!dragging) {
      if (Math.hypot(p.x - p0.x, p.y - p0.y) < threshold) return;
      begin();
    }
    trail.push({ ...p, t: ev.timeStamp });
    if (trail.length > 8) trail.shift();
    const b = o.bounds();
    cur = { x: band(p.x - grab.x, b.minX, b.maxX), y: band(p.y - grab.y, b.minY, b.maxY) };
    o.onMove(cur);
  };

  const end = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return;
    o.handle.removeEventListener("pointermove", move);
    o.handle.removeEventListener("pointerup", end);
    o.handle.removeEventListener("pointercancel", end);
    if (!dragging) return;
    // The pointer-up after a drag must not also click the handle.
    o.handle.addEventListener("click", (c) => { c.stopPropagation(); c.preventDefault(); }, { capture: true, once: true });

    // Velocity over the last ~100 ms, in px/s.
    const last = trail[trail.length - 1];
    const first = trail.find((q) => last.t - q.t < 100) ?? trail[0];
    const dt = Math.max(1, last.t - first.t) / 1000;
    const v = ev.type === "pointercancel" ? { x: 0, y: 0 } : { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };

    const b = o.bounds();
    const landing = { x: clamp(cur.x + project(v.x), b.minX, b.maxX), y: clamp(cur.y + project(v.y), b.minY, b.maxY) };
    const to = o.snap?.(landing) ?? landing;
    if (o.reduce) {
      o.onMove(to);
      o.onSettle?.(to);
      return;
    }
    // X and Y are separate springs, each starting with the finger's own speed on that axis.
    const at = { ...cur };
    let settled = 0;
    const done = () => { if (++settled === 2) o.onSettle?.(to); };
    animate(cur.x, to.x, { type: "spring", bounce: 0.2, duration: 0.5, velocity: v.x, onUpdate: (x) => { at.x = x; o.onMove({ ...at }); }, onComplete: done });
    animate(cur.y, to.y, { type: "spring", bounce: 0.2, duration: 0.5, velocity: v.y, onUpdate: (y) => { at.y = y; o.onMove({ ...at }); }, onComplete: done });
  };

  o.handle.addEventListener("pointermove", move);
  o.handle.addEventListener("pointerup", end);
  o.handle.addEventListener("pointercancel", end);
}

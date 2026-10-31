export type Point = { x: number; y: number };

/** Geometry only: the caller also checks that the loop surrounds existing content. */
export function looksLikeCircle(points: Point[]): boolean {
  if (points.length < 8 || points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return false;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  // shortcut: tiny loops stay ink to avoid treating handwritten 0/o as selections; tune on the tablet.
  if (Math.min(w, h) < 24 || Math.max(w, h) / Math.min(w, h) > 12) return false;
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) > Math.hypot(w, h) * 0.15) return false;

  let area = 0;
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
    length += Math.hypot(a.x - b.x, a.y - b.y);
  }
  // A scribble, figure-eight or out-and-back line has little signed area for its path length.
  return Math.abs(area) / 2 > w * h * 0.45 && length < 3 * (w + h);
}

export function pointInLoop(point: Point, loop: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i];
    const b = loop[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export type Point = { x: number; y: number };

/**
 * Is this stroke a loop drawn around something (D16)? Geometry only: the caller also checks that the
 * loop surrounds existing content. Thresholds to tune on the tablet.
 * - not tiny (handwritten 0/o stay ink), and not a straight line; long flat loops around a whole line
 *   of text are fine (up to 24:1)
 * - goes most of the way round its centre and ends near where it started (or crosses back over it)
 * - encloses real area for its length (rejects scribbles, figure-eights and out-and-back lines)
 */
export function looksLikeCircle(points: Point[]): boolean {
  if (points.length < 8 || points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return false;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  // shortcut: tiny loops stay ink to avoid treating handwritten 0/o as selections; tune on the tablet.
  if (Math.min(w, h) < 24 || Math.max(w, h) / Math.min(w, h) > 24) return false;

  // How far round the centre does the stroke go?
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  let turned = 0;
  let prev = Math.atan2(points[0].y - cy, points[0].x - cx);
  for (let i = 1; i < points.length; i++) {
    const a = Math.atan2(points[i].y - cy, points[i].x - cx);
    let d = a - prev;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    turned += d;
    prev = a;
  }
  if (Math.abs(turned) < Math.PI * 1.65) return false;

  // Does it close? End near the start, or near any of the first quarter of the stroke.
  const end = points[points.length - 1];
  const head = points.slice(0, Math.max(2, Math.floor(points.length / 4)));
  const gap = Math.min(...head.map((p) => Math.hypot(p.x - end.x, p.y - end.y)));
  if (gap > 0.35 * Math.max(w, h)) return false;

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

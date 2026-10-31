export type Point = { x: number; y: number };

/** Smallest circle we accept, in canvas units (smaller loops are letters like "o" or "0"). */
const MIN_SIZE = 44;

/**
 * Is this stroke a circle drawn around something (D16)?
 * - big enough (not a letter), not a straight line
 * - goes most of the way round its centre (≥ ~300°)
 * - ends near where it started (or crosses back over its start)
 * Whether it surrounds content is checked by the caller. Thresholds to tune on the tablet.
 */
export function looksLikeCircle(points: Point[]): boolean {
  if (points.length < 10) return false;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  if (Math.min(w, h) < MIN_SIZE * 0.6 || Math.max(w, h) < MIN_SIZE) return false;
  // Students circle whole lines of text with long, flat loops, so allow very wide ellipses.
  if (Math.max(w, h) / Math.max(1, Math.min(w, h)) > 24) return false;

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
  return gap <= 0.35 * Math.max(w, h);
}

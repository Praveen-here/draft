export type Point = { x: number; y: number };

/**
 * Is this stroke a circle drawn around something (D16)?
 * Idea: start and end within ~15% of the stroke's size, it encloses an area,
 * and that area overlaps PDF text or ink. Tune on the tablet.
 */
export function looksLikeCircle(points: Point[]): boolean {
  // TODO(A)
  void points;
  return false;
}

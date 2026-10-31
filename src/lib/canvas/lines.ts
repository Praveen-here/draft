import type { BBox } from "@/lib/contracts";

/** A line of the student's writing: the strokes on roughly the same row. */
export type InkLine = { shapeIds: string[]; bbox: BBox };

/** Groups student strokes into lines of writing, top to bottom. */
export function groupIntoLines(strokes: { id: string; bbox: BBox }[]): InkLine[] {
  // TODO(A): cluster by vertical overlap; split when the gap is larger than ~0.6 × line height.
  void strokes;
  return [];
}

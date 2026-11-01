let measurer: CanvasRenderingContext2D | null | undefined;

/**
 * Share of a text run's width taken by characters from..to (proportional fonts, not monospace), as [start, end]
 * fractions of the whole run. PDF text arrives as whole runs with one box; this finds where a part of it sits.
 */
export function widthShare(text: string, from: number, to: number): [number, number] {
  measurer ??= typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!measurer) return [from / text.length, to / text.length];
  measurer.font = "48px Helvetica, Arial, sans-serif";
  const full = measurer.measureText(text).width || 1;
  return [measurer.measureText(text.slice(0, from)).width / full, measurer.measureText(text.slice(0, to)).width / full];
}

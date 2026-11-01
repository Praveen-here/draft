// Printed PDF text on the canvas: no tldraw here, so it can be tested in Node.
import type { BBox } from "@/lib/contracts";
import { widthShare } from "./textMeasure";

/** One run of printed text from the PDF, in page coordinates (pdf.js gives whole lines or long runs). */
export type PdfTextItem = { text: string; bbox: BBox };

/**
 * The printed text really inside a circled area. PDF text comes in whole lines, so a circle round handwriting
 * written between two printed lines grazes both; and a circle round one term ("a" in "y = a·x²") touches a line
 * that goes on much further. So: a line counts only if the area covers most of its height, and then only the
 * characters whose middle is inside the area are kept.
 */
export function textInside(items: PdfTextItem[], area: BBox): PdfTextItem[] {
  return items.flatMap((item) => {
    const b = item.bbox;
    const vertical = Math.min(b.y + b.h, area.y + area.h) - Math.max(b.y, area.y);
    if (vertical < b.h * 0.6) return [];
    if (b.x >= area.x && b.x + b.w <= area.x + area.w) return [item]; // the whole line is inside
    const chars = [...item.text];
    let first = -1, last = -1;
    chars.forEach((_, i) => {
      const [s, e] = widthShare(item.text, chars.slice(0, i).join("").length, chars.slice(0, i + 1).join("").length);
      const mid = b.x + ((s + e) / 2) * b.w;
      if (mid >= area.x && mid <= area.x + area.w) { if (first < 0) first = i; last = i; }
    });
    if (first < 0) return [];
    const part = chars.slice(first, last + 1).join("").trim();
    if (!part) return [];
    const [s, e] = widthShare(item.text, chars.slice(0, first).join("").length, chars.slice(0, last + 1).join("").length);
    return [{ text: part, bbox: { x: b.x + s * b.w, y: b.y, w: Math.max(1, (e - s) * b.w), h: b.h } }];
  });
}

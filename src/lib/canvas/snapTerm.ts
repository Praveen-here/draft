import type { Editor } from "tldraw";
import type { BBox } from "@/lib/contracts";
import { documentPages, pageText, shapeBox } from "./context";
import { overlap, padded } from "./geometry";

/** How a term is compared: no spaces, one multiply sign, superscripts as ^, one minus sign. */
function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\s​]/g, "")
    .replace(/[·⋅∙×*]/g, "·")
    .replace(/[−–—]/g, "-");
}

let measurer: CanvasRenderingContext2D | null | undefined;
/** Share of a text run's width taken by its first `chars` characters (proportional fonts, not monospace). */
function widthShare(text: string, from: number, to: number): [number, number] {
  measurer ??= typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!measurer) return [from / text.length, to / text.length];
  measurer.font = "48px Helvetica, Arial, sans-serif";
  const full = measurer.measureText(text).width || 1;
  return [measurer.measureText(text.slice(0, from)).width / full, measurer.measureText(text.slice(0, to)).width / full];
}

/**
 * Snap an explain card's mark onto the real term on the page. Gemini's box is a guess from the picture and
 * can be a word off; the PDF knows exactly where each character is. Looks for the card's title (e.g. "a",
 * "x·e^x") in the printed text near the circle, skipping letters inside ordinary words ("a" in "graph"),
 * and picks the match nearest the guess. Returns the guess unchanged when the term isn't printed text.
 */
export function snapToTerm(editor: Editor, title: string, guess: BBox | null, area: BBox | null): BBox | null {
  const want = normalise(title);
  if (!want || want.length > 40 || !area) return guess;
  const near = padded(area, 24);
  const found: { box: BBox; mathy: boolean }[] = [];
  for (const page of documentPages(editor)) {
    if (overlap(shapeBox(editor, page), near) === 0) continue;
    for (const item of pageText(editor, page)) {
      if (overlap(item.bbox, near) === 0) continue;
      // Positions in the normalised string map back to the original characters.
      const map: number[] = [];
      let flat = "";
      [...item.text].forEach((ch, i) => {
        const n = normalise(ch);
        for (const c of n) { flat += c; map.push(i); }
      });
      const chars = [...item.text];
      for (let at = flat.indexOf(want); at >= 0; at = flat.indexOf(want, at + 1)) {
        const before = flat[at - 1] ?? "", after = flat[at + want.length] ?? "";
        // A single letter or a short name must stand alone, not sit inside a word.
        if (/^[a-zA-Z]+$/.test(want) && (/[a-zA-Z]/.test(before) || /[a-zA-Z]/.test(after))) continue;
        const start = map[at], end = map[at + want.length - 1] + 1;
        const [a, b] = widthShare(chars.join(""), chars.slice(0, start).join("").length, chars.slice(0, end).join("").length);
        // "a" in "y = a·x²" beats the word "a" in "as a changes": prefer matches next to math symbols.
        const around = flat.slice(Math.max(0, at - 3), at + want.length + 3);
        found.push({
          box: { x: item.bbox.x + a * item.bbox.w, y: item.bbox.y, w: Math.max(4, (b - a) * item.bbox.w), h: item.bbox.h },
          mathy: /[=+\-·^/()0-9²³√∫]/.test(around),
        });
      }
    }
  }
  if (!found.length) return guess;
  const centre = (b: BBox) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const target = centre(guess ?? area);
  const cost = (f: { box: BBox; mathy: boolean }) =>
    Math.hypot(centre(f.box).x - target.x, centre(f.box).y - target.y) + (f.mathy ? 0 : 400);
  return found.sort((p, q) => cost(p) - cost(q))[0].box;
}

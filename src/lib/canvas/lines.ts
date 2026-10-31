import type { BBox } from "@/lib/contracts";
import { overlap, union, validBox } from "./geometry";

/** A line of the student's writing: the strokes on roughly the same row. */
export type InkLine = { shapeIds: string[]; bbox: BBox };
type InkStroke = { id: string; bbox: BBox; equationId?: string; previousEquationId?: string };

/** Groups student strokes into lines of writing, top to bottom. */
export function groupIntoLines(strokes: InkStroke[]): InkLine[] {
  const ink = strokes.filter((stroke) => validBox(stroke.bbox));
  const slopes = writingSlopes(ink);
  // A plus sign's horizontal arm is neither a fraction bar nor a tiny superscript.
  const plusArms = ink.map(({ bbox: bar }, i) => bar.w >= bar.h * 2 && ink.some(({ bbox: box }, j) =>
    j !== i && box.w < bar.w * 0.65 && box.h > bar.h * 2 &&
    box.x + box.w / 2 > bar.x && box.x + box.w / 2 < bar.x + bar.w &&
    box.y < bar.y && box.y + box.h > bar.y + bar.h));
  const roots = ink.map((_, i) => i);
  const labels = ink.map((stroke) => stroke.equationId);
  const root = (i: number): number => {
    while (roots[i] !== i) { roots[i] = roots[roots[i]]; i = roots[i]; }
    return i;
  };
  const join = (i: number, j: number) => {
    i = root(i); j = root(j);
    if (labels[i] && labels[j] && labels[i] !== labels[j]) return;
    roots[j] = i;
    labels[i] ??= labels[j];
  };
  const pinned = new Map<string, number>();
  ink.forEach((stroke, i) => {
    if (!stroke.equationId) return;
    const previous = pinned.get(stroke.equationId);
    if (previous !== undefined) join(previous, i);
    else pinned.set(stroke.equationId, i);
  });

  // Compare neighbouring strokes, never an expanding box dominated by a tall integral.
  for (let i = 0; i < ink.length; i++) for (let j = i + 1; j < ink.length; j++) {
    const slope = slopes[i] && slopes[j]
      ? Math.abs(slopes[i] - slopes[j]) < 0.35 ? (slopes[i] + slopes[j]) / 2 : 0
      : slopes[i] || slopes[j];
    const a = deskew(ink[i].bbox, slope), b = deskew(ink[j].bbox, slope);
    const gapX = Math.max(a.x - b.x - b.w, b.x - a.x - a.w, 0);
    const gapY = Math.max(a.y - b.y - b.h, b.y - a.y - a.h, 0);
    const height = Math.max(a.h, b.h);
    const reach = Math.max(24, Math.min(Math.max(a.w, a.h), Math.max(b.w, b.h)) * 1.5);
    const alignment = Math.max(height * 0.35, Math.min(a.h, b.h) * 0.65);
    // Existing neighbours get a little slack; new writing on the next row does not.
    const slack = ink[i].previousEquationId && ink[i].previousEquationId === ink[j].previousEquationId
      ? Math.max(6, Math.min(a.h, b.h) * 0.25) : 0;
    const small = a.h < b.h ? a : b, base = a.h < b.h ? b : a;
    const superscript = !plusArms[a.h < b.h ? i : j] && small.h <= base.h * 0.7 && small.x >= base.x + base.w * 0.5 &&
      small.y + small.h / 2 < base.y && gapY <= base.h * 0.5;
    if (gapX <= reach + slack && (superscript || (gapY <= Math.max(3, height * 0.2) + slack &&
      Math.abs(a.y + a.h / 2 - b.y - b.h / 2) <= alignment + slack))) join(i, j);
  }

  // A fraction bar joins nearby writing above AND below it, including slanted trackpad bars.
  ink.forEach(({ bbox: bar }, i) => {
    if (bar.w < bar.h * 2 || plusArms[i]) return;
    const above: number[] = [], below: number[] = [];
    ink.forEach(({ bbox: box }, j) => {
      if (i === j || box.x >= bar.x + bar.w || box.x + box.w <= bar.x) return;
      if (box.y + box.h / 2 < bar.y && box.y + box.h <= bar.y + bar.h &&
        bar.y - box.y - box.h <= bar.w * 0.6) above.push(j);
      if (box.y + box.h / 2 > bar.y + bar.h && box.y >= bar.y &&
        box.y - bar.y - bar.h <= bar.w * 0.6) below.push(j);
    });
    if (above.length && below.length) for (const j of [...above, ...below]) join(i, j);
  });
  const lines = new Map<number, InkLine>();
  ink.forEach((stroke, i) => {
    const key = root(i), line = lines.get(key);
    if (line) { line.shapeIds.push(stroke.id); line.bbox = union([line.bbox, stroke.bbox]); }
    else lines.set(key, { shapeIds: [stroke.id], bbox: { ...stroke.bbox } });
  });
  return [...lines.values()].sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
}

/** Infer the local baseline from similar-sized neighbours; powers and tall operators cannot set it. */
function writingSlopes(ink: InkStroke[]): number[] {
  // Overlapping parts of one letter or plus sign must not cast separate baseline votes.
  const glyphs: BBox[] = [];
  for (const original of ink.map((stroke) => stroke.bbox).sort((a, b) => a.x - b.x || a.y - b.y)) {
    let box = original;
    for (;;) {
      const index = glyphs.findIndex((glyph) => overlap(glyph, box) > Math.min(glyph.w * glyph.h, box.w * box.h) * 0.25);
      if (index < 0) break;
      box = union([box, glyphs[index]]); glyphs.splice(index, 1);
    }
    glyphs.push(box);
  }
  const links = glyphs.flatMap((a) => {
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
    const candidates = glyphs.flatMap((b) => {
      const dx = b.x + b.w / 2 - ax, dy = b.y + b.h / 2 - ay;
      if (b.x < a.x + a.w * 0.5 || dx <= 0 || Math.abs(dy) > dx * 1.25 ||
        Math.min(a.h, b.h) < Math.max(a.h, b.h) * 0.6 || dx > Math.max(a.h, b.h) * 3) return [];
      return [{ x: ax + dx / 2, y: ay + dy / 2, slope: dy / dx, distance: Math.hypot(dx, dy) }];
    }).sort((a, b) => a.distance - b.distance || a.slope - b.slope);
    return candidates.slice(0, 2).map((link, index) => ({ ...link, primary: index === 0 }));
  });
  return ink.map(({ bbox }) => {
    const x = bbox.x + bbox.w / 2, y = bbox.y + bbox.h / 2;
    const nearby = links.map((link) => ({ ...link, gap: Math.hypot(link.x - x, link.y - y) }))
      .filter((link) => link.gap <= Math.max(bbox.w, bbox.h, link.distance) * 3)
      .sort((a, b) => a.gap - b.gap || a.slope - b.slope);
    // Pick a repeated direction; averaging conflicting row directions invents a false baseline.
    const fit = (directions: number[]) => directions.map((slope) => {
      const aligned = directions.filter((candidate) => Math.abs(candidate - slope) < 0.4);
      return { count: aligned.length, slope: aligned.reduce((a, b) => a + b, 0) / aligned.length };
    }).sort((a, b) => b.count - a.count || Math.abs(a.slope) - Math.abs(b.slope))[0];
    let best = fit(nearby.filter((link) => link.primary).slice(0, 6).map((link) => link.slope));
    // A third glyph can resolve an uneven short row; it must not override an established baseline.
    if (!best || best.count < 2) best = fit(nearby.slice(0, 8).map((link) => link.slope));
    return best && best.count >= 2 && Math.abs(best.slope) >= 0.25 ? best.slope : 0;
  });
}

function deskew(box: BBox, slope: number): BBox {
  return { ...box, y: box.y - slope * (slope > 0 ? box.x + box.w : box.x), h: box.h + Math.abs(slope) * box.w };
}

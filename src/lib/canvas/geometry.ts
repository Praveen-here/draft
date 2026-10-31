import type { BBox } from "@/lib/contracts";

export function validBox(box: BBox): boolean {
  return [box.x, box.y, box.w, box.h].every(Number.isFinite) && box.w > 0 && box.h > 0;
}

export function overlap(a: BBox, b: BBox): number {
  return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

export function union(boxes: BBox[]): BBox {
  if (!boxes.length) throw new Error("No writing selected.");
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}

export function padded(box: BBox, margin = 8): BBox {
  return { x: box.x - margin, y: box.y - margin, w: box.w + margin * 2, h: box.h + margin * 2 };
}

/** Choose free space instead of painting over the document or another annotation. */
export function placeBeside(near: BBox, w: number, h: number, obstacles: BBox[]): BBox {
  const candidates = [
    { x: near.x + near.w + 24, y: near.y, w, h },
    { x: near.x, y: near.y + near.h + 24, w, h },
    { x: near.x - w - 24, y: near.y, w, h },
    ...obstacles.flatMap((box) => [
      { x: box.x + box.w + 24, y: near.y, w, h },
      { x: box.x, y: box.y + box.h + 24, w, h },
    ]),
  ];
  const direct = candidates.slice(0, 3).find((candidate) => obstacles.every((box) => overlap(padded(candidate, 8), box) === 0));
  if (direct) return direct;
  candidates.sort((a, b) => Math.hypot(a.x - near.x, a.y - near.y) - Math.hypot(b.x - near.x, b.y - near.y));
  return candidates.find((candidate) => obstacles.every((box) => overlap(padded(candidate, 8), box) === 0)) ?? {
    x: Math.max(near.x + near.w, ...obstacles.map((box) => box.x + box.w)) + 24,
    y: near.y, w, h,
  };
}

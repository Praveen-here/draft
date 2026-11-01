import { Box, b64Vecs, intersectPolygonPolygon, type Editor, type TLDrawShape, type TLShape } from "tldraw";
import type { BBox, CircleContext, Target } from "@/lib/contracts";
import type { Point } from "./circleDetect";
import { overlap, validBox } from "./geometry";
import { textInside } from "./pdfText";

export type { PdfTextItem } from "./pdfText";
import type { PdfTextItem } from "./pdfText";

export function shapeBox(editor: Editor, shape: TLShape): BBox {
  const box = editor.getShapePageBounds(shape);
  if (!box) throw new Error("This mark is no longer on the page.");
  return { x: box.x, y: box.y, w: Math.max(1, box.w), h: Math.max(1, box.h) };
}

export function targetBox(editor: Editor, target: Target): BBox {
  const shape = "shapeId" in target ? editor.getShape(target.shapeId as TLShape["id"]) : undefined;
  const box = "bbox" in target ? target.bbox : shape ? shapeBox(editor, shape) : null;
  if (!box || !validBox(box)) throw new Error("That part of the page is no longer available.");
  return box;
}

export function strokePoints(editor: Editor, shape: TLDrawShape): Point[] {
  const transform = editor.getShapePageTransform(shape);
  return shape.props.segments.flatMap((segment) => b64Vecs.decodePoints(segment.path, segment.dim))
    .map((point) => transform.applyToPoint({ x: point.x * shape.props.scaleX, y: point.y * shape.props.scaleY }));
}

export function studentInk(editor: Editor): TLDrawShape[] {
  return editor.getCurrentPageShapes().filter((shape): shape is TLDrawShape =>
    shape.type === "draw" && shape.props.isComplete && shape.meta.author !== "tutor" && shape.meta.kind !== "circle");
}

export function documentPages(editor: Editor): TLShape[] {
  return editor.getCurrentPageShapes().filter((shape) => shape.meta.kind === "page");
}

export function pageText(editor: Editor, page: TLShape): PdfTextItem[] {
  const items = page.meta.textItems;
  if (!Array.isArray(items)) return [];
  const transform = editor.getShapePageTransform(page);
  return items.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.text !== "string") return [];
    const bbox = item.bbox as BBox | undefined;
    if (!bbox || !validBox(bbox)) return [];
    const corners = transform.applyToPoints(new Box(bbox.x, bbox.y, bbox.w, bbox.h).corners);
    const box = Box.FromPoints(corners);
    return [{ text: item.text, bbox: { x: box.x, y: box.y, w: box.w, h: box.h } }];
  });
}

/** The loop must surround content, not just make an oval on empty paper. */
export function enclosesContent(editor: Editor, stroke: TLDrawShape, points: Point[]): boolean {
  // A PDF text item may span a whole line; a circle can select just one of its terms.
  const inside = (bbox: BBox) => intersectPolygonPolygon(points, new Box(bbox.x, bbox.y, bbox.w, bbox.h).corners) !== null;
  if (studentInk(editor).some((shape) => shape.id !== stroke.id && inside(shapeBox(editor, shape)))) return true;
  return documentPages(editor).some((page) => {
    const text = pageText(editor, page);
    if (text.length) return text.some((item) => inside(item.bbox));
    // shortcut: scanned pages have no text boxes; use image overlap until OCR supplies positions.
    return overlap(shapeBox(editor, page), shapeBox(editor, stroke)) > 0;
  });
}

export async function cropImage(editor: Editor, shapes: TLShape[], bbox: BBox): Promise<string> {
  if (!validBox(bbox)) throw new Error("The selected area is empty.");
  const scale = Math.min(2, 1024 / Math.max(bbox.w, bbox.h));
  if (!shapes.length) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(bbox.w * scale));
    canvas.height = Math.max(1, Math.ceil(bbox.h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't capture this area. Try circling it again.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  }
  const result = await editor.toImageDataUrl(shapes, {
    format: "png", bounds: new Box(bbox.x, bbox.y, bbox.w, bbox.h),
    padding: 0, background: true, pixelRatio: 1, scale,
  });
  return result.url;
}

export async function circleContext(editor: Editor, circle: TLShape, recentLines: string[]): Promise<CircleContext> {
  return areaContext(editor, shapeBox(editor, circle), recentLines);
}

export async function areaContext(editor: Editor, bbox: BBox, recentLines: string[], chosenInk?: TLDrawShape[]): Promise<CircleContext> {
  const pages = documentPages(editor).filter((page) => overlap(shapeBox(editor, page), bbox) > 0);
  const page = pages.sort((a, b) => overlap(shapeBox(editor, b), bbox) - overlap(shapeBox(editor, a), bbox))[0];
  const ink = chosenInk ?? studentInk(editor).filter((shape) => overlap(shapeBox(editor, shape), bbox) > 0);
  const highlights = editor.getCurrentPageShapes().filter((shape) => shape.type === "highlight" && shape.props.isComplete &&
    shape.meta.author !== "tutor" && overlap(shapeBox(editor, shape), bbox) > 0);
  const text = page ? textInside(pageText(editor, page), bbox) : [];
  const [crop, inkOnly] = await Promise.all([
    cropImage(editor, [...pages, ...ink, ...highlights], bbox),
    cropImage(editor, ink, bbox),
  ]);
  return {
    cropImage: crop, inkOnlyImage: inkOnly,
    pdfText: text.map((item) => item.text).join(" "),
    bbox, pageNo: page ? Number(page.meta.page) || 1 : 0, recentLines,
  };
}

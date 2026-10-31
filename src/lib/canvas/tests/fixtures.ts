import { AssetRecordType, Box, b64Vecs, createShapeId, type Editor } from "tldraw";
import type { BBox } from "@/lib/contracts";
import { loadPages } from "@/components/app/loadPages";
import { documentPages, pageText } from "../context";

/** Two real PDF pages; the second is rotated to exercise PDF → canvas coordinates. */
export function worksheetPdf(): File {
  const streams = [
    "BT /F1 18 Tf 50 700 Td (Find integral x exp\\(x\\) dx) Tj ET",
    "BT /F1 18 Tf 50 700 Td (Second page: x squared) Tj ET",
  ];
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
    "<< /Length " + streams[0].length + " >>\nstream\n" + streams[0] + "\nendstream",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Rotate 90 /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
    "<< /Length " + streams[1].length + " >>\nstream\n" + streams[1] + "\nendstream",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(pdf.length);
    pdf += i + 1 + " 0 obj\n" + object + "\nendobj\n";
  });
  const xref = pdf.length;
  pdf += "xref\n0 8\n0000000000 65535 f \n";
  pdf += offsets.slice(1).map((offset) => String(offset).padStart(10, "0") + " 00000 n \n").join("");
  pdf += "trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  return new File([pdf], "canvas-test.pdf", { type: "application/pdf" });
}

export async function loadWorksheet(editor: Editor) {
  const pages = await loadPages(worksheetPdf());
  editor.run(() => editor.deleteShapes(editor.getCurrentPageShapes()), { history: "ignore", ignoreShapeLock: true });
  editor.clearHistory();
  let y = 100;
  editor.run(() => pages.forEach((page, i) => {
    const assetId = AssetRecordType.createId();
    editor.createAssets([{
      id: assetId, typeName: "asset", type: "image", meta: {},
      props: { w: page.w, h: page.h, name: "test-page-" + i, src: page.src, mimeType: "image/png", isAnimated: false },
    }]);
    editor.createShape({
      id: createShapeId("test-page-" + i), type: "image", x: 360, y, isLocked: true,
      meta: { kind: "page", page: i + 1, textItems: page.textItems },
      props: { assetId, w: page.w, h: page.h },
    });
    y += page.h + 32;
  }), { history: "ignore" });
  editor.setCamera({ x: 0, y: 0, z: 0.8 });
  return pages;
}

export function sampleTarget(editor: Editor, pageNo = 1): BBox {
  const page = documentPages(editor).find((page) => page.meta.page === pageNo);
  const text = page && pageText(editor, page)[0];
  if (!text) throw new Error("Load the worksheet first.");
  return text.bbox;
}

export function addCircle(editor: Editor, box = sampleTarget(editor)) {
  const id = createShapeId();
  const points = Array.from({ length: 65 }, (_, i) => {
    const angle = i / 64 * Math.PI * 2;
    return { x: (box.w / 2 + 20) * (1 + Math.cos(angle)), y: (box.h / 2 + 20) * (1 + Math.sin(angle)), z: 0.5 };
  });
  editor.markHistoryStoppingPoint("circle fixture");
  editor.createShape({ id, type: "draw", x: box.x - 20, y: box.y - 20,
    props: { segments: [{ type: "free", path: b64Vecs.encodePoints(points) }], isComplete: true, color: "blue", size: "s" } });
  return id;
}

export function addLine(editor: Editor, yOffset = 110) {
  const box = sampleTarget(editor);
  const paths = [
    [[0, 0], [10, 16], [24, 34]], [[23, 0], [11, 18], [0, 34]],
    [[42, 17], [54, 17], [68, 17]], [[55, 4], [55, 16], [55, 31]],
    [[106, 3], [95, 0], [85, 7], [81, 18], [85, 30], [95, 35], [107, 31]],
  ];
  const ids = paths.map(() => createShapeId());
  editor.markHistoryStoppingPoint("writing fixture");
  editor.run(() => paths.forEach((path, i) => editor.createShape({
    id: ids[i], type: "draw", x: box.x, y: box.y + yOffset,
    props: { segments: [{ type: "free", path: b64Vecs.encodePoints(path.map(([x, y]) => ({ x, y, z: 0.5 }))) }],
      isComplete: true, color: "black", size: "s" },
  })));
  return ids;
}

export function focusSample(editor: Editor) {
  const box = sampleTarget(editor);
  editor.zoomToBounds(new Box(box.x - 310, box.y - 70, 1100, 560), { inset: 20, targetZoom: 0.8 });
}

export function addHighlight(editor: Editor) {
  const box = sampleTarget(editor);
  const id = createShapeId();
  editor.createShape({ id, type: "highlight", x: box.x, y: box.y + box.h / 2,
    props: { segments: [{ type: "free", path: b64Vecs.encodePoints([{ x: 0, y: 0, z: 0.5 }, { x: 80, y: 0, z: 0.5 }]) }],
      isComplete: true, color: "blue" } });
  return id;
}

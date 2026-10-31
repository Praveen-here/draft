import type { PdfTextItem } from "@/lib/canvas/context";

/** Text coordinates use the displayed page size, not its 2x raster resolution. */
export type PageImage = { src: string; w: number; h: number; textItems: PdfTextItem[] };

/** Page width on the canvas, in canvas units (roughly A4/Letter at 96 dpi). */
export const PAGE_WIDTH = 820;

/** Render scale: pages are rasterised at 2x so they stay sharp when zoomed in. */
const RENDER_SCALE = 2;

export async function loadPages(file: File): Promise<PageImage[]> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Please choose a document smaller than 20 MB.");
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return loadPdf(file);
  }
  if (file.type.startsWith("image/")) {
    return [await loadImage(file)];
  }
  throw new Error("unsupported");
}

async function loadPdf(file: File): Promise<PageImage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const pdf = await task.promise;
  const pages: PageImage[] = [];

  try {
    if (pdf.numPages > 20) throw new Error("Please choose up to 20 pages for this session.");
    for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const fit = PAGE_WIDTH / base.width;
    const viewport = page.getViewport({ scale: fit * RENDER_SCALE });
    const display = page.getViewport({ scale: fit });
    const content = await page.getTextContent();
    const textItems: PdfTextItem[] = content.items.flatMap((item) => {
      if (!("str" in item) || !item.str.trim()) return [];
      const m = pdfjs.Util.transform(display.transform, item.transform);
      const angle = Math.atan2(m[1], m[0]);
      const dx = Math.cos(angle) * item.width * fit;
      const dy = Math.sin(angle) * item.width * fit;
      const xs = [m[4], m[4] + dx, m[4] + m[2], m[4] + dx + m[2]];
      const ys = [m[5], m[5] + dy, m[5] + m[3], m[5] + dy + m[3]];
      return [{ text: item.str, bbox: {
        x: Math.min(...xs), y: Math.min(...ys),
        w: Math.max(1, Math.max(...xs) - Math.min(...xs)), h: Math.max(1, Math.max(...ys) - Math.min(...ys)),
      } }];
    });
    if (viewport.height > 12000) throw new Error("One page is too large to open. Try a smaller PDF.");

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;

    pages.push({
      src: canvas.toDataURL("image/png"),
      w: viewport.width / RENDER_SCALE,
      h: viewport.height / RENDER_SCALE,
      textItems,
    });
    page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

async function loadImage(file: File): Promise<PageImage> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = new Image();
  img.src = src;
  await img.decode();
  const fit = Math.min(1, PAGE_WIDTH / img.naturalWidth);
  return { src, w: img.naturalWidth * fit, h: img.naturalHeight * fit, textItems: [] };
}

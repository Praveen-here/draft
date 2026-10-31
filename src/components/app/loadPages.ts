/** A rendered page, ready to be placed on the canvas as a locked image. */
export type PageImage = { src: string; w: number; h: number };

/** Page width on the canvas, in canvas units (roughly A4/Letter at 96 dpi). */
export const PAGE_WIDTH = 820;

/** Render scale: pages are rasterised at 2x so they stay sharp when zoomed in. */
const RENDER_SCALE = 2;

export async function loadPages(file: File): Promise<PageImage[]> {
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

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const fit = PAGE_WIDTH / base.width;
    const viewport = page.getViewport({ scale: fit * RENDER_SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;

    pages.push({
      src: canvas.toDataURL("image/png"),
      w: viewport.width / RENDER_SCALE,
      h: viewport.height / RENDER_SCALE,
    });
    page.cleanup();
  }

  await task.destroy();
  return pages;
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
  return { src, w: img.naturalWidth * fit, h: img.naturalHeight * fit };
}

// A learner's documents (src/lib/server/documentStore.ts). The learner is sent as the x-learner-id header.
//   GET  /api/documents  → the list, most recently opened first
//   POST /api/documents  → a new document: multipart with "file" (PDF/image), "title", "paper"; or JSON { title, paper } for blank paper

import { createDocument, listDocuments, MAX_FILE_BYTES } from "@/lib/server/documentStore";
import { validLearnerId } from "@/lib/server/learnerStore";

const MIMES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const noDb = () => Response.json({ error: "Saving is off: no database." }, { status: 503 });

export async function GET(request: Request) {
  const learner = request.headers.get("x-learner-id");
  if (!validLearnerId(learner)) return Response.json({ error: "Unknown learner." }, { status: 400 });
  const docs = await listDocuments(learner);
  return docs ? Response.json({ documents: docs }) : noDb();
}

export async function POST(request: Request) {
  const learner = request.headers.get("x-learner-id");
  if (!validLearnerId(learner)) return Response.json({ error: "Unknown learner." }, { status: 400 });
  try {
    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return Response.json({ error: "No file." }, { status: 400 });
      const mime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
      if (!MIMES.includes(mime)) return Response.json({ error: "Please upload a PDF or an image (PNG, JPG)." }, { status: 415 });
      if (file.size > MAX_FILE_BYTES) return Response.json({ error: "Please choose a document smaller than 20 MB." }, { status: 413 });
      const doc = await createDocument(learner, {
        title: String(form.get("title") ?? ""),
        paper: String(form.get("paper") ?? "blank"),
        file: { bytes: Buffer.from(await file.arrayBuffer()), name: file.name, mime },
      });
      return doc ? Response.json({ document: doc }) : noDb();
    }
    const body = (await request.json().catch(() => ({}))) as { title?: string; paper?: string };
    const doc = await createDocument(learner, { title: body.title, paper: body.paper });
    return doc ? Response.json({ document: doc }) : noDb();
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't save the document." }, { status: 400 });
  }
}

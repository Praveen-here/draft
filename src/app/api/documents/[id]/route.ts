// One document (src/lib/server/documentStore.ts), only for its owner: the signed-in account (auth.ts).
//   GET    /api/documents/:id → details, saved canvas and chat (and marks it as just opened)
//   PUT    /api/documents/:id → save { canvas?, chat?, paper?, title?, pages? }
//   DELETE /api/documents/:id → delete it, with its file

import { learnerFor } from "@/lib/server/auth";
import { deleteDocument, getDocument, updateDocument } from "@/lib/server/documentStore";

type Ctx = { params: Promise<{ id: string }> };
const learnerOf = async (request: Request) => (await learnerFor(request, request.headers.get("x-learner-id"))) ?? "";

export async function GET(request: Request, { params }: Ctx) {
  const doc = await getDocument(await learnerOf(request), (await params).id);
  return doc ? Response.json({ document: doc }) : Response.json({ error: "Not found." }, { status: 404 });
}

export async function PUT(request: Request, { params }: Ctx) {
  const patch = await request.json().catch(() => null);
  if (!patch || typeof patch !== "object") return Response.json({ error: "Bad request." }, { status: 400 });
  try {
    const saved = await updateDocument(await learnerOf(request), (await params).id, patch);
    return saved ? Response.json({ ok: true }) : Response.json({ error: "Not found." }, { status: 404 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't save." }, { status: 413 });
  }
}

// Same as PUT, for saves sent while the page closes (fetch keepalive only allows small bodies; best effort).
export const POST = PUT;

export async function DELETE(request: Request, { params }: Ctx) {
  const deleted = await deleteDocument(await learnerOf(request), (await params).id);
  return deleted ? Response.json({ ok: true }) : Response.json({ error: "Not found." }, { status: 404 });
}

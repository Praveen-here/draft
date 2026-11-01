// GET /api/documents/:id/file → the uploaded PDF or image, from storage/documents/<id>/ (owner only: the signed-in account).

import { learnerFor } from "@/lib/server/auth";
import { readDocumentFile } from "@/lib/server/documentStore";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const learner = (await learnerFor(request, request.headers.get("x-learner-id"))) ?? "";
  const file = await readDocumentFile(learner, (await params).id);
  if (!file) return Response.json({ error: "Not found." }, { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.bytes.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

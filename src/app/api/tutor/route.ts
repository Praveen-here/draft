// Part B: POST /api/tutor. Calls Gemini Flash with tools and streams beats back.
// Keys stay on the server: read GEMINI_KEY_DEV / GEMINI_KEY_DEMO via APP_ENV (docs/APPROACH_DRAFT.md §10).

export async function POST(request: Request) {
  // TODO(B): body = { transcript, circle, studentModel, toolResults }; stream TutorTurn beats.
  void request;
  return Response.json({ error: "not built yet" }, { status: 501 });
}

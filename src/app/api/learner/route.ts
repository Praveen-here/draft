// The learner's memory (src/lib/server/learnerStore.ts).
//   GET    /api/learner?id=…  → what ∂raft remembers, and the summary the tutor sees
//   POST   /api/learner       → { learnerId, problemId, problem, verdict: ok | wrong | solved } after the engine checks a line
//   DELETE /api/learner?id=…  → forget this learner

import { learnerFor } from "@/lib/server/auth";
import { forgetLearner, loadProfile, recordLine, summarizeProfile } from "@/lib/server/learnerStore";

// The learner is the signed-in account; the id in the request only counts while developing, signed out (auth.ts).

export async function GET(request: Request) {
  const id = await learnerFor(request, new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "Please sign in." }, { status: 401 });
  const profile = await loadProfile(id);
  return Response.json({ memory: profile !== null, profile, summary: summarizeProfile(profile) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { learnerId?: string; problemId?: string; problem?: string; verdict?: string }
    | null;
  const learner = body ? await learnerFor(request, body.learnerId) : null;
  if (!body || !learner || typeof body.problemId !== "string") {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  if (body.verdict !== "ok" && body.verdict !== "wrong" && body.verdict !== "solved") {
    return Response.json({ error: "Unknown verdict." }, { status: 400 });
  }
  await recordLine({ learnerId: learner, problemId: body.problemId.slice(0, 64), problem: body.problem }, body.verdict);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const id = await learnerFor(request, new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "Please sign in." }, { status: 401 });
  return Response.json({ forgotten: await forgetLearner(id) });
}

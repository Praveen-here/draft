// The learner's memory (src/lib/server/learnerStore.ts).
//   GET    /api/learner?id=…  → what ∂raft remembers, and the summary the tutor sees
//   POST   /api/learner       → { learnerId, problemId, problem, verdict: ok | wrong | solved } after the engine checks a line
//   DELETE /api/learner?id=…  → forget this learner

import { forgetLearner, loadProfile, recordLine, summarizeProfile, validLearnerId } from "@/lib/server/learnerStore";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!validLearnerId(id)) return Response.json({ error: "Unknown learner." }, { status: 400 });
  const profile = await loadProfile(id);
  return Response.json({ memory: profile !== null, profile, summary: summarizeProfile(profile) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { learnerId?: string; problemId?: string; problem?: string; verdict?: string }
    | null;
  if (!body || !validLearnerId(body.learnerId) || typeof body.problemId !== "string") {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  if (body.verdict !== "ok" && body.verdict !== "wrong" && body.verdict !== "solved") {
    return Response.json({ error: "Unknown verdict." }, { status: 400 });
  }
  await recordLine({ learnerId: body.learnerId, problemId: body.problemId.slice(0, 64), problem: body.problem }, body.verdict);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!validLearnerId(id)) return Response.json({ error: "Unknown learner." }, { status: 400 });
  return Response.json({ forgotten: await forgetLearner(id) });
}

// Part B: POST /api/tutor. One Gemini call per turn → a structured teaching turn (docs/AGENT_BRAIN.md).
// Tries models in order; a busy (429/503) or slow model falls through to the next one.

import { SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { TURN_SCHEMA, type RawTurn, type TutorRequest, type TutorResponse } from "@/lib/agent/schema";
import { key } from "@/lib/server/keys";

// Flash-Lite first: ~2 s per turn in our tests (31 Oct), while Flash was often overloaded (503) or 40 s+.
const MODELS: { id: string; timeoutMs: number }[] = [
  { id: "gemini-3.5-flash-lite", timeoutMs: 7000 },
  { id: "gemini-3.8-flash", timeoutMs: 9000 },
  { id: "gemini-3.5-flash-lite", timeoutMs: 12000 }, // busy spikes pass quickly: one retry
  { id: "gemini-3.1-flash-lite", timeoutMs: 12000 },
];

export async function POST(request: Request) {
  const body = (await request.json()) as TutorRequest;
  const contents = buildContents(body);
  const started = Date.now();
  const errors: string[] = [];

  // Dev only: /api/tutor?model=gemini-3.5-flash forces one model (for tuning and timing).
  const forced = process.env.NODE_ENV !== "production" ? new URL(request.url).searchParams.get("model") : null;
  const models = forced ? [{ id: forced, timeoutMs: 60000 }] : MODELS;

  for (const model of models) {
    try {
      const turn = await callGemini(model.id, contents, model.timeoutMs);
      return Response.json({ turn: guard(turn), model: model.id, ms: Date.now() - started } satisfies TutorResponse);
    } catch (err) {
      errors.push(`${model.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.error("[tutor] all models failed", errors);
  return Response.json({ error: "All models are busy right now. Try again in a moment." } satisfies TutorResponse, {
    status: 503,
  });
}

type Part ={ text: string } | { inlineData: { mimeType: string; data: string } };
type Content = { role: "user" | "model"; parts: Part[] };

function buildContents(body: TutorRequest): Content[] {
  const parts: Part[] = [];
  if (body.image) {
    const [meta, data] = body.image.split(",");
    parts.push({ inlineData: { mimeType: meta.match(/data:(.*?);/)?.[1] ?? "image/png", data } });
    parts.push({ text: "Above: the exact area the student circled (boxes you return refer to this picture)." });
  } else {
    parts.push({ text: "The student hasn't circled anything yet." });
  }
  if (body.pdfText) parts.push({ text: `Printed text inside the circle: ${body.pdfText}` });

  const history = body.history.length
    ? body.history.map((h) => `${h.role === "tutor" ? "Tutor" : "Student"}: ${h.text}`).join("\n")
    : "(this is the first question about this circle)";
  parts.push({
    text: [
      `Conversation so far:\n${history}`,
      `Student model: hintLevel ${body.student.hintLevel}, anglesTried [${body.student.anglesTried.join(", ")}], ` +
        `misconceptions [${body.student.misconceptions.join("; ")}], checks passed ${body.student.checksPassed}, failed ${body.student.checksFailed}.`,
      `Graphs already on screen: ${body.graphs.length ? body.graphs.join("; ") : "none"}.`,
      `The student now says: "${body.transcript}"`,
      "Reply with the next teaching turn.",
    ].join("\n\n"),
  });
  return [{ role: "user", parts }];
}

async function callGemini(model: string, contents: Content[], timeoutMs: number): Promise<RawTurn> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key("GEMINI") },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: TURN_SCHEMA,
        thinkingConfig: { thinkingLevel: "low" },
      },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${json?.error?.message ?? ""}`.slice(0, 160));
  const text: string = json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("empty reply");
  return JSON.parse(text) as RawTurn;
}

/** Answer-leak guard and sanity limits: never more than one worked step, four beats or four explain cards. */
function guard(turn: RawTurn): RawTurn {
  let steps = 0;
  let notes = 0;
  const beats = (turn.beats ?? []).slice(0, 4).map((beat) => ({
    say: beat.say ?? "",
    visuals: (beat.visuals ?? []).filter(
      (v) => (v.type !== "writeStep" || ++steps <= 1) && (v.type !== "note" || ++notes <= 4),
    ),
  }));
  return {
    ...turn,
    beats: beats.length ? beats : [{ say: turn.question || "Let's look at this together.", visuals: [] }],
    hintLevel: Math.min(3, Math.max(1, Math.round(turn.hintLevel || 1))),
  };
}

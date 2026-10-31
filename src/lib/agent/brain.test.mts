/**
 * The brain reacting to the student's handwriting and answers, with the real math engine, a stand-in canvas
 * and a mocked /api/tutor (no Gemini, no database). Run: npx tsx src/lib/agent/brain.test.mts
 */
import type { CanvasEvent, TutorTurn, VisualAction } from "@/lib/contracts";
import { fakeCanvas, sampleCircle } from "@/lib/fakes";
import { createMathApi } from "@/lib/math";
import { createBrain } from "./brain";
import type { RawTurn, TutorRequest } from "./schema";

// localStorage for learnerId() (Node has no window).
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: globalThis,
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
});

const tutorBodies: TutorRequest[] = [];
const learnerPosts: { verdict: string }[] = [];
let reply: Partial<RawTurn> = {};
globalThis.fetch = (async (url: string, init?: { body?: string }) => {
  const body = JSON.parse(init?.body ?? "{}");
  if (String(url).startsWith("/api/learner")) {
    learnerPosts.push(body);
    return new Response(JSON.stringify({ ok: true }));
  }
  tutorBodies.push(body);
  const turn: RawTurn = {
    topic: "integration by parts", level: "developing", kind: "check", doubt: "", studentWas: "asking", stage: "explain",
    hintLevel: 1, angle: "algebra", misconception: "", done: false, waitFor: "line", question: "",
    beats: [{ say: "Have a look at the sign in your line.", visuals: [] }], ...reply,
  };
  return new Response(JSON.stringify({ turn, model: "mock", ms: 1 }));
}) as typeof fetch;

const canvas = fakeCanvas();
const drawn: VisualAction[] = [];
canvas.draw = (a) => void drawn.push(a);
const brain = createBrain({ canvas, math: createMathApi() });
const turns: TutorTurn[] = [];
brain.onTurn((t) => turns.push(t));

const settle = () => new Promise((r) => setTimeout(r, 30));
const line = (latex: string, y: number): CanvasEvent => ({ type: "line", latex, target: { bbox: { x: 120, y, w: 200, h: 30 } } });
let pass = 0, total = 0;
const expect = (what: string, ok: boolean, info?: unknown) => {
  total++;
  if (ok) pass++;
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${ok || info === undefined ? "" : ` → ${JSON.stringify(info)}`}`);
};

// Circle ∫ x eˣ dx (the printed problem), then write lines under it.
brain.handleCanvas({ type: "circle", context: { ...sampleCircle, pdfText: "6. Find the integral of x·e^x dx." } });

brain.handleCanvas(line("x e^x - \\int e^x dx", 220));
await settle();
expect("a right step gets a quiet tick", drawn.some((a) => a.type === "mark" && a.kind === "tick"), drawn);
expect("... and no tutor turn (stays quiet)", turns.length === 0 && tutorBodies.length === 0, turns.length);
expect("... and is recorded for the learner as ok", learnerPosts.at(-1)?.verdict === "ok", learnerPosts);

brain.handleCanvas(line("x e^x + e^x + C", 260));
await settle();
const flag = tutorBodies.at(-1);
expect("a wrong line asks the tutor to speak up", !!flag?.event && flag.transcript === "", flag);
expect("... with the line's engine verdict in the working", !!flag?.work?.some((w) => w.includes("WRONG")), flag?.work);
expect("... with learner, problem id and problem text", !!flag?.learnerId && !!flag?.problemId && !!flag?.problem?.includes("integral"), flag);
expect("... and the turn opens with a red highlight on the line", turns.at(-1)?.beats[0].visuals[0]?.type === "highlight", turns.at(-1)?.beats[0]);
expect("... recorded as wrong", learnerPosts.at(-1)?.verdict === "wrong");

// The pen rests after the tutor asked for a line: one nudge, said locally.
const before = tutorBodies.length;
brain.handleCanvas({ type: "idle", ms: 8000 });
brain.handleCanvas({ type: "idle", ms: 8000 });
expect("idle after 'write a line' offers one hint, without calling Gemini", turns.at(-1)?.beats[0].say.includes("hint") === true && tutorBodies.length === before, turns.at(-1));
expect("... only once", turns.filter((t) => t.beats[0].say.includes("hint")).length === 1);

// A typed answer that is math is judged by the engine before Gemini sees it.
await brain.handleSpeech({ transcript: "x e^x + e^x + C", duringTurn: false });
expect("a wrong typed answer goes to Gemini marked wrong", tutorBodies.at(-1)?.answer?.verdict === "wrong", tutorBodies.at(-1)?.answer);
await brain.handleSpeech({ transcript: "why the minus?", duringTurn: false });
expect("a question in words carries no engine verdict", tutorBodies.at(-1)?.answer === undefined, tutorBodies.at(-1)?.answer);

// The right final line: solved by the engine, said locally, recorded as solved.
const asked = tutorBodies.length;
brain.handleCanvas(line("x e^x - e^x + C", 300));
await settle();
expect("the correct final answer ends the problem as solved", turns.at(-1)?.insight?.done === true, turns.at(-1)?.insight);
expect("... without a Gemini call", tutorBodies.length === asked);
expect("... recorded as solved", learnerPosts.at(-1)?.verdict === "solved", learnerPosts.at(-1));
brain.handleCanvas(line("x e^x + 5", 340));
await settle();
expect("after solving, more lines are ignored", tutorBodies.length === asked && learnerPosts.at(-1)?.verdict === "solved");

// Writing far away from the circled problem isn't checked against it.
brain.handleCanvas({ type: "circle", context: { ...sampleCircle, pdfText: "8. Solve 2(x + 3) = 14" } });
const posts = learnerPosts.length;
brain.handleCanvas({ type: "line", latex: "2x + 3 = 14", target: { bbox: { x: 3000, y: 5000, w: 200, h: 30 } } });
await settle();
expect("a line far from the circle is ignored", learnerPosts.length === posts);
brain.handleCanvas(line("2x + 3 = 14", 220));
await settle();
expect("Q8's planted mistake is flagged", learnerPosts.at(-1)?.verdict === "wrong" && !!tutorBodies.at(-1)?.event);

console.log(`\n${pass}/${total} passed`);
if (pass !== total) process.exit(1);

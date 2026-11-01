/**
 * Does the tutor stay on maths? Sends maths and non-maths questions to Gemini with the real prompt and schema,
 * N times each (Gemini varies), and scores them: non-maths must come back kind "off-topic", maths must not.
 * Costs one Gemini call per question per round. Never prints the key.
 * Run: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/brain-scope.mts [rounds=2]
 */
import { SYSTEM_PROMPT } from "../src/lib/agent/prompt";
import { TURN_SCHEMA } from "../src/lib/agent/schema";

const KEY = process.env[process.env.APP_ENV === "demo" ? "GEMINI_KEY_DEMO" : "GEMINI_KEY_DEV"] ?? "";
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const Q1 = "1. How does the graph of y = a·x² change as a changes?";

type Case = { said: string; pdfText?: string; expect: "redirect" | "answer" };
const CASES: Case[] = [
  { said: "what is a deadlock in operating systems?", pdfText: Q1, expect: "redirect" },
  { said: "explain kernels in linux", pdfText: Q1, expect: "redirect" },
  { said: "who won the last cricket world cup?", expect: "redirect" },
  { said: "write me a short poem about the sea", pdfText: Q1, expect: "redirect" },
  { said: "what is the kernel of a matrix?", expect: "answer" },
  { said: "what is a deadlock?", expect: "redirect" },
  { said: "tell me a joke", pdfText: Q1, expect: "redirect" },
  { said: "what are eigenvalues of a matrix?", expect: "answer" },
  { said: "in graph theory what is the degree of a vertex?", expect: "answer" },
  { said: "a car starts from rest and accelerates at 2 m/s^2 for 3 seconds, how far does it go?", expect: "answer" },
  { said: "what is the probability of getting a sum of 7 with two dice?", expect: "answer" },
  { said: "what does a do here?", pdfText: Q1, expect: "answer" },
];

const NEW_PROFILE = "Learner profile: a new learner, no earlier problems. Start at a middle level and find out what they know.";

function contents(c: Case, withProfile: boolean) {
  const text = [
    ...(withProfile ? [NEW_PROFILE] : []),
    "Conversation so far:\n(this is the first question about this circle)",
    "Student model: hintLevel 1, anglesTried [], misconceptions [], checks passed 0, failed 0.",
    "Graphs already on screen: none.",
    `The student now says: "${c.said}"`,
    "Reply with the next teaching turn.",
  ].join("\n\n");
  return [{ role: "user", parts: [
    { text: c.pdfText ? "(The circled picture is omitted in this test.)" : "The student hasn't circled anything yet." },
    ...(c.pdfText ? [{ text: `Printed text inside the circle: ${c.pdfText}` }] : []),
    { text },
  ] }];
}

async function ask(prompt: string, schema: unknown, c: Case, withProfile: boolean) {
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt }] },
          contents: contents(c, withProfile),
          generationConfig: { temperature: 0.4, responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingLevel: "low" } },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(String(res.status));
      const turn = JSON.parse(json.candidates[0].content.parts.map((p: { text?: string }) => p.text ?? "").join(""));
      return { kind: turn.kind as string, says: (turn.beats as { say: string }[]).map((b) => b.say).join(" ") };
    } catch { /* next model */ }
  }
  return { kind: "-", says: "(no model answered)" };
}

const rounds = Number(process.argv[2] ?? 2);
let right = 0, total = 0, busy = 0;
for (const c of CASES) {
  const kinds: string[] = [];
  for (let i = 0; i < rounds; i++) {
    const r = await ask(SYSTEM_PROMPT, TURN_SCHEMA, c, true);
    if (r.kind === "-") { busy++; kinds.push("busy"); continue; }
    total++;
    const ok = (r.kind === "off-topic") === (c.expect === "redirect");
    if (ok) right++;
    kinds.push(ok ? r.kind : `WRONG ${r.kind}: ${r.says.slice(0, 120)}`);
  }
  console.log(`${kinds.some((k) => k.startsWith("WRONG")) ? "FAIL" : "ok  "} "${c.said}" (should ${c.expect}): ${kinds.join(" | ")}`);
}
console.log(`
${right}/${total} right${busy ? ` (${busy} not answered: Gemini busy)` : ""}`);
if (right !== total) process.exit(1);

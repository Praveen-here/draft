/**
 * The brain's line-by-line checking (work.ts) on the practice sheet. Run: npx tsx src/lib/agent/work.test.ts
 */
import { createMathApi } from "@/lib/math";
import { createWork, looksLikeMath, type LineVerdict } from "./work";

type Case = { problem: string; lines: [string, LineVerdict][] };

const cases: Case[] = [
  {
    problem: "6. Find the integral of x·e^x dx.",
    lines: [["x e^x - \\int e^x dx", "ok"], ["x e^x + e^x + C", "wrong"], ["x e^x - e^x + C", "solved"]],
  },
  { problem: "6. Find the integral of x·e^x dx.", lines: [["x e^x + \\int e^x dx", "wrong"], ["x e^x - \\int e^x dx", "ok"], ["x e^x - e^x", "wrong"]] },
  { problem: "8. Solve 2(x + 3) = 14", lines: [["2x + 3 = 14", "wrong"], ["2x + 6 = 14", "ok"], ["2x = 8", "ok"], ["x = 4", "solved"]] },
  { problem: "9. Differentiate y = (3x + 1)^2", lines: [["dy/dx = 2(3x + 1)", "wrong"], ["\\frac{dy}{dx} = 6(3x+1)", "solved"]] },
  { problem: "7. Simplify (x^2 - 9)/(x - 3)", lines: [["x + 3", "ok"]] },
  { problem: "1. How does the graph of y = a·x² change as a changes?", lines: [["a x^2", "unclear"]] },
];

const math = createMathApi();
let pass = 0, total = 0;
for (const c of cases) {
  const work = createWork(math);
  work.setProblem(c.problem);
  for (const [latex, want] of c.lines) {
    const got = (await work.addLine(latex, null))?.verdict;
    total++;
    if (got === want) pass++;
    console.log(`${got === want ? "ok  " : "FAIL"} ${c.problem.slice(0, 32).padEnd(32)} | ${latex.padEnd(26)} → ${got} (want ${want})`);
  }
}

const said: [string, boolean][] = [["x e^x - e^x + C", true], ["x = 4", true], ["it gets narrower", false], ["is it x squared?", false], ["2", false]];
for (const [text, want] of said) {
  total++;
  if (looksLikeMath(text) === want) pass++;
  else console.log(`FAIL looksLikeMath(${text}) = ${!want}`);
}
const w = createWork(math);
w.setProblem("6. Find the integral of x·e^x dx.");
const j = await w.judgeAnswer("x e^x + e^x + C");
total++;
if (j && !j.check.ok) pass++;
else console.log("FAIL judgeAnswer wrong sign", j);

console.log(`\n${pass}/${total} passed`);
if (pass !== total) process.exit(1);

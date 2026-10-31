/**
 * Math engine checks. Run: npx jiti src/lib/math/check.test.ts
 * ok = right, wrong = not-equivalent, unclear = unsure or unparseable (the engine stays quiet).
 */
import { checkAnswerSync, checkStepSync } from "./checkStep";

type Want = "ok" | "wrong" | "unclear";
type Case = [string, string, Want, string?];

const steps: Case[] = [
  // ∫ x eˣ dx, the demo problem
  ["\\int x e^x dx", "x e^x - \\int e^x dx", "ok", "integration by parts"],
  ["\\int x e^{x}\\,dx", "= x e^{x} - \\int e^{x}\\,dx", "ok", "same, LaTeX spacing"],
  ["x e^x - \\int e^x dx", "x e^x - e^x + C", "ok"],
  ["x eˣ − ∫eˣ dx", "= x eˣ − eˣ + C", "ok", "unicode"],
  ["\\int x e^x dx", "x e^x + \\int e^x dx", "wrong", "the sign mistake"],
  ["x e^x - \\int e^x dx", "x e^x + e^x + C", "wrong"],
  ["\\int x e^x dx", "x e^x - e^x", "wrong", "missing + C"],
  ["\\int x e^x dx", "u = x", "unclear", "definition"],
  ["u = x", "du = dx", "unclear"],
  ["\\int 2x dx", "\\int 2x dx = x^3 + C", "wrong", "line contradicts itself"],

  // Practice sheet Q8–Q11 (planted mistakes) and fixes
  ["2(x + 3) = 14", "2x + 3 = 14", "wrong", "Q8"],
  ["2(x + 3) = 14", "2x + 6 = 14", "ok"],
  ["2x + 6 = 14", "2x = 8", "ok"],
  ["2x = 8", "x = 4", "ok"],
  ["y = (3x + 1)²", "dy/dx = 2(3x + 1)", "wrong", "Q9 chain rule"],
  ["y = (3x+1)^2", "\\frac{dy}{dx} = 6(3x+1)", "ok"],
  ["\\int 2x dx", "= x²", "wrong", "Q10 + C"],
  ["\\int 2x\\,dx", "= x^2 + C", "ok"],
  ["(x + 4)²", "= x² + 16", "wrong", "Q11"],
  ["(x+4)^2", "x^2 + 8x + 16", "ok"],

  // Q5, Q7
  ["\\frac{x^2 - 9}{x - 3}", "x + 3", "ok"],
  ["(x² - 9) / (x - 3)", "x - 3", "wrong"],
  ["x^2 - 5x + 6 = 0", "(x-2)(x-3) = 0", "ok"],
  ["x^2 - 5x + 6 = 0", "(x-2)(x+3) = 0", "wrong"],

  // Algebra and functions
  ["\\frac{x}{x+1} = 2", "x = 2(x+1)", "ok", "multiply both sides by x + 1"],
  ["\\sin^2 x + \\cos^2 x", "1", "ok"],
  ["2\\sin x \\cos x", "\\sin(2x)", "ok"],
  ["\\sin(2x)", "2\\sin x", "wrong"],
  ["\\ln(x^2)", "2\\ln x", "ok", "only defined for x > 0 on one side"],
  ["\\sqrt{x^2}", "|x|", "ok"],
  ["\\frac12 x", "x/2", "ok"],
  ["\\frac{1}{x}", "x^{-1}", "ok"],
  ["a x^2 + a x", "a x (x + 1)", "ok", "other letters"],
  ["x(x+1)", "x^2 + x", "ok"],
  ["xe^{x}", "x \\cdot e^x", "ok"],
  ["x^2", "\\foo{x}", "unclear", "unknown LaTeX"],

  // False alarms are the worst failure (the tutor interrupts wrongly), so: many right-but-different forms
  ["e^{2x}", "(e^x)^2", "ok"],
  ["\\tan x", "\\frac{\\sin x}{\\cos x}", "ok"],
  ["\\frac{x^2+2x}{x}", "x + 2", "ok"],
  ["\\frac{d}{dx}(x^2)", "2x", "ok"],
  ["x + 1 = 3", "x = 2", "ok"],
  ["y = x^2 + 2x", "y = x(x + 2)", "ok"],
  ["3x - 2", "3(x - 2)", "wrong"],
  ["x^2 = 9", "x = 3", "wrong", "lost x = -3"],
  ["\\int \\frac{1}{x} dx", "\\ln|x| + C", "ok"],
  ["\\int \\cos x dx", "\\sin x + C", "ok"],
  ["\\int \\cos x dx", "-\\sin x + C", "wrong"],
  ["\\int x^2 dx", "\\frac{x^3}{3} + C", "ok"],
  ["\\int e^{2x} dx", "\\frac{1}{2}e^{2x} + C", "ok"],
  ["\\int e^{2x} dx", "e^{2x} + C", "wrong"],
  ["\\int \\sin x \\cos x \\, dx", "\\frac{\\sin^2 x}{2} + C", "ok"],
  ["\\int \\sin x \\cos x \\, dx", "-\\frac{\\cos^2 x}{2} + C", "ok", "differs by a constant, still right"],
];

const answers: Case[] = [
  ["6. Find the integral of x·e^x dx.", "x e^x - e^x + C", "ok", "Q6"],
  ["6. Find the integral of x·e^x dx.", "x e^x + e^x + C", "wrong"],
  ["6. Find the integral of x·e^x dx.", "x e^x - e^x", "wrong", "missing + C"],
  ["\\int x e^x dx", "(x - 1)e^x + C", "ok"],
  ["5. Solve x² - 5x + 6 = 0.", "x = 2 or x = 3", "ok", "Q5"],
  ["5. Solve x² - 5x + 6 = 0.", "x = 2", "wrong", "a solution missing"],
  ["5. Solve x² - 5x + 6 = 0.", "x = 2, 4", "wrong"],
  ["Solve x^2 = 4", "x = \\pm 2", "ok"],
  ["8. Solve 2(x + 3) = 14", "x = 5.5", "wrong", "Q8"],
  ["8. Solve 2(x + 3) = 14", "x = 4", "ok"],
  ["9. Differentiate y = (3x + 1)²", "dy/dx = 2(3x + 1)", "wrong", "Q9"],
  ["9. Differentiate y = (3x + 1)²", "dy/dx = 6(3x + 1)", "ok"],
  ["9. Differentiate y = (3x + 1)²", "18x + 6", "ok"],
  ["7. Simplify (x² - 9) / (x - 3)", "x + 3", "ok", "Q7"],
  ["11. Expand (x + 4)²", "x² + 16", "wrong", "Q11"],
  ["\\int_0^2 x^2 dx", "\\frac{8}{3}", "ok", "definite integral (Q3)"],
  ["\\int_0^2 x^2 dx", "3", "wrong"],
  ["\\frac{d}{dx}(\\sin x)", "\\cos x", "ok"],
  ["2. Find the slope of the curve y = x² at the point x = 1.", "2", "unclear", "word problem"],
];

function verdict(r: ReturnType<typeof checkStepSync>): Want {
  return r.ok ? "ok" : r.reason === "not-equivalent" ? "wrong" : "unclear";
}

let failed = 0;
const run = (title: string, cases: Case[], fn: typeof checkStepSync) => {
  console.log(`\n${title}`);
  for (const [a, b, want, note] of cases) {
    const t = performance.now();
    const r = fn(a, b);
    const ms = performance.now() - t;
    const got = verdict(r);
    const pass = got === want;
    if (!pass) failed++;
    const detail = !r.ok && r.detail ? `  · ${r.detail}` : "";
    console.log(`${pass ? "PASS" : "FAIL"} ${got.padEnd(7)} ${ms.toFixed(0).padStart(3)}ms  ${a}  →  ${b}${note ? `  (${note})` : ""}${pass ? "" : `  [wanted ${want}]`}${detail}`);
  }
};

run("checkStep(prev, next)", steps, checkStepSync);
run("checkAnswer(problem, answer)", answers, checkAnswerSync);
console.log(`\n${steps.length + answers.length - failed}/${steps.length + answers.length} passed`);
if (failed) process.exit(1);

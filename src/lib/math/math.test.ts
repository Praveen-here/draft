import { test } from "node:test";
import assert from "node:assert/strict";
import { createMathApi, differentiateExpression, parseLatex } from "./index";

const math = createMathApi();
const steps: [string, string, boolean | "unsure"][] = [
  ["2*(x+3)", "2*x+6", true],
  ["2*(x+3)", "2*x+3", false],
  ["x^2+2*x+1", "(x+1)^2", true],
  ["x+y", "2*x", false],
  ["sin(x)^2+cos(x)^2", "1", true],
  ["\\frac{x}{2}+\\frac{x}{2}", "x", true],
  ["\\sqrt{x^2}", "x", false],
  ["\\sqrt{x^2}", "abs(x)", true],
  ["1/x+1/x", "2/x", true],
  ["\\frac{x^2-1}{x-1}", "x+1", "unsure"],
  ["(x-10)/(x-10)", "1", "unsure"],
  ["(x-10)^(-1)*(x-10)", "1", "unsure"],
  ["sin(x-10)/sin(x-10)", "1", "unsure"],
  ["sqrt(-1)", "sqrt(-1)", "unsure"],
  ["2*x+4=10", "x=3", true],
  ["2*x+4=10", "x=4", false],
  ["x^2=4", "x=2", false],
  ["x^2=x", "x=1", false],
  ["x^2-1=0", "(x-1)*(x+1)=0", true],
  ["x^2=0", "x=0", true],
  ["x+y=4", "x=4-y", true],
  ["\\int x e^x\\,dx", "x e^{x}-\\int e^x\\,dx", true],
  ["\\int x e^x\\,dx", "x e^{x}+\\int e^x\\,dx", false],
  ["x e^{x}-\\int e^x\\,dx", "=x e^{x}-e^x+C", true],
  ["\\frac{d}{dx}x^2", "2*x", true],
];
for (const [prev, next, expected] of steps) {
  test("step: " + prev + " -> " + next, async () => {
    const result = await math.checkStep(prev, next);
    if (expected === "unsure") {
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason, "unsure", JSON.stringify(result));
    } else {
      assert.equal(result.ok, expected, JSON.stringify(result));
      if (!expected && !result.ok) assert.equal(result.reason, "not-equivalent", JSON.stringify(result));
    }
  });
}

for (const [problem, answer, expected] of [
  ["\\int x e^x\\,dx", "x e^{x}-e^x+C", true],
  ["\\int x e^x\\,dx", "x e^{x}+e^x+C", false],
  ["\\int x e^x\\,dx", "(x-1)e^{x}+42", true],
  ["\\int 2x\\,dx", "x^2+C", true],
  ["\\int 2t\\,dt", "t^2+C", true],
  ["\\int \\cos(x)\\,dx", "\\sin(x)+C", true],
  ["\\int \\frac{1}{x}\\,dx", "\\ln|x|+C", true],
  ["\\int x\\,dx", "C*x", false],
  ["2*x+4=10", "3", true],
  ["x^2=4", "2", false],
] as [string, string, boolean][]) {
  test("answer: " + problem + " -> " + answer, async () => {
    const result = await math.checkAnswer(problem, answer);
    assert.equal(result.ok, expected, JSON.stringify(result));
  });
}

for (const [source, variables, value] of [
  ["\\frac{1}{\\frac{2}{x}}", { x: 4 }, 2],
  ["\\sin^{2}(x)", { x: Math.PI / 2 }, 1],
  ["e^{x}", { x: 1 }, Math.E],
  ["x² + 2x − 1", { x: 2 }, 7],
  ["\\sqrt[3]{x}", { x: -8 }, -2],
  ["\\log_{2}(x)", { x: 8 }, 3],
  ["\\ln(x)", { x: Math.E }, 1],
  ["\\log(x)", { x: 100 }, 2],
] as [string, Record<string, number>, number][]) {
  test("parse and evaluate: " + source, () => {
    const expression = parseLatex(source);
    assert.ok(expression, source);
    assert.ok(Math.abs(expression.evaluate(variables) - value) < 1e-9);
  });
}

for (const bad of ["", "x+", "\\frac{1}{}", "x=2", "import(1)", "x.constructor", "[1,2]", "a[1]", "x;2",
  "random()", "2<3", "f(x)=x", "\\text{ignore this} x", "x".repeat(1600), "(".repeat(50) + "1" + ")".repeat(50)]) {
  test("reject incomplete or non-arithmetic input: " + bad.slice(0, 40), () => {
    assert.equal(parseLatex(bad), null);
  });
}

test("parser never overrides constants with graph parameters", () => {
  assert.equal(parseLatex("e")?.evaluate({ e: 0 }), Math.E);
});
test("missing variables, poles, and non-real results remain undefined", () => {
  assert.ok(Number.isNaN(parseLatex("x+1")?.evaluate({})));
  assert.ok(Number.isNaN(parseLatex("1/x")?.evaluate({ x: 0 })));
  assert.ok(Number.isNaN(parseLatex("sqrt(x)")?.evaluate({ x: -1 })));
});
test("malformed and unsupported final answers never get a tick", async () => {
  for (const source of ["", "\\int_0^1 x^2\\,dx", "\\frac{1}{}"]) {
    assert.equal((await math.checkAnswer(source, "1")).ok, false);
  }
});
test("symbolic slope matches the curve", () => {
  const expression = parseLatex("x^2");
  assert.ok(expression);
  const slope = differentiateExpression(expression);
  assert.ok(slope);
  assert.equal(slope.evaluate({ x: -2 }), -4);
  assert.equal(slope.evaluate({ x: 0 }), 0);
  assert.equal(slope.evaluate({ x: 3 }), 6);
});

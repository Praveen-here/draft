import { test } from "node:test";
import assert from "node:assert/strict";
import { createMathApi, differentiateExpression, parseLatex } from "./index";

const math = createMathApi();
// Step and answer checking (createMathApi) is covered by check.test.ts, built from the practice sheet.

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

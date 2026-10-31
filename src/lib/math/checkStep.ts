import type { MathApi, StepCheck } from "@/lib/contracts";
import { parseLine, type Expr, type ParsedLine } from "./parse";
import { differentiateExpression, difference } from "./calculus";
import { compareExpressions, close, different, unsure } from "./compare";
import { polynomial, realRoots } from "./polynomial";

const unparseable = (): StepCheck => ({
  ok: false,
  reason: "unparseable",
  detail: "I could not read this notation reliably. Check the transcription or use a simpler expression.",
});

function checkExpressions(prev: Expr, next: Expr): StepCheck {
  const integralVariables = [...new Set([...prev.integralVariables, ...next.integralVariables])];
  if (integralVariables.length) {
    if (integralVariables.length !== 1) return unsure("Check one integration variable at a time.");
    const left = differentiateExpression(prev, integralVariables[0]);
    const right = differentiateExpression(next, integralVariables[0]);
    return left && right
      ? compareExpressions(left, right)
      : unsure("I cannot safely differentiate this integral step.");
  }
  return compareExpressions(prev, next);
}

type Equation = Extract<ParsedLine, { kind: "equation" }>;

function checkEquations(prev: Equation, next: Equation): StepCheck {
  const expressions = [prev.left, prev.right, next.left, next.right];
  if (expressions.some((expr) => expr.integralVariables.length)) return unsure("Check the expressions on each side of this integral separately.");
  const left = difference(prev.left, prev.right);
  const right = difference(next.left, next.right);
  const variables = [...new Set([...left.variables, ...right.variables])];
  if (variables.length === 1) {
    const a = polynomial(left.node, variables[0]), b = polynomial(right.node, variables[0]);
    const rootsA = a && realRoots(a), rootsB = b && realRoots(b);
    if (rootsA && rootsB) {
      if (rootsA.kind === "all" || rootsB.kind === "all")
        return rootsA.kind === rootsB.kind ? { ok: true } : different("This changes which values solve the equation.");
      if (!rootsA.values.length && !rootsB.values.length) return unsure("Neither equation has a real solution.");
      const unique = (values: number[]) => values.filter((value, index) => index === 0 || !close(value, values[index - 1]));
      const valuesA = unique(rootsA.values), valuesB = unique(rootsB.values);
      return valuesA.length === valuesB.length && valuesA.every((value, index) => close(value, valuesB[index]))
        ? { ok: true }
        : different("This changes the solution set. Check whether a possible solution was added or lost.");
    }
  }
  const direct = compareExpressions(left, right);
  if (direct.ok) return direct;
  return compareExpressions(left, right, true);
}

/** The engine verifies real-valued mathematics; unsupported cases are never marked correct. */
export function createMathApi(): MathApi {
  return {
    async checkStep(prevLatex, nextLatex): Promise<StepCheck> {
      try {
        const prev = parseLine(prevLatex), next = parseLine(nextLatex);
        if (!prev || !next) return unparseable();
        if (prev.kind === "equation" && next.kind === "equation") return checkEquations(prev, next);
        if (prev.kind !== "expression" || next.kind !== "expression")
          return unsure("Use an expression on both lines, or include both sides of each equation.");
        return checkExpressions(prev.expression, next.expression);
      } catch {
        return unsure("This step needs more context to check reliably.");
      }
    },
    async checkAnswer(problemLatex, answerLatex): Promise<StepCheck> {
      try {
        const problem = parseLine(problemLatex), answer = parseLine(answerLatex);
        if (!problem || !answer) return unparseable();
        if (problem.kind === "equation") {
          if (answer.kind === "equation") return checkEquations(problem, answer);
          const variables = [...new Set([...problem.left.variables, ...problem.right.variables])];
          if (variables.length !== 1) return unsure("Specify which variable this answer solves for.");
          const candidate = parseLine(variables[0] + "=" + answerLatex);
          return candidate?.kind === "equation" ? checkEquations(problem, candidate) : unparseable();
        }
        if (answer.kind !== "expression") return unsure("Enter the answer expression without an extra equation.");
        if (answer.expression.integralVariables.length) return unsure("Finish the integral before checking the final answer.");
        // Differentiation naturally ignores additive constants, including + C.
        return checkExpressions(problem.expression, answer.expression);
      } catch {
        return unsure("I cannot verify this answer reliably yet.");
      }
    },
  };
}

import {
  type MathNode, type OperatorNode, type ParenthesisNode, type SymbolNode, type ConstantNode,
} from "mathjs/number";
import { expressionFromNode, type Expr } from "./parse";

/** Exact AST recognition of real polynomials of degree <= 2; no curve fitting. */
export function polynomial(node: MathNode, variable: string): number[] | null {
  const tidy = (values: number[]) => {
    while (values.length > 1 && values.at(-1) === 0) values.pop();
    return values.length <= 3 && values.every(Number.isFinite) ? values : null;
  };
  const add = (a: number[], b: number[], sign = 1) =>
    tidy(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + sign * (b[i] ?? 0)));
  const multiply = (a: number[], b: number[]) => {
    const result = Array(a.length + b.length - 1).fill(0) as number[];
    a.forEach((value, i) => b.forEach((other, j) => { result[i + j] += value * other; }));
    return tidy(result);
  };
  const read = (part: MathNode): number[] | null => {
    if (part.type === "ParenthesisNode") return read((part as ParenthesisNode).content);
    if (part.type === "ConstantNode") return [Number((part as ConstantNode).value)];
    if (part.type === "SymbolNode") {
      const name = (part as SymbolNode).name;
      return name === variable ? [0, 1] : name === "e" ? [Math.E] : name === "pi" ? [Math.PI] : null;
    }
    if (part.type === "OperatorNode") {
      const operation = part as OperatorNode;
      const a = read(operation.args[0]);
      if (!a) return null;
      if (operation.args.length === 1) return operation.op === "-" ? a.map((v) => -v) : a;
      const b = read(operation.args[1]);
      if (!b) return null;
      if (operation.op === "+") return add(a, b);
      if (operation.op === "-") return add(a, b, -1);
      if (operation.op === "*") return multiply(a, b);
      if (operation.op === "/" && b.length === 1 && b[0] !== 0) return tidy(a.map((v) => v / b[0]));
      if (operation.op === "^" && b.length === 1 && Number.isInteger(b[0]) && b[0] >= 0 && b[0] <= 2) {
        return b[0] === 0 ? [1] : b[0] === 1 ? a : multiply(a, a);
      }
      return null;
    }
    try {
      const expression = expressionFromNode(part);
      if (expression.variables.length === 0) {
        const value = expression.evaluate({});
        return Number.isFinite(value) ? [value] : null;
      }
    } catch { /* Unsupported syntax remains uncertain. */ }
    return null;
  };
  return read(node);
}

export type RootSet = { kind: "all" } | { kind: "roots"; values: number[] };

/** null means ill-conditioned; [] means no real solutions. */
export function realRoots(coefficients: number[]): RootSet | null {
  const [c = 0, b = 0, a = 0] = coefficients;
  if (!coefficients.every(Number.isFinite)) return null;
  if (a === 0) {
    if (b === 0) return c === 0 ? { kind: "all" } : { kind: "roots", values: [] };
    const root = -c / b;
    return Number.isFinite(root) ? { kind: "roots", values: [root] } : null;
  }
  const discriminant = b * b - 4 * a * c;
  if (!Number.isFinite(discriminant)) return null;
  if (discriminant < 0) return { kind: "roots", values: [] };
  if (discriminant === 0) return { kind: "roots", values: [-b / (2 * a)] };
  const q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(discriminant));
  const values = [q / a, c / q].sort((x, y) => x - y);
  return values.every(Number.isFinite) ? { kind: "roots", values } : null;
}

/** Probe excluded points explicitly, including holes away from the usual random range. */
export function domainPoints(expression: Expr, variable: string): number[] {
  const points: number[] = [];
  expression.node.traverse((part) => {
    if (part.type !== "OperatorNode") return;
    const operation = part as OperatorNode;
    const base = operation.op === "/" ? operation.args[1]
      : operation.op === "^" && operation.args[1]?.type === "ConstantNode" &&
        Number((operation.args[1] as ConstantNode).value) < 0 ? operation.args[0] : null;
    if (!base) return;
    const coefficients = polynomial(base, variable);
    const roots = coefficients && realRoots(coefficients);
    if (roots?.kind === "roots") points.push(...roots.values);
  });
  return points;
}

/** Conservative domain fingerprints also catch poles that random sampling cannot hit exactly. */
export function domainSignature(expression: Expr): string[] {
  const keys = new Set<string>();
  expression.node.traverse((part) => {
    if (part.type !== "OperatorNode") return;
    const operation = part as OperatorNode;
    let base: MathNode | undefined;
    if (operation.op === "/") base = operation.args[1];
    if (operation.op === "^") {
      try {
        const exponent = expressionFromNode(operation.args[1]);
        if (!exponent.variables.length && exponent.evaluate({}) < 0) base = operation.args[0];
      } catch { /* Preserve uncertainty for unsupported powers. */ }
    }
    if (!base) return;
    while (base.type === "ParenthesisNode" || (base.type === "FunctionNode" &&
      ["abs", "sqrt"].includes((base as import("mathjs/number").FunctionNode).fn.name))) {
      base = base.type === "ParenthesisNode" ? (base as ParenthesisNode).content :
        (base as import("mathjs/number").FunctionNode).args[0];
    }
    const parsed = expressionFromNode(base);
    if (!parsed.variables.length) return;
    if (parsed.variables.length === 1) {
      const coefficients = polynomial(base, parsed.variables[0]);
      const roots = coefficients && realRoots(coefficients);
      if (roots?.kind === "roots") {
        roots.values.forEach((value) => keys.add(parsed.variables[0] + "!=" + Number(value.toPrecision(12))));
        return;
      }
    }
    keys.add("nonzero:" + base.toString());
  });
  return [...keys].sort();
}

import { parse as parseTex } from "@cortex-js/compute-engine/latex-syntax";
import {
  derivative as mathDerivative,
  parse as parseMath,
  type MathNode,
  type FunctionNode,
  type OperatorNode,
  type SymbolNode,
  type ConstantNode,
  type ParenthesisNode,
} from "mathjs/number";

/** A real expression. Undefined, non-real, and missing-variable values evaluate to NaN. */
export type Expr = {
  evaluate(vars: Record<string, number>): number;
  variables: string[];
  node: MathNode;
  latex: string;
  integralVariables: string[];
};

export type ParsedLine =
  | { kind: "expression"; expression: Expr }
  | { kind: "equation"; left: Expr; right: Expr };

const constants = new Set(["e", "pi"]);
const symbolPattern = /^(?:[a-zA-Z]|alpha|beta|theta|phi|omega)$/;
const functions = new Set([
  "sin", "cos", "tan", "sec", "csc", "cot", "asin", "acos", "atan",
  "sinh", "cosh", "tanh", "exp", "log", "log10", "log2", "sqrt", "nthRoot", "abs", "sign",
]);
const operators = new Set(["+", "-", "*", "/", "^"]);
const superscripts: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5",
  "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+",
  "ˣ": "x", "ʸ": "y", "ⁿ": "n",
};

export function normalizeMath(input: string): string {
  return input.trim()
    .replace(/^\$\$([\s\S]*)\$\$$/, "$1")
    .replace(/^\$([\s\S]*)\$$/, "$1")
    .replace(/^\\\(([\s\S]*)\\\)$/, "$1")
    .replace(/^\\\[([\s\S]*)\\\]$/, "$1")
    .replace(/[−–]/g, "-")
    .replace(/[×·⋅]/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, "\\pi ")
    .replace(/∫/g, "\\int ")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ˣʸⁿ]+/g, (run) =>
      "^{" + [...run].map((char) => superscripts[char]).join("") + "}")
    .replace(/^\s*=(?!=)\s*/, "")
    .trim();
}

function checkInput(source: string): void {
  if (!source || source.length > 1500) throw new Error("Empty or oversized expression");
  let depth = 0;
  for (const char of source) {
    if ("({[".includes(char) && ++depth > 40) throw new Error("Expression is too deeply nested");
    if (")}]".includes(char)) depth--;
    if (depth < 0) throw new Error("Unbalanced expression");
  }
  if (depth !== 0) throw new Error("Unbalanced expression");
}

/** Convert only the arithmetic subset of MathJSON. No canonicalization: retain domain restrictions. */
function texToSource(value: unknown, allowIntegral: boolean, budget = { left: 300 }, depth = 0): string {
  if (--budget.left < 0 || depth > 40) throw new Error("Expression is too complex");
  const convert = (next: unknown) => texToSource(next, allowIntegral, budget, depth + 1);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    if (value === "Pi") return "pi";
    if (value === "ExponentialE") return "e";
    if (symbolPattern.test(value) || constants.has(value)) return value;
    throw new Error("Unsupported symbol");
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const object = value as { num?: unknown; fn?: unknown; sym?: unknown };
    if (typeof object.num === "string" && /^-?\d+(?:\.\d*)?(?:e[+-]?\d+)?$/i.test(object.num)) {
      if (!Number.isFinite(Number(object.num))) throw new Error("Non-finite number");
      return object.num;
    }
    if (object.fn) return convert(object.fn);
    if (object.sym) return convert(object.sym);
  }
  if (!Array.isArray(value)) throw new Error("Unparseable expression");
  const [head, ...args] = value;
  const binary: Record<string, string> = { Subtract: "-", Divide: "/", Rational: "/", Power: "^" };
  if (head === "Add" || head === "Multiply" || head === "InvisibleOperator") {
    if (args.length < 2) throw new Error("Missing operand");
    return "(" + args.map(convert).join(head === "Add" ? "+" : "*") + ")";
  }
  if (typeof head === "string" && Object.hasOwn(binary, head) && args.length === 2)
    return "(" + convert(args[0]) + binary[head] + convert(args[1]) + ")";
  if (head === "Negate" && args.length === 1) return "(-" + convert(args[0]) + ")";
  if (head === "Delimiter" && args.length === 1) return "(" + convert(args[0]) + ")";
  if (head === "Square" && args.length === 1) return "(" + convert(args[0]) + "^2)";
  if (head === "Root" && args.length === 2) return "nthRoot(" + args.map(convert).join(",") + ")";
  const names: Record<string, string> = {
    Sin: "sin", Cos: "cos", Tan: "tan", Sec: "sec", Csc: "csc", Cot: "cot",
    Arcsin: "asin", Arccos: "acos", Arctan: "atan", Sinh: "sinh", Cosh: "cosh",
    Tanh: "tanh", Exp: "exp", Sqrt: "sqrt", Abs: "abs", Ln: "log", Lb: "log2", Lg: "log10",
  };
  if (typeof head === "string" && Object.hasOwn(names, head) && args.length === 1)
    return names[head] + "(" + convert(args[0]) + ")";
  if (head === "Log" && (args.length === 1 || args.length === 2))
    return (args.length === 1 ? "log10" : "log") + "(" + args.map(convert).join(",") + ")";
  if (head === "Integrate" && allowIntegral && args.length === 2 &&
      typeof args[1] === "string" && /^[a-zA-Z]$/.test(args[1]) && !constants.has(args[1])) {
    return "__integral(" + convert(args[0]) + "," + args[1] + ")";
  }
  if (head === "D" && args.length === 2 && typeof args[1] === "string" &&
      /^[a-zA-Z]$/.test(args[1]) && !constants.has(args[1])) {
    const expression = parseMath(convert(args[0]));
    validateNode(expression, false);
    return "(" + mathDerivative(expression, args[1], { simplify: false }).toString() + ")";
  }
  throw new Error("Unsupported or incomplete notation");
}

function validateNode(node: MathNode, allowIntegral: boolean): { variables: string[]; integralVariables: string[] } {
  const variables = new Set<string>();
  const integralVariables = new Set<string>();
  let count = 0;
  const visit = (current: MathNode, depth: number) => {
    if (++count > 400 || depth > 45) throw new Error("Expression is too complex");
    switch (current.type) {
      case "ConstantNode": {
        const value = (current as ConstantNode).value;
        if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Not a real number");
        break;
      }
      case "SymbolNode": {
        const name = (current as SymbolNode).name;
        if (constants.has(name)) break;
        if (!symbolPattern.test(name)) throw new Error("Unsupported symbol");
        variables.add(name);
        break;
      }
      case "ParenthesisNode":
        visit((current as ParenthesisNode).content, depth + 1);
        break;
      case "OperatorNode": {
        const operation = current as OperatorNode;
        if (!operators.has(operation.op) || operation.args.length > 2) throw new Error("Unsupported operator");
        operation.args.forEach((arg) => visit(arg, depth + 1));
        break;
      }
      case "FunctionNode": {
        const call = current as FunctionNode;
        if (call.fn.type !== "SymbolNode") throw new Error("Unsupported function");
        const name = call.fn.name;
        if (name === "__integral" && allowIntegral && call.args.length === 2 &&
            call.args[1].type === "SymbolNode") {
          integralVariables.add((call.args[1] as SymbolNode).name);
        } else if (!functions.has(name) || call.args.length < 1 || call.args.length > (name === "log" || name === "nthRoot" ? 2 : 1)) {
          throw new Error("Unsupported function");
        }
        call.args.forEach((arg) => visit(arg, depth + 1));
        break;
      }
      default:
        throw new Error("Only mathematical expressions are accepted");
    }
  };
  visit(node, 0);
  if (variables.size > 8) throw new Error("Too many variables");
  return { variables: [...variables].sort(), integralVariables: [...integralVariables] };
}

export function expressionFromNode(node: MathNode, allowIntegral = false): Expr {
  const { variables, integralVariables } = validateNode(node, allowIntegral);
  const compiled = node.compile();
  return {
    node,
    variables,
    integralVariables,
    latex: integralVariables.length ? "" : node.toTex({ parenthesis: "auto" }),
    evaluate(vars) {
      if (integralVariables.length) return NaN;
      try {
        const scope = new Map<string, number>();
        for (const name of variables) {
          if (!Object.hasOwn(vars, name) || !Number.isFinite(vars[name])) return NaN;
          scope.set(name, vars[name]);
        }
        const result: unknown = compiled.evaluate(scope);
        return typeof result === "number" && Number.isFinite(result) ? result : NaN;
      } catch {
        return NaN;
      }
    },
  };
}

function parseExpression(input: string, allowIntegral: boolean): Expr | null {
  try {
    const source = normalizeMath(input);
    checkInput(source);
    // Never reinterpret failed plain syntax as a series of LaTeX letters.
    const isTex = /[\\{}]/.test(source);
    const converted = isTex
      ? texToSource(parseTex(source), allowIntegral)
      : source.replace(/\bln(?=\s*\()/g, "log");
    if (!isTex && converted.includes("__")) return null;
    return expressionFromNode(parseMath(converted), allowIntegral && isTex);
  } catch {
    return null;
  }
}

/** LaTeX or ordinary math syntax -> a safe, real-valued expression (no equations or integrals). */
export function parseLatex(latex: string): Expr | null {
  if (typeof latex !== "string") return null;
  return parseExpression(latex, false);
}

/** Equations and indefinite integrals are handled by the checker, never evaluated as JavaScript. */
export function parseLine(latex: string): ParsedLine | null {
  if (typeof latex !== "string") return null;
  const source = normalizeMath(latex);
  const sides = source.split("=");
  if (sides.length === 1) {
    const expression = parseExpression(source, true);
    return expression ? { kind: "expression", expression } : null;
  }
  if (sides.length !== 2 || sides.some((side) => !side.trim())) return null;
  const left = parseExpression(sides[0], true);
  const right = parseExpression(sides[1], true);
  return left && right ? { kind: "equation", left, right } : null;
}

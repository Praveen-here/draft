import {
  derivative as mathDerivative,
  parse as parseMath,
  type MathNode,
  type FunctionNode,
  type OperatorNode,
  type ParenthesisNode,
  type SymbolNode,
} from "mathjs/number";
import { expressionFromNode, type Expr } from "./parse";

function hasIntegral(node: MathNode): boolean {
  let found = false;
  node.traverse((part) => {
    if (part.type === "FunctionNode" && (part as FunctionNode).fn.name === "__integral") found = true;
  });
  return found;
}

function differentiateNode(node: MathNode, variable: string): MathNode {
  if (!hasIntegral(node)) return mathDerivative(node, variable, { simplify: false });
  if (node.type === "ParenthesisNode") return differentiateNode((node as ParenthesisNode).content, variable);
  if (node.type === "FunctionNode") {
    const call = node as FunctionNode;
    if (call.fn.name === "__integral" && (call.args[1] as SymbolNode).name === variable) {
      if (hasIntegral(call.args[0])) throw new Error("Nested integrals are not supported");
      return call.args[0].cloneDeep();
    }
  }
  if (node.type === "OperatorNode") {
    const operation = node as OperatorNode;
    if (operation.op === "+" || operation.op === "-") {
      const args = operation.args.map((arg) => "(" + differentiateNode(arg, variable).toString() + ")");
      return parseMath(args.length === 1 ? operation.op + args[0] : args.join(operation.op));
    }
    // A constant multiple of an indefinite integral is also safe to differentiate.
    if (operation.op === "*") {
      const index = operation.args.findIndex(hasIntegral);
      const constant = operation.args[1 - index];
      if (index >= 0 && !hasIntegral(constant) &&
          !expressionFromNode(constant).variables.includes(variable)) {
        return parseMath("(" + constant.toString() + ")*(" +
          differentiateNode(operation.args[index], variable).toString() + ")");
      }
    }
  }
  throw new Error("This integral transformation needs more context");
}

/** Symbolic differentiation, including the fundamental theorem for indefinite integral steps. */
export function differentiateExpression(expression: Expr, variable = "x"): Expr | null {
  if (!/^[a-zA-Z]$/.test(variable) || variable === "e") return null;
  try {
    return expressionFromNode(differentiateNode(expression.node, variable));
  } catch {
    return null;
  }
}

export function difference(left: Expr, right: Expr): Expr {
  return expressionFromNode(parseMath("(" + left.node.toString() + ")-(" + right.node.toString() + ")"));
}

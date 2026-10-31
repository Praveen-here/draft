/** A parsed expression that can be evaluated at given variable values. */
export type Expr = { evaluate(vars: Record<string, number>): number; variables: string[] };

/** LaTeX → evaluable expression, or null if it can't be parsed. */
export function parseLatex(latex: string): Expr | null {
  // TODO(D): @cortex-js/compute-engine or math.js.
  void latex;
  return null;
}

import type { StepCheck } from "@/lib/contracts";
import type { Expr } from "./parse";
import { domainPoints, domainSignature } from "./polynomial";

export const unsure = (detail: string): StepCheck => ({ ok: false, reason: "unsure", detail });
export const different = (detail = "These expressions do not give the same value."): StepCheck =>
  ({ ok: false, reason: "not-equivalent", detail });

export function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-10 + 64 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
}

function seededRandom(seedText: string): () => number {
  let state = 2166136261;
  for (const char of seedText) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Domain probes followed by ten reproducible pseudorandom, finite, real samples. */
export function compareExpressions(left: Expr, right: Expr, proportional = false): StepCheck {
  const variables = [...new Set([...left.variables, ...right.variables])].sort();
  const random = seededRandom(left.node.toString() + "|" + right.node.toString());
  const anchors = [0, 1, -1, 2, -2, 3, -3, 0.5, -0.5];
  const probes: Record<string, number>[] = anchors.map((value) =>
    Object.fromEntries(variables.map((name) => [name, value])));
  for (const variable of variables) {
    for (const point of [...domainPoints(left, variable), ...domainPoints(right, variable)]) {
      probes.push(Object.fromEntries(variables.map((name) => [name, name === variable ? point : 0.731])));
    }
  }
  let domainMismatch = domainSignature(left).join("|") !== domainSignature(right).join("|");
  let ratio: number | undefined;
  let valid = 0;
  const check = (scope: Record<string, number>): StepCheck | null => {
    const a = left.evaluate(scope), b = right.evaluate(scope);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      if (Number.isFinite(a) !== Number.isFinite(b)) domainMismatch = true;
      return null;
    }
    if (Math.abs(a) > 1e12 || Math.abs(b) > 1e12) return null;
    if (!proportional) {
      if (!close(a, b)) return different();
    } else {
      if (close(a, 0) || close(b, 0)) {
        if (close(a, 0) !== close(b, 0)) return different("This changes which values solve the equation.");
        return null;
      }
      const current = a / b;
      if (!Number.isFinite(current) || close(current, 0)) return unsure("The equation is too poorly conditioned to compare.");
      if (ratio === undefined) ratio = current;
      else if (!close(current, ratio)) return unsure("I cannot confirm that these equations have the same solutions.");
    }
    valid++;
    return null;
  };
  if (variables.length === 0) {
    const result = check({});
    return result ?? (valid ? { ok: true } : unsure("This expression has no finite real value."));
  }
  for (const scope of probes) {
    const result = check(scope);
    if (result) return result;
  }
  valid = 0;
  for (let attempt = 0; attempt < 80 && valid < 10; attempt++) {
    const scope = Object.fromEntries(variables.map((name) => [name, (random() * 2 - 1) * (attempt < 40 ? 5 : 25)]));
    const result = check(scope);
    if (result) return result;
  }
  if (valid < 10) return unsure("There were not enough valid real sample points to check this step.");
  if (domainMismatch) return unsure("The forms agree where defined, but their domains differ. Keep the excluded values in mind.");
  return { ok: true };
}

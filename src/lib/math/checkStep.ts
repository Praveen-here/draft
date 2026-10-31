import type { MathApi, StepCheck } from "@/lib/contracts";
import { compare, fmt, proportional, roots, type Mode } from "./sampling";
import { parseLatex, parseLine, splitTopLevel, type Expr, type Line } from "./lineParse";

/**
 * The math engine. The brain trusts this over Gemini.
 * It never "understands" math: it evaluates both sides at random points and compares numbers.
 * Integrals are evaluated numerically (∫ from 1 to x), so lines with ∫ are compared "up to a constant".
 */
export function createMathApi(): MathApi {
  return {
    checkStep: async (prev, next) => safely(() => checkStepSync(prev, next)),
    checkAnswer: async (problem, answer) => safely(() => checkAnswerSync(problem, answer)),
  };
}

/** A bug in the engine must never break the lesson: fall back to "unsure" (the tutor stays quiet). */
function safely(check: () => StepCheck): StepCheck {
  try {
    return check();
  } catch (err) {
    return UNSURE(err instanceof Error ? `engine error: ${err.message}` : "engine error");
  }
}

const OK: StepCheck = { ok: true };
const UNSURE = (detail?: string): StepCheck => ({ ok: false, reason: "unsure", detail });
const UNPARSEABLE: StepCheck = { ok: false, reason: "unparseable" };
const WRONG = (detail: string): StepCheck => ({ ok: false, reason: "not-equivalent", detail });

/* ───────────── What a line says ───────────── */

/**
 * expr:  a value ("x eˣ − ∫eˣ dx", "= x² + 16", or a chain "a = b = c" whose parts agree)
 * named: "y = (3x+1)²" (a new name for a value);  deriv: "dy/dx = 2(3x+1)"
 * eq:    an equation to solve ("2x + 3 = 14");  def: "u = x", "du = dx" (a side note, not a step)
 * bad:   the line contradicts itself ("∫2x dx = x³")
 */
type Analysis =
  | { kind: "expr" | "named" | "deriv"; value: Expr; line: Line; part: number; sym?: string; v?: string; rhsRaw?: string }
  | { kind: "eq"; f: Expr; lhs: Expr; rhs: Expr; line: Line }
  | { kind: "def" }
  | { kind: "bad"; detail: string };

const LONE = /^([a-zA-Z])(\s*\(\s*[a-zA-Z]\s*\))?$/;
const DERIV = [
  /^d\s*([a-zA-Z])\s*\/\s*d\s*([a-zA-Z])$/,
  /^\\frac\s*\{\s*d\s*([a-zA-Z])\s*\}\s*\{\s*d\s*([a-zA-Z])\s*\}$/,
  /^([a-zA-Z])\s*['′](?:\s*\(\s*([a-zA-Z])\s*\))?$/,
];
const DIFFERENTIAL = /^d\s*[a-zA-Z]$/;

/** @param context variables of the previous line: "x = 2" after "2x = 4" is an equation, "u = x" after "∫x eˣ dx" is a definition. */
function analyze(raw: string, context: string[] = []): Analysis | null {
  const rawParts = splitTopLevel(raw.trim(), "=").map((p) => p.trim());
  const continuation = rawParts.length > 1 && rawParts[0] === "";
  const lhs = rawParts[0];

  if (!continuation && rawParts.length >= 2) {
    if (DIFFERENTIAL.test(lhs)) return { kind: "def" };
    const d = DERIV.map((re) => re.exec(lhs)).find(Boolean);
    const lone = LONE.exec(lhs);
    if (d || lone) {
      const rhsRaw = rawParts.slice(1).join("=");
      const rest = parseLine(rhsRaw);
      if (!rest) return null;
      const sym = d ? d[1] : lone![1];
      const inRhs = rest.parts.some((p) => p.variables.includes(sym));
      if (d) return chain(rest, (value, part) => ({ kind: "deriv", value, line: rest, part, sym, v: d[2] ?? "x", rhsRaw }));
      if (!inRhs && !context.includes(sym)) {
        return chain(rest, (value, part) => ({ kind: "named", value, line: rest, part, sym, rhsRaw }));
      }
    }
  }

  const line = parseLine(raw);
  if (!line) return null;
  if (line.parts.length === 2 && !line.continuation && !line.numeric) {
    const [lhsE, rhsE] = line.parts;
    if (sameValue(lhsE, rhsE, line, line).same) return { kind: "expr", value: rhsE, line, part: 1 };
    return { kind: "eq", lhs: lhsE, rhs: rhsE, line, f: diff(lhsE, rhsE) };
  }
  return chain(line, (value, part) => ({ kind: "expr", value, line, part }));
}

/** Every "=" inside a line must hold; the line's value is its last part. */
function chain(line: Line, make: (value: Expr, part: number) => Analysis): Analysis {
  for (let i = 0; i + 1 < line.parts.length; i++) {
    const v = sameValue(line.parts[i], line.parts[i + 1], line, line);
    if (!v.same && !v.unsure) return { kind: "bad", detail: `Inside this line, the two sides of "=" aren't equal${where(v, mainVar(line, line))}.` };
  }
  return make(line.parts[line.parts.length - 1], line.parts.length - 1);
}

function diff(a: Expr, b: Expr): Expr {
  return { evaluate: (v) => a.evaluate(v) - b.evaluate(v), variables: [...new Set([...a.variables, ...b.variables])] };
}

function mainVar(a: Line, b: Line): string {
  const v = a.integralVar ?? b.integralVar;
  if (v) return v;
  const all = [...a.parts, ...b.parts].flatMap((p) => p.variables);
  return all.includes("x") ? "x" : (all[0] ?? "x");
}

function sameValue(a: Expr, b: Expr, la: Line, lb: Line, force?: Mode) {
  const mode: Mode = force ?? (la.hasIndefinite || lb.hasIndefinite ? "constant" : "exact");
  return compare(a, b, {
    mode,
    main: mainVar(la, lb),
    positive: la.hasIndefinite || lb.hasIndefinite,
    tol: la.numeric || lb.numeric ? 1e-5 : 1e-7,
  });
}

function where(v: ReturnType<typeof compare>, main: string): string {
  if (v.same || v.unsure) return "";
  return ` (at ${main} = ${fmt(v.at[main] ?? 0)} one side is ${fmt(v.a)}, the other ${fmt(v.b)})`;
}

/* ───────────── checkStep ───────────── */

export function checkStepSync(prevRaw: string, nextRaw: string): StepCheck {
  const P = analyze(prevRaw);
  if (!P) return UNPARSEABLE;
  const context = P.kind === "expr" || P.kind === "named" || P.kind === "deriv" ? P.value.variables : P.kind === "eq" ? P.f.variables : [];
  const N = analyze(nextRaw, context);
  if (!N) return UNPARSEABLE;
  if (N.kind === "bad") return WRONG(N.detail);
  if (N.kind === "def") return UNSURE("This line looks like a side note (like du = dx), not a step.");
  if (P.kind === "def" || P.kind === "bad") return UNSURE("The line before isn't a step I can compare with.");

  // dy/dx = … after y = …: compare with the derivative of the line before.
  if (N.kind === "deriv") {
    if (P.kind === "deriv" && P.sym === N.sym) return valueStep(P, N);
    if (P.kind !== "named" || P.sym !== N.sym) return UNSURE();
    const target = parseLine(`\\frac{d}{d${N.v}}(${P.rhsRaw})`);
    if (!target) return UNPARSEABLE;
    const v = sameValue(target.parts[0], N.value, target, N.line, "exact");
    if (v.same) return OK;
    if (v.unsure) return UNSURE();
    return WRONG(`That isn't the derivative of ${N.sym}${where(v, N.v ?? "x")}.`);
  }

  if (N.kind === "named") {
    if (P.kind === "named" && P.sym === N.sym) return valueStep(P, N);
    return UNSURE(`This line names something new (${N.sym} = …), so it isn't a step from the line before.`);
  }

  if (N.kind === "eq") {
    if (P.kind !== "eq") return UNSURE();
    return equationStep(P, N);
  }

  // N is a plain value (possibly "= …")
  if (P.kind === "eq") return UNSURE();
  return valueStep(P, N);
}

type ValueA = Extract<Analysis, { value: Expr }>;

function valueStep(P: ValueA, N: ValueA): StepCheck {
  const v = sameValue(P.value, N.value, P.line, N.line);
  if (!v.same && v.unsure) return UNSURE("Too few points where both lines are defined.");
  if (!v.same) return WRONG(`The new line isn't equal to the one before${where(v, mainVar(P.line, N.line))}.`);
  if (missingConstant(P, N)) return WRONG("Right antiderivative, but the constant of integration (+ C) is missing.");
  return OK;
}

/** The last ∫ just disappeared, and no new letter (C, c, K…) was added for the constant. */
function missingConstant(P: ValueA, N: ValueA): boolean {
  const before = P.line.hasIndefinite;
  const stillIntegral = N.line.partIndefinite[N.part];
  if (!before || stillIntegral) return false;
  const newLetters = N.value.variables.filter((v) => !P.value.variables.includes(v));
  return newLetters.length === 0;
}

function equationStep(P: Extract<Analysis, { kind: "eq" }>, N: Extract<Analysis, { kind: "eq" }>): StepCheck {
  const main = mainVar(P.line, N.line);
  const prop = proportional(P.f, N.f, main);
  if (prop === true) return OK;

  // Not a simple multiple (e.g. both sides multiplied by x + 1): compare the solutions instead.
  const vars = [...new Set([...P.f.variables, ...N.f.variables])].filter((v) => v !== main);
  const fixed = Object.fromEntries(vars.map((v, i) => [v, 1.37 + 0.31 * i]));
  const r1 = roots(P.f, main, fixed), r2 = roots(N.f, main, fixed);
  if (!r1.length && !r2.length) return UNSURE("Couldn't find solutions to compare.");
  const same = r1.length === r2.length && r1.every((r, i) => Math.abs(r - r2[i]) < 1e-6);
  if (same) return OK;
  const list = (rs: number[]) => (rs.length ? rs.map((r) => `${main} = ${fmt(r)}`).join(" or ") : "no solution");
  return WRONG(`The equations don't have the same solutions: before, ${list(r1)}; after, ${list(r2)}.`);
}

/* ───────────── checkAnswer ───────────── */

type Problem = { type: "integral" | "derivative" | "equation" | "expression"; latex: string; v: string };

/** Turn "Q6. Find the integral of x·eˣ dx." into something the engine can check. */
export function normalizeProblem(text: string): Problem {
  let t = text.trim()
    .replace(/^\s*(q(uestion)?\s*)?\d+[a-z]?\s*[.):]\s*/i, "")
    .replace(/^\s*\([a-z]\)\s*/i, "")
    .replace(/\s*=\s*\?\s*$/, "")
    .replace(/[.?]\s*$/, "");
  let v = "x";
  const wrt = /\s*(with respect to|w\.?\s*r\.?\s*t\.?)\s*([a-zA-Z])\s*$/i.exec(t);
  if (wrt) { v = wrt[2]; t = t.slice(0, wrt.index); }

  let verb = "";
  const m = /^(find|evaluate|compute|calculate|work out|simplify|solve|differentiate|integrate|expand|factori[sz]e|factor)\b\s*:?\s*/i.exec(t);
  if (m) { verb = m[1].toLowerCase(); t = t.slice(m[0].length); }
  const intOf = /^(the\s+)?(integral|antiderivative)\s+of\s+/i.exec(t);
  const derOf = /^(the\s+)?derivative\s+of\s+/i.exec(t);
  if (intOf) { verb = "integrate"; t = t.slice(intOf[0].length); }
  if (derOf) { verb = "differentiate"; t = t.slice(derOf[0].length); }

  if (/∫|\\int\b/.test(t)) return { type: "integral", latex: t, v };
  if (/\\frac\s*\{\s*d\s*\}|(^|[^a-zA-Z])d\s*\/\s*d[a-zA-Z]/.test(t)) return { type: "derivative", latex: t, v };
  if (verb === "integrate") return { type: "integral", latex: /d[a-zA-Z]\s*$/.test(t) ? `\\int ${t}` : `\\int (${t}) d${v}`, v };
  if (verb === "differentiate") {
    const parts = splitTopLevel(t, "=");
    const f = parts.length === 2 && LONE.test(parts[0].trim()) ? parts[1] : t;
    return { type: "derivative", latex: `\\frac{d}{d${v}}(${f})`, v };
  }
  if (splitTopLevel(t, "=").length === 2) return { type: "equation", latex: t, v };
  return { type: "expression", latex: t, v };
}

export function checkAnswerSync(problemText: string, answerRaw: string): StepCheck {
  const problem = normalizeProblem(problemText);
  if (problem.type === "equation") return checkSolutions(problem, answerRaw);

  const P = parseLine(problem.latex);
  const A = analyze(answerRaw, P?.parts[0]?.variables ?? []);
  if (!P || !A) return UNPARSEABLE;
  if (A.kind === "bad") return WRONG(A.detail);
  if (A.kind !== "expr" && A.kind !== "named" && A.kind !== "deriv") return UNSURE();

  const v = sameValue(P.parts[0], A.value, P, A.line);
  if (!v.same && v.unsure) return UNSURE("Too few points where both are defined.");
  if (!v.same) return WRONG(`That isn't equal to what the question asks for${where(v, mainVar(P, A.line))}.`);
  const asLine: ValueA = { kind: "expr", value: P.parts[0], line: P, part: 0 };
  if (missingConstant(asLine, A)) return WRONG("Right antiderivative, but the constant of integration (+ C) is missing.");
  return OK;
}

/** "x = 2 or x = 3", "x = 2, 3", "x = ±2" → check each solves the equation, and none is missing. */
function checkSolutions(problem: Problem, answerRaw: string): StepCheck {
  const eq = analyze(problem.latex);
  if (!eq) return UNPARSEABLE;
  if (eq.kind !== "eq") return UNSURE();
  const main = mainVar(eq.line, eq.line);
  if (eq.f.variables.some((v) => v !== main)) return UNSURE("The equation has more than one letter.");

  const pieces = answerRaw
    .split(/\bor\b|,|;|\band\b/)
    .flatMap((p) => (/\\pm|±/.test(p) ? [p.replace(/\\pm|±/, "+"), p.replace(/\\pm|±/, "-")] : [p]))
    .map((p) => p.replace(/^\s*[a-zA-Z]\s*=/, "").trim())
    .filter(Boolean);
  if (!pieces.length) return UNPARSEABLE;

  const given: number[] = [];
  for (const piece of pieces) {
    const e = parseLatex(piece);
    if (!e) return UNPARSEABLE;
    if (e.variables.length) return UNSURE("The answer still has a letter in it.");
    const r = e.evaluate({});
    const l = eq.lhs.evaluate({ [main]: r }), rr = eq.rhs.evaluate({ [main]: r });
    if (!Number.isFinite(l) || !Number.isFinite(rr) || Math.abs(l - rr) > 1e-6 * Math.max(1, Math.abs(l), Math.abs(rr))) {
      return WRONG(`${main} = ${fmt(r)} doesn't satisfy the equation (the two sides give ${fmt(l)} and ${fmt(rr)}).`);
    }
    given.push(r);
  }
  const missing = roots(eq.f, main).filter((r) => !given.some((g) => Math.abs(g - r) < 1e-6));
  if (missing.length) return WRONG(`Correct so far, but there ${missing.length === 1 ? "is 1 more solution" : `are ${missing.length} more solutions`}.`);
  return OK;
}

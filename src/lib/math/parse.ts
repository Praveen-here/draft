import { parse, type EvalFunction, type MathNode } from "mathjs";

/** A parsed expression that can be evaluated at given variable values. */
export type Expr = { evaluate(vars: Record<string, number>): number; variables: string[] };

/** One written line, split on top-level "=" (e.g. "∫x eˣ dx = x eˣ − ∫eˣ dx" has two parts). */
export type Line = {
  parts: Expr[];
  /** Per part: does it still contain an indefinite integral? (A final answer without one needs + C.) */
  partIndefinite: boolean[];
  /** The line starts with "=", so it continues the previous line. */
  continuation: boolean;
  /** Contains an indefinite ∫ … dx (compare such lines "up to a constant"). */
  hasIndefinite: boolean;
  /** Contains any numeric placeholder (∫ or d/dx), so values carry small numeric error. */
  numeric: boolean;
  /** The variable of the first indefinite integral, if any. */
  integralVar?: string;
};

/** Where every indefinite ∫ f dx starts: we evaluate it as ∫ from BASE to x. Same on both lines, so differences are constant. */
const BASE = 1;

/** LaTeX, plain text or unicode math → evaluable expression, or null if it can't be parsed. */
export function parseLatex(latex: string): Expr | null {
  const line = parseLine(latex);
  return line && line.parts.length === 1 && !line.continuation ? line.parts[0] : null;
}

/** Parse a whole line (may contain "="). Null if any part can't be parsed. */
export function parseLine(latex: string): Line | null {
  try {
    const subs: Sub[] = [];
    const clean = latexToPlain(latex);
    if (clean === null) return null;
    const built = build(clean, subs);
    const pieces = splitTopLevel(built, "=");
    const continuation = pieces.length > 1 && pieces[0].trim() === "";
    const exprs = continuation ? pieces.slice(1) : pieces;
    if (exprs.some((p) => p.trim() === "")) return null;

    const compiled: CompiledSub[] = subs.map((s) => ({ ...s, body: compile(s.body), lo: s.lo ? compile(s.lo) : undefined, hi: s.hi ? compile(s.hi) : undefined }));
    const subVars = compiled.flatMap((s) => [s.body, s.lo, s.hi].filter((c): c is Compiled => !!c).flatMap((c) => c.vars));
    const parts = exprs.map((p) => toExpr(compile(p), compiled, subVars));
    const indefinite = subs.find((s) => s.kind === "int" && !s.lo);
    return {
      parts,
      partIndefinite: exprs.map((p) => /__int\d+\(\s*[a-zA-Z]/.test(p)),
      continuation,
      hasIndefinite: !!indefinite,
      numeric: subs.length > 0,
      integralVar: indefinite?.v,
    };
  } catch {
    return null;
  }
}

/* ───────────── Evaluation ───────────── */

type Sub = { name: string; kind: "int" | "dif"; v: string; body: string; lo?: string; hi?: string };
type Compiled = { code: EvalFunction; vars: string[] };
type CompiledSub = Omit<Sub, "body" | "lo" | "hi"> & { body: Compiled; lo?: Compiled; hi?: Compiled };

const CONSTANTS = new Set(["e", "pi", "E", "PI", "Infinity"]);

function compile(src: string): Compiled {
  const node = parse(src);
  return { code: node.compile(), vars: symbolsOf(node) };
}

function symbolsOf(node: MathNode): string[] {
  const out = new Set<string>();
  node.traverse((n, path, parent) => {
    if (n.type !== "SymbolNode") return;
    if (parent?.type === "FunctionNode" && path === "fn") return;
    const name = (n as unknown as { name: string }).name;
    if (!CONSTANTS.has(name) && !name.startsWith("__")) out.add(name);
  });
  return [...out];
}

function toExpr(c: Compiled, subs: CompiledSub[], subVars: string[]): Expr {
  return {
    evaluate: (vars) => run(c, makeScope(vars, subs)),
    variables: [...new Set([...c.vars, ...subVars])],
  };
}

function makeScope(vars: Record<string, number>, subs: CompiledSub[]): Record<string, unknown> {
  const scope: Record<string, unknown> = { ...vars };
  for (const s of subs) {
    const f = (t: number) => run(s.body, makeScope({ ...vars, [s.v]: t }, subs));
    if (s.kind === "dif") {
      scope[s.name] = (x: number) => {
        const h = 1e-4 * Math.max(1, Math.abs(x));
        return (f(x + h) - f(x - h)) / (2 * h);
      };
    } else if (s.lo && s.hi) {
      const lo = s.lo, hi = s.hi;
      scope[s.name] = () => simpson(f, run(lo, makeScope(vars, subs)), run(hi, makeScope(vars, subs)));
    } else {
      scope[s.name] = (x: number) => simpson(f, BASE, x);
    }
  }
  return scope;
}

function simpson(f: (t: number) => number, a: number, b: number, n = 200): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  if (a === b) return 0;
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * f(a + i * h);
  return (sum * h) / 3;
}

/** Evaluate, turning any mathjs error (wrong arguments, unknown symbol) into NaN: the engine never throws. */
function run(c: Compiled, scope: Record<string, unknown>): number {
  try {
    return num(c.code.evaluate(scope));
  } catch {
    return NaN;
  }
}

/** Only real, finite numbers count; complex results (sqrt of a negative) become NaN. */
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : NaN;
}

/* ───────────── LaTeX / unicode → plain math ───────────── */

const INT = "\u0001"; // marks an integral sign
const DIF = "\u0002"; // marks d/d<var>, followed by the variable letter

const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁺": "+", "⁻": "-", "ˣ": "x", "ʸ": "y", "ⁿ": "n", "ᵗ": "t",
};

const COMMANDS: Record<string, string> = {
  cdot: "*", times: "*", div: "/", pi: " pi ", infty: " Infinity ",
  sin: " sin ", cos: " cos ", tan: " tan ", sec: " sec ", csc: " csc ", cot: " cot ",
  arcsin: " asin ", arccos: " acos ", arctan: " atan ", sinh: " sinh ", cosh: " cosh ", tanh: " tanh ",
  ln: " log ", log: " log ", exp: " exp ",
};

/** Returns plain math with INT/DIF markers and only round brackets, or null on unknown LaTeX. */
function latexToPlain(input: string): string | null {
  let s = input
    .replace(/[−–—]/g, "-")
    .replace(/[×⋅·∙]/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, " pi ")
    .replace(/∞/g, " Infinity ")
    .replace(/√/g, "\\sqrt")
    .replace(/∫/g, "\\int ")
    .replace(/[′’]/g, "'")
    .replace(/\*\*/g, "^");
  // Runs of superscripts: x² → x^(2), eˣ → e^(x)
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ˣʸⁿᵗ]+/g, (m) => `^(${[...m].map((c) => SUPERSCRIPTS[c]).join("")})`);

  s = s
    .replace(/\\left\s*\|/g, " abs(")
    .replace(/\\right\s*\|/g, ")")
    .replace(/\\(left|right|big|Big|bigg|Bigg)\b/g, "")
    .replace(/\\displaystyle/g, "")
    .replace(/\\[,;:! ]|\\quad|\\qquad/g, " ")
    .replace(/\\mathrm\{d\}/g, "d")
    .replace(/\\(text|mathrm|operatorname)\{([^}]*)\}/g, " $2 ")
    .replace(/\\[dt]frac/g, "\\frac")
    .replace(/\\frac\s*\{\s*d\s*\}\s*\{\s*d\s*([a-zA-Z])\s*\}/g, (_, v) => ` ${DIF}${v} `)
    .replace(/(^|[^a-zA-Z\\])d\s*\/\s*d([a-zA-Z])(?![a-zA-Z])/g, (_, pre, v) => `${pre} ${DIF}${v} `)
    .replace(/\\int(?![a-zA-Z])/g, ` ${INT} `);

  s = replaceFracs(s);
  s = replaceSqrts(s);
  s = s.replace(/\\([a-zA-Z]+)/g, (m, name: string) => (name in COMMANDS ? COMMANDS[name] : m));
  if (/\\/.test(s)) return null; // LaTeX we don't understand
  s = s.replace(/[{[]/g, "(").replace(/[}\]]/g, ")");
  s = barsToAbs(s);
  // Words ("the slope of the curve") are not math: don't read them as letters multiplied together.
  if (/[a-zA-Z]{3,}/.test(NAMES.reduce((t, n) => t.split(n).join(" "), s))) return null;
  return s;
}

/** Read a {…} group starting at s[i] === "{"; returns [inner, indexAfter]. */
function readBraces(s: string, i: number): [string, number] | null {
  if (s[i] !== "{") return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}" && --depth === 0) return [s.slice(i + 1, j), j + 1];
  }
  return null;
}

function skipSpaces(s: string, i: number): number {
  while (s[i] === " ") i++;
  return i;
}

/** \frac{a}{b} → ((a)/(b)); also \frac12 → ((1)/(2)). Innermost-first by repeating. */
function replaceFracs(s: string): string {
  for (let guard = 0; guard < 50; guard++) {
    const at = s.lastIndexOf("\\frac");
    if (at < 0) return s;
    let i = skipSpaces(s, at + 5);
    const arg = (): string | null => {
      i = skipSpaces(s, i);
      const g = readBraces(s, i);
      if (g) { i = g[1]; return g[0]; }
      if (i < s.length) return s[i++];
      return null;
    };
    const a = arg();
    const b = arg();
    if (a === null || b === null) return s;
    s = `${s.slice(0, at)}((${a})/(${b}))${s.slice(i)}`;
  }
  return s;
}

/** \sqrt{a} → sqrt((a)), \sqrt[n]{a} → nthRoot((a),(n)), \sqrt x → sqrt(x). */
function replaceSqrts(s: string): string {
  for (let guard = 0; guard < 50; guard++) {
    const at = s.lastIndexOf("\\sqrt");
    if (at < 0) return s;
    let i = skipSpaces(s, at + 5);
    let n: string | null = null;
    if (s[i] === "[") {
      const close = s.indexOf("]", i);
      if (close < 0) return s;
      n = s.slice(i + 1, close);
      i = skipSpaces(s, close + 1);
    }
    let body: string;
    const g = readBraces(s, i);
    if (g) [body, i] = g;
    else {
      const m = /^[0-9.]+|^[a-zA-Z]/.exec(s.slice(i));
      if (!m) return s;
      body = m[0];
      i += m[0].length;
    }
    s = `${s.slice(0, at)}${n ? `nthRoot((${body}),(${n}))` : `sqrt((${body}))`}${s.slice(i)}`;
  }
  return s;
}

/** |x| → abs(x), pairing bars left to right. */
function barsToAbs(s: string): string {
  let open = false;
  return s.replace(/\|/g, () => ((open = !open) ? " abs(" : ")"));
}

/* ───────────── Integrals, d/dx, implicit multiplication ───────────── */

/** Turn markers into placeholder calls (__int0(x), __dif0(x)) and tokenize the rest for mathjs. */
function build(s: string, subs: Sub[]): string {
  const at = s.search(new RegExp(`[${INT}${DIF}]`));
  if (at < 0) return tokenize(s);
  const before = tokenize(s.slice(0, at));
  let i = at + 1;

  if (s[at] === DIF) {
    const v = s[i++];
    i = skipSpaces(s, i);
    let body: string;
    if (s[i] === "(") {
      const close = matchParen(s, i);
      if (close < 0) throw new Error("unbalanced");
      body = s.slice(i + 1, close);
      i = close + 1;
    } else {
      const end = topLevelEnd(s, i, /[+\-=]/);
      body = s.slice(i, end);
      i = end;
    }
    const name = `__dif${subs.length}`;
    subs.push({ name, kind: "dif", v, body: "" });
    subs[subs.length - 1].body = build(body, subs);
    return `${before} ${name}(${v}) ${build(s.slice(i), subs)}`;
  }

  // ∫ with optional bounds _a ^b
  let lo: string | undefined, hi: string | undefined;
  const bound = (): string => {
    i = skipSpaces(s, i);
    if (s[i] === "(") {
      const close = matchParen(s, i);
      const b = s.slice(i + 1, close);
      i = close + 1;
      return b;
    }
    const m = /^-?[0-9.]+|^[a-zA-Z]+/.exec(s.slice(i));
    if (!m) throw new Error("bad bound");
    i += m[0].length;
    return m[0];
  };
  i = skipSpaces(s, i);
  if (s[i] === "_") { i++; lo = bound(); i = skipSpaces(s, i); }
  if (s[i] === "^") { i++; hi = bound(); }
  if ((lo === undefined) !== (hi === undefined)) throw new Error("one bound");

  // Integrand runs to the first top-level d<var> (dx, dt…), else to the end of the line.
  let depth = 0, end = s.length, v = "x", after = s.length;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && c === "=") { end = after = j; break; }
    else if (depth === 0 && c === "d" && /[a-zA-Z]/.test(s[j + 1] ?? "") && !/[a-zA-Z(]/.test(s[j + 2] ?? "")) {
      end = j; v = s[j + 1]; after = j + 2; break;
    }
  }
  const integrand = s.slice(i, end).trim() || "1";
  const name = `__int${subs.length}`;
  subs.push({ name, kind: "int", v, body: "" });
  const sub = subs[subs.length - 1];
  sub.body = build(integrand, subs);
  if (lo !== undefined && hi !== undefined) {
    sub.lo = build(lo, subs);
    sub.hi = build(hi, subs);
    return `${before} ${name}() ${build(s.slice(after), subs)}`;
  }
  return `${before} ${name}(${v}) ${build(s.slice(after), subs)}`;
}

function matchParen(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "(") depth++;
    else if (s[j] === ")" && --depth === 0) return j;
  }
  return -1;
}

/** Index of the first top-level char matching `stop` after position i (skipping a leading sign). */
function topLevelEnd(s: string, i: number, stop: RegExp): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "(") depth++;
    else if (s[j] === ")") depth--;
    else if (depth === 0 && j > i && stop.test(s[j]) && s[j - 1] !== "^") return j;
  }
  return s.length;
}

const FUNCTIONS = ["asin", "acos", "atan", "sinh", "cosh", "tanh", "sqrt", "nthRoot", "abs", "exp", "log", "sin", "cos", "tan", "sec", "csc", "cot"];
const NAMES = [...FUNCTIONS, "Infinity", "pi"].sort((a, b) => b.length - a.length);

/**
 * Prepare plain math for mathjs: split letter runs into single variables ("xe" → x e) unless they are
 * known names, add "*" before "(" after a variable ("x(x+1)"), and wrap bare function arguments
 * ("sin x" → sin(x), "sin^2 x" → sin(x)^2).
 */
function tokenize(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const ph = /^__(int|dif)\d+/.exec(s.slice(i));
    if (ph) { out += ph[0]; i += ph[0].length; continue; }
    if (!/[a-zA-Z]/.test(c)) {
      if (c === "(" && /\)\s*$/.test(out)) out += "*";
      out += c;
      i++;
      continue;
    }
    const name = NAMES.find((n) => s.startsWith(n, i));
    if (name && FUNCTIONS.includes(name)) {
      i += name.length;
      const [call, next] = functionCall(name, s, i);
      out += ` ${call} `;
      i = next;
      continue;
    }
    if (name) { out += ` ${name} `; i += name.length; continue; }
    out += ` ${c} `;
    i++;
    if (s[skipSpaces(s, i)] === "(") out += "*";
  }
  return out;
}

/** Read a function's power and argument after its name; returns [mathjs text, index after]. */
function functionCall(name: string, s: string, i: number): [string, number] {
  i = skipSpaces(s, i);
  let power = "";
  if (s[i] === "^") {
    i = skipSpaces(s, i + 1);
    if (s[i] === "(") {
      const close = matchParen(s, i);
      power = s.slice(i, close + 1);
      i = close + 1;
    } else {
      const m = /^-?[0-9.]+|^[a-zA-Z]/.exec(s.slice(i));
      if (m) { power = m[0]; i += m[0].length; }
    }
    i = skipSpaces(s, i);
  }
  let arg: string;
  if (s[i] === "(") {
    const close = matchParen(s, i);
    if (close < 0) throw new Error("unbalanced");
    arg = s.slice(i + 1, close);
    i = close + 1;
  } else if (FUNCTIONS.some((f) => s.startsWith(f, i))) {
    // a function as the argument: "ln |x|" → log(abs(x)), "sin cos x"
    const inner = FUNCTIONS.filter((f) => s.startsWith(f, i)).sort((a, b) => b.length - a.length)[0];
    const [call, next] = functionCall(inner, s, i + inner.length);
    i = next;
    const outer = `${name}(${call})`;
    return [power ? `(${outer})^${tokenize(power)}` : outer, i];
  } else {
    // bare argument: a number and/or letters, with an optional ^power ("sin 2x", "log x^2")
    const m = /^[0-9.]*[a-zA-Z]*(\s*\^\s*(\([^()]*\)|-?[0-9.]+|[a-zA-Z]))?/.exec(s.slice(i));
    arg = m?.[0] ?? "";
    i += arg.length;
  }
  if (name === "nthRoot") return [`nthRoot(${tokenize(arg)})`, i];
  const call = `${name}(${tokenize(arg)})`;
  return [power ? `(${call})^${tokenize(power)}` : call, i];
}

/** Split on a top-level character (outside brackets). */
export function splitTopLevel(s: string, ch: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let j = 0; j < s.length; j++) {
    if (s[j] === "(" || s[j] === "{") depth++;
    else if (s[j] === ")" || s[j] === "}") depth--;
    else if (depth === 0 && s[j] === ch) { out.push(s.slice(start, j)); start = j + 1; }
  }
  out.push(s.slice(start));
  return out;
}

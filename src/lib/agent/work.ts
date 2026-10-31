import type { BBox, MathApi, StepCheck } from "@/lib/contracts";
import { normalizeProblem } from "@/lib/math";

/** One line the student wrote for the current problem, with what the math engine said about it. */
export type WorkLine = { latex: string; bbox: BBox | null; check: StepCheck; final: boolean };

/** What the engine made of a line: a correct step, the correct final answer, a wrong step, or "can't tell". */
export type LineVerdict = "ok" | "solved" | "wrong" | "unclear";

/**
 * The student's working on the circled problem, checked line by line by the math engine (D28/D29).
 * The brain trusts this over Gemini: a tick, a flag and "solved" all come from here.
 */
export function createWork(math: MathApi) {
  let problem = "";
  let lines: WorkLine[] = [];
  /** Lines already checked (same text in the same place), so a re-read doesn't check twice. */
  let seen = new Set<string>();

  const kind = () => (problem ? safeNormalize(problem)?.type ?? null : null);

  /** The math the first line should follow from: the question without its words ("6. Find …"). */
  const start = () => safeNormalize(problem)?.latex ?? problem;

  /** Is this line a finished answer (nothing left to integrate or differentiate, an equation solved)? */
  const finished = (latex: string) => {
    const k = kind();
    if (/∫|\\int\b|\\frac\s*\{\s*d\s*\}|d\s*\/\s*d[a-z]/i.test(latex)) return false;
    // Equations: the answer check itself insists on the solved form ("x = 4", "x = 2 or x = 3").
    if (k === "integral" || k === "derivative" || k === "equation") return true;
    return false; // "simplify …": every equal form passes, so the engine can't tell when it's finished
  };

  return {
    /** A new problem: its printed text (or the first line of handwriting the student circled). */
    setProblem(text: string) {
      problem = text.trim();
      lines = [];
      seen = new Set();
    },
    get problem() {
      return problem;
    },
    get lines() {
      return lines;
    },
    /** True when the engine can check answers to this problem (integrals, derivatives, equations). */
    checkable: () => kind() === "integral" || kind() === "derivative" || kind() === "equation",

    /**
     * Check a new handwritten line against the last line that wasn't wrong (or the question itself).
     * Returns null for a line already checked.
     */
    async addLine(latex: string, bbox: BBox | null): Promise<{ line: WorkLine; verdict: LineVerdict } | null> {
      const text = latex.trim();
      const key = `${text}@${bbox ? `${Math.round(bbox.x / 20)},${Math.round(bbox.y / 20)}` : ""}`;
      if (!text || !problem || seen.has(key)) return null;
      seen.add(key);
      const prev = [...lines].reverse().find((l) => l.check.ok || l.check.reason !== "not-equivalent");
      let check = await math.checkStep(prev ? prev.latex : start(), text);
      // The first line against a worded question: the answer check knows how to read "Find the integral of …".
      if (!prev && !check.ok && check.reason !== "not-equivalent") check = await math.checkAnswer(problem, text);
      const final = check.ok && finished(text) && (await math.checkAnswer(problem, text)).ok;
      const line: WorkLine = { latex: text, bbox, check, final };
      lines = [...lines, line].slice(-12);
      const verdict: LineVerdict = final ? "solved" : check.ok ? "ok" : check.reason === "not-equivalent" ? "wrong" : "unclear";
      return { line, verdict };
    },

    /**
     * A typed or spoken answer that looks like math ("x e^x - e^x + C"), judged as an answer to the problem.
     * Null when it isn't math or the engine can't read it (then Gemini judges alone).
     */
    async judgeAnswer(said: string): Promise<{ check: StepCheck; final: boolean } | null> {
      if (!this.checkable() || !looksLikeMath(said)) return null;
      const check = await math.checkAnswer(problem, said);
      if (!check.ok && check.reason !== "not-equivalent") return null;
      return { check, final: check.ok && finished(said) };
    },

    /** The working so far, for the prompt: one line each, with the engine's verdict. */
    describe(): string[] {
      return lines.map((l) =>
        `${l.latex}  [engine: ${l.final ? "correct final answer" : l.check.ok ? "valid step" : l.check.reason === "not-equivalent" ? `WRONG: ${l.check.detail ?? "does not follow"}` : "can't check"}]`);
    },
  };
}

export type Work = ReturnType<typeof createWork>;

function safeNormalize(text: string) {
  try {
    return normalizeProblem(text);
  } catch {
    return null;
  }
}

const MATH_WORDS = new Set(["sin", "cos", "tan", "sec", "csc", "cot", "ln", "log", "exp", "sqrt", "int", "dx", "dy", "frac", "pi"]);

/** "x e^x - e^x + C" or "x = 4" yes; "it gets narrower" or "is it x squared?" no. */
export function looksLikeMath(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 120 || !/[a-z]/i.test(t) && !/\d/.test(t)) return false;
  if (!/[=+\-*/^²³∫√]|\\[a-z]+/i.test(t)) return false;
  const words = t.match(/[a-z]{3,}/gi) ?? [];
  return words.filter((w) => !MATH_WORDS.has(w.toLowerCase())).length === 0;
}

import type { MathApi, StepCheck } from "@/lib/contracts";
import { parseLatex } from "./parse";

/** The math engine. The brain trusts this over Gemini. */
export function createMathApi(): MathApi {
  return {
    async checkStep(prevLatex, nextLatex): Promise<StepCheck> {
      const prev = parseLatex(prevLatex);
      const next = parseLatex(nextLatex);
      if (!prev || !next) return { ok: false, reason: "unparseable" };
      // TODO(D): evaluate both at 5–10 random points and compare within a tolerance.
      return { ok: false, reason: "unsure" };
    },
    async checkAnswer(problemLatex, answerLatex): Promise<StepCheck> {
      // TODO(D): integrals → differentiate the answer and compare to the integrand.
      void problemLatex;
      void answerLatex;
      return { ok: false, reason: "unsure" };
    },
  };
}

# Part D: Math engine and visuals

**Branch:** `part-d/math-visuals` · **Spec:** [AGENT_BRAIN.md](../../../docs/AGENT_BRAIN.md) · **Rules:** [WORKING_RULES.md](../../../docs/WORKING_RULES.md)

Part D provides real math checks and teaching visuals. It can run independently of the other parts in the [Math studio preview](../../components/visuals/preview) (run `npm run part-d:preview`, then open http://127.0.0.1:4173).

## Status

- [x] LaTeX and plain-expression parsing: fractions, powers, exponentials, trig, roots, logs, and derivative notation.
- [x] Step checking with domain probes and ten reproducible pseudorandom real samples.
- [x] Linear/quadratic equation solution-set checks, including lost roots.
- [x] Indefinite integral answers and integration-by-parts steps, checked by differentiation. Additive constants are ignored by differentiation.
- [x] Mafs graphs and interruptible parameter animation, with reduced-motion support.
- [x] Tangent, area, number-line, and value-table visuals.
- [x] KaTeX labels with accessible MathML.
- [x] Three demo problems, a script, screenshots, and a captioned Part D backup video.
- [ ] Full canvas + brain + voice rehearsal after the other parts are connected.

## Public entry

```ts
import { createMathApi } from "@/lib/math";

const math = createMathApi();
await math.checkStep("2*(x+3)", "2*x+6");
// { ok: true }
await math.checkAnswer("\\int x e^x\\,dx", "x e^{x}-e^x+C");
// { ok: true }
```

`parseLatex` and `differentiateExpression` are also public for graph evaluation. Inputs are parsed as arithmetic trees, never executed as JavaScript. Assignments, property access, arbitrary functions, incomplete input, and oversized expressions are rejected.

## Result handling

- `ok: true`: the supported checks passed.
- `reason: "not-equivalent"`: a numerical mismatch or changed polynomial solution set was found.
- `reason: "unparseable"`: unsupported/incomplete notation; ask the student to confirm the transcription.
- `reason: "unsure"`: insufficient real samples, changed domains, or a transformation needing more context.

**The brain must not treat `unparseable` or `unsure` as a wrong student answer.** Keep the existing `StepCheck` contract. The checker gives no worked solution.

Numerical equivalence is evidence, not a general proof. Fractions retain their domain restrictions: cancelling `(x-10)/(x-10)` produces `unsure` unless the missing restriction is handled elsewhere. Non-polynomial equation transformations are conservative. Definite integrals, inequalities, systems, matrices, complex arithmetic, and arbitrary natural-language questions are outside this version's verifier.

Use `\ln(x)` or `ln(x)` for natural logarithms. LaTeX `\log(x)` is base 10; plain `log(x)` follows math.js and is natural log. Variables are Latin letters or supported Greek names; `e` and `pi` are constants.

## Files

| File | Purpose |
|---|---|
| `parse.ts` | Bounded LaTeX/MathJSON conversion and arithmetic evaluation |
| `calculus.ts` | Symbolic derivatives and indefinite-integral step handling |
| `polynomial.ts` | Linear/quadratic roots and domain restrictions |
| `compare.ts` | Real sample comparison and uncertainty handling |
| `checkStep.ts` | The shared `MathApi` implementation |
| `math.test.ts` | Correctness and malformed-input regression cases |

## Test and hand off

```sh
npm run part-d:test
npm run part-d:preview
npm run part-d:e2e
npm run build
node .github/scripts/part-guard.mjs --local
```

The preview uses a temporary canvas adapter and caption sequence. It calls the real `MathApi` and `VisualsApi`; it does not use `fakeMath` or `fakeVisuals`. All source files stay inside Part D's folders. See [integration notes](../../../docs/part-d/INTEGRATION.md) and [demo script](../../../docs/part-d/DEMO.md).
